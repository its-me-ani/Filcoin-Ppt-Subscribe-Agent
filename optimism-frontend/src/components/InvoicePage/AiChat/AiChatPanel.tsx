import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import {
  IonButton, IonIcon, IonList, IonItem, IonLabel,
  IonSegment, IonSegmentButton, IonSearchbar,
} from '@ionic/react';
import {
  businessOutline, cubeOutline, imageOutline,
  addCircleOutline, alertCircleOutline,
} from 'ionicons/icons';
import { AppMappingItem } from '../../../types/template';
import { AiMode } from '../../../types/ai';
import { useAiChat } from '../../../hooks/useAiChat';
import { useInvoice } from '../../../contexts/InvoiceContext';
import {
  businessInfoRepository,
  customerRepository,
  inventoryRepository,
} from '../../../data';
import ChatMessageComponent from './ChatMessage';
import ChatInput from './ChatInput';
import './AiChatPanel.css';
import '../InvoiceSidebar/InvoiceSidebar.css';

interface Footer {
  name: string;
  index: number;
  isActive?: boolean;
}

interface AiChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  appMapping: Record<string, Record<string, AppMappingItem>> | undefined;
  footers?: Footer[];
  onApplyAddress: (address: any) => void;
  onApplyInventory: (item: any, quantity?: number) => void;
  onApplyLogo: (logo: any) => void;
  onApplySignature: (sig: any) => void;
}

function getSocialCalcSheetId(): string {
  try {
    const sc = (window as any).SocialCalc;
    return sc?.GetCurrentWorkBookControl()?.currentSheetButton?.id ?? 'sheet1';
  } catch {
    return 'sheet1';
  }
}

function countEditableCells(
  appMapping: Record<string, Record<string, AppMappingItem>> | undefined,
  sheetId: string,
): number {
  if (!appMapping?.[sheetId]) return 0;
  let n = 0;
  for (const item of Object.values(appMapping[sheetId])) {
    if (item.type === 'text' && item.editable) n++;
    if (item.type === 'form' && item.formContent) {
      for (const sub of Object.values(item.formContent)) {
        if ((sub as AppMappingItem).editable) n++;
      }
    }
    if (item.type === 'table' && item.rows && item.col) {
      const editableCols = Object.values(item.col).filter(c => (c as AppMappingItem).editable).length;
      n += editableCols * (item.rows.end - item.rows.start + 1);
    }
  }
  return n;
}

const AiChatPanel: React.FC<AiChatPanelProps> = ({
  isOpen,
  onClose,
  appMapping,
  footers,
  onApplyAddress,
  onApplyInventory,
  onApplyLogo,
  onApplySignature,
}) => {

  // ── Panel tab ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'quick' | 'ai'>('ai');

  // ── AI Chat state ──────────────────────────────────────────────────────────
  const {
    messages, isLoading, pendingActions,
    sendMessage, abortGeneration,
    applyPendingActions, rejectPendingActions, clearMessages,
  } = useAiChat(appMapping);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [activeToolNames, setActiveToolNames] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('ai-chat-active-tools');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  const toggleTool = useCallback((name: string) => {
    setActiveToolNames(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      localStorage.setItem('ai-chat-active-tools', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  const [activeSheetId, setActiveSheetId] = useState<string>(getSocialCalcSheetId);

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => {
      const current = getSocialCalcSheetId();
      setActiveSheetId(prev => (prev !== current ? current : prev));
    }, 400);
    return () => clearInterval(id);
  }, [isOpen]);

  const activeFooterName = useMemo(() => {
    if (footers && footers.length > 0) {
      const sheetIndex = parseInt(activeSheetId.replace(/\D/g, ''), 10) - 1;
      const match = footers.find(f => f.index === sheetIndex) ?? footers[sheetIndex];
      if (match) return match.name;
    }
    return activeSheetId;
  }, [footers, activeSheetId]);

  const editableCellCount = useMemo(
    () => countEditableCells(appMapping, activeSheetId),
    [appMapping, activeSheetId],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // ── Quick Insert state ─────────────────────────────────────────────────────
  const { currency } = useInvoice();
  const [quickSegment, setQuickSegment] = useState<'info' | 'inventory'>('info');
  const [searchText, setSearchText] = useState('');
  const [addresses, setAddresses] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [logos, setLogos] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen && activeTab === 'quick') {
      loadQuickData();
    }
  }, [isOpen, activeTab, quickSegment]);

  const loadQuickData = async () => {
    try {
      if (quickSegment === 'info') {
        const [addr, , l, s] = await Promise.all([
          businessInfoRepository.getAllAddresses(),
          customerRepository.getAll(),
          businessInfoRepository.getAllLogos(),
          businessInfoRepository.getAllSignatures(),
        ]);
        setAddresses(addr);
        setLogos(l);
        setSignatures(s);
      } else {
        const inv = await inventoryRepository.getAll();
        setInventory(inv);
      }
    } catch (e) {
      console.error('Error loading quick insert data:', e);
    }
  };

  const filteredAddresses = addresses.filter(a =>
    (a.label || '').toLowerCase().includes(searchText.toLowerCase())
  );
  const filteredInventory = inventory.filter(i =>
    (i.name || '').toLowerCase().includes(searchText.toLowerCase())
  );

  const formatPrice = (price: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(price);
    } catch { return `$${price.toFixed(2)}`; }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!isOpen) return null;

  return (
    <div className="ai-chat-overlay" onClick={onClose}>
      <div className="ai-chat-panel" onClick={e => e.stopPropagation()}>

        {/* Header with tab switcher */}
        <div className="ai-chat-header">
          <div className="panel-tabs">
            <button
              className={`panel-tab-btn${activeTab === 'ai' ? ' active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5, flexShrink: 0 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              AI Assistant
            </button>
            <button
              className={`panel-tab-btn${activeTab === 'quick' ? ' active' : ''}`}
              onClick={() => setActiveTab('quick')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5, flexShrink: 0 }}>
                <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                <path d="M19.5 7.125L16.875 4.5" />
              </svg>
              Quick Insert
            </button>
          </div>

          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            {activeTab === 'ai' && (
              <button className="ai-chat-header-btn" onClick={clearMessages} title="Clear chat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
            <button className="ai-chat-header-btn" onClick={onClose} title="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Quick Insert Tab ─────────────────────────────────────────────── */}
        {activeTab === 'quick' && (
          <div className="quick-insert-sidebar quick-insert-embedded">
            <div className="sidebar-tabs">
              <IonSegment value={quickSegment} onIonChange={e => setQuickSegment(e.detail.value as any)}>
                <IonSegmentButton value="info">
                  <IonIcon icon={businessOutline} />
                  <IonLabel>Info</IonLabel>
                </IonSegmentButton>
                <IonSegmentButton value="inventory">
                  <IonIcon icon={cubeOutline} />
                  <IonLabel>Items</IonLabel>
                </IonSegmentButton>
              </IonSegment>
            </div>

            <div className="sidebar-scrollable-content">
              {quickSegment === 'info' && (
                <div>
                  <div className="section-header">
                    <IonIcon icon={imageOutline} />
                    <span>Logos</span>
                    <button className="section-remove-btn" onClick={() => onApplyLogo('')}>Remove</button>
                  </div>
                  {logos.length > 0 ? (
                    <div className="assets-grid assets-grid-compact">
                      {logos.map(logo => (
                        <div key={logo.id} className="asset-card asset-card-compact" onClick={() => onApplyLogo(logo)}>
                          <div className="asset-image-container"><img src={logo.data} alt={logo.name} /></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state-inline"><p>Add logos in Business Info</p></div>
                  )}

                  <div className="section-header" style={{ marginTop: 16 }}>
                    <IonIcon icon={imageOutline} />
                    <span>Signatures</span>
                    <button className="section-remove-btn" onClick={() => onApplySignature('')}>Remove</button>
                  </div>
                  {signatures.length > 0 ? (
                    <div className="assets-grid assets-grid-compact">
                      {signatures.map(sig => (
                        <div key={sig.id} className="asset-card asset-card-compact" onClick={() => onApplySignature(sig)}>
                          <div className="asset-image-container"><img src={sig.data} alt={sig.name} /></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state-inline"><p>Add signatures in Business Info</p></div>
                  )}

                  <div className="section-header" style={{ marginTop: 16 }}>
                    <IonIcon icon={businessOutline} />
                    <span>Addresses</span>
                  </div>
                  <IonList lines="none" className="sidebar-list">
                    {filteredAddresses.length > 0 ? filteredAddresses.map(addr => (
                      <IonItem button key={addr.id} detail={false} onClick={() => onApplyAddress(addr)}>
                        <IonLabel>
                          <h2>{addr.label}</h2>
                          <p>{addr.streetAddress}, {addr.cityStateZip}</p>
                        </IonLabel>
                        <IonButton fill="clear" slot="end" className="add-btn">
                          <IonIcon icon={addCircleOutline} slot="start" />Add
                        </IonButton>
                      </IonItem>
                    )) : (
                      <div className="empty-state-inline"><p>Add addresses in Business Info</p></div>
                    )}
                  </IonList>
                  <div style={{ height: 40 }} />
                </div>
              )}

              {quickSegment === 'inventory' && (
                <div>
                  <div className="search-container">
                    <IonSearchbar
                      value={searchText}
                      onIonInput={e => setSearchText(e.detail.value!)}
                      placeholder="Search items..."
                      debounce={250}
                    />
                  </div>
                  <IonList lines="none" className="sidebar-list">
                    {filteredInventory.length > 0 ? filteredInventory.map(item => {
                      const qty = quantities[item.id] || 1;
                      const updateQty = (id: string, delta: number) => setQuantities(prev => ({
                        ...prev,
                        [id]: Math.max(1, (prev[id] || 1) + delta),
                      }));
                      return (
                        <IonItem button={false} key={item.id} detail={false} className="inventory-item">
                          <div style={{ flex: 1 }}>
                            <IonLabel>
                              <h2>{item.name}</h2>
                              <p><span className="price-tag">{formatPrice(item.price || 0)}</span></p>
                            </IonLabel>
                          </div>
                          <div className="qty-controls" slot="end" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--ion-color-light)', borderRadius: 20, padding: 2 }}>
                              <IonButton fill="clear" size="small" style={{ margin: 0, height: 28, width: 28, '--padding-start': '0', '--padding-end': '0' }} onClick={e => { e.stopPropagation(); updateQty(item.id, -1); }}>-</IonButton>
                              <span style={{ margin: '0 4px', fontSize: 13, minWidth: 20, textAlign: 'center', fontWeight: 600 }}>{qty}</span>
                              <IonButton fill="clear" size="small" style={{ margin: 0, height: 28, width: 28, '--padding-start': '0', '--padding-end': '0' }} onClick={e => { e.stopPropagation(); updateQty(item.id, 1); }}>+</IonButton>
                            </div>
                            <IonButton fill="clear" className="add-btn" onClick={e => { e.stopPropagation(); onApplyInventory(item, qty); }}>
                              <IonIcon icon={addCircleOutline} slot="start" />Add
                            </IonButton>
                          </div>
                        </IonItem>
                      );
                    }) : (
                      <div className="empty-state">
                        <IonIcon icon={alertCircleOutline} />
                        <p>No inventory items found</p>
                      </div>
                    )}
                  </IonList>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AI Assistant Tab ─────────────────────────────────────────────── */}
        {activeTab === 'ai' && (
          <>
            <div className="ai-chat-messages">
              {messages.length === 0 && (
                <div className="ai-chat-empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <p style={{ fontWeight: 500 }}>Ask about your invoice</p>
                  <p style={{ fontSize: 13, opacity: 0.7 }}>Read, explain, or edit cells via chat</p>
                  <div className="ai-chat-suggestions">
                    <button onClick={() => sendMessage('Summarize this invoice', undefined, 'summarize')}>Summarize this invoice</button>
                    <button onClick={() => sendMessage('Analyze this invoice for errors', undefined, 'analyze')}>Analyze for issues</button>
                    <button onClick={() => sendMessage("What's the total amount?", undefined, 'auto')}>What's the total?</button>
                    <button onClick={() => sendMessage('Fix any spelling or formatting issues', undefined, 'format')}>Fix formatting</button>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <ChatMessageComponent
                  key={i}
                  message={msg}
                  isLast={i === messages.length - 1 && msg.role === 'assistant'}
                  pendingActions={i === messages.length - 1 ? pendingActions : null}
                  onApply={applyPendingActions}
                  onReject={rejectPendingActions}
                />
              ))}

              {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
                  <div className="ai-chat-thinking">
                    <div className="ai-chat-dot" />
                    <div className="ai-chat-dot" style={{ animationDelay: '0.2s' }} />
                    <div className="ai-chat-dot" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <ChatInput
              onSend={(text, images, mode, toolNames) => sendMessage(text, images, mode, toolNames)}
              onAbort={abortGeneration}
              isLoading={isLoading}
              disabled={!!pendingActions}
              footerNames={[activeFooterName]}
              editableCellCount={editableCellCount}
              activeToolNames={activeToolNames}
              onToggleTool={toggleTool}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default AiChatPanel;
