import React, { useState } from 'react';
import { ChatMessage as ChatMessageType, CellEditAction } from '../../../types/ai';
import { TOOL_REGISTRY } from '../../../services/ai/tools/tool-registry';

interface ChatMessageProps {
  message: ChatMessageType;
  pendingActions?: CellEditAction[] | null;
  onApply?: () => void;
  onReject?: () => void;
  isLast?: boolean;
}

/** Render inline markdown: **bold**, *italic*, `code` */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const pattern = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const k = `${keyPrefix}-${match.index}`;
    if (token.startsWith('**')) {
      nodes.push(<strong key={k}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={k} style={{ backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: '3px', padding: '1px 4px', fontSize: '12px', fontFamily: 'monospace' }}>
          {token.slice(1, -1)}
        </code>
      );
    } else {
      nodes.push(<em key={k}>{token.slice(1, -1)}</em>);
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Render markdown into React nodes */
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      result.push(<div key={i} style={{ height: '5px' }} />);
      i++;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const sizes = ['15px', '14px', '13px'];
      result.push(
        <div key={i} style={{ fontWeight: 700, fontSize: sizes[level - 1] ?? '13px', marginTop: '6px', marginBottom: '2px', color: '#111827' }}>
          {renderInline(headingMatch[2], String(i))}
        </div>
      );
      i++;
      continue;
    }

    if (/^[\*\-]\s/.test(line)) {
      const bullets: React.ReactNode[] = [];
      while (i < lines.length && /^[\*\-]\s/.test(lines[i])) {
        const content = lines[i].replace(/^[\*\-]\s+/, '');
        bullets.push(<li key={i} style={{ marginBottom: '3px' }}>{renderInline(content, String(i))}</li>);
        i++;
      }
      result.push(
        <ul key={`ul-${i}`} style={{ margin: '4px 0', paddingLeft: '18px' }}>
          {bullets}
        </ul>
      );
      continue;
    }

    result.push(
      <div key={i} style={{ marginBottom: '2px', lineHeight: '1.55' }}>
        {renderInline(line, String(i))}
      </div>
    );
    i++;
  }

  return <>{result}</>;
}

/** Format currency nicely */
function formatPrice(price: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);
}

// ── Tool call card ──────────────────────────────────────────────────────────
const ToolCallCard: React.FC<{ name: string; parameters: Record<string, any>; result?: any; error?: string }> = ({
  name, parameters, result, error,
}) => {
  const [expanded, setExpanded] = useState(false);
  const toolDef = TOOL_REGISTRY.find(t => t.name === name);
  const label = toolDef?.label ?? name;

  const items: any[] = Array.isArray(result) ? result : [];
  const hasItems = items.length > 0;
  const visibleItems = expanded ? items : items.slice(0, 3);
  const hiddenCount = items.length - 3;

  const paramSummary = Object.entries(parameters)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}: "${v}"`)
    .join(', ');

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '8px' }}>
      <div style={{
        maxWidth: '92%',
        borderRadius: '12px',
        backgroundColor: '#f5f3ff',
        border: '1px solid #ddd6fe',
        fontSize: '13px',
        overflow: 'hidden',
      }}>
        {/* Header row */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '8px 12px',
            cursor: hasItems && hiddenCount > 0 ? 'pointer' : 'default',
          }}
          onClick={() => hasItems && hiddenCount > 0 && setExpanded(v => !v)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          <span style={{ fontWeight: 700, color: '#6d28d9' }}>{label}</span>
          {paramSummary && (
            <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '12px' }}>({paramSummary})</span>
          )}
          {hasItems && hiddenCount > 0 && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" style={{ marginLeft: 'auto', transition: 'transform 0.15s', transform: expanded ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>

        {/* Result body */}
        <div style={{ padding: '0 12px 10px' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontSize: '12px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          {!error && !hasItems && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9ca3af', fontSize: '12px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              No results found
            </div>
          )}

          {hasItems && (
            <>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669', marginBottom: '6px' }}>
                {items.length} item{items.length !== 1 ? 's' : ''} found
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {visibleItems.map((item: any, i: number) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '5px 8px', borderRadius: '7px',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    border: '1px solid #ede9fe',
                  }}>
                    <span style={{ fontWeight: 500, color: '#1f2937', fontSize: '12px' }}>
                      {item.name ?? item.id ?? '—'}
                    </span>
                    {item.price !== undefined && (
                      <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600, marginLeft: '8px', flexShrink: 0 }}>
                        {formatPrice(item.price)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {!expanded && hiddenCount > 0 && (
                <button
                  onClick={() => setExpanded(true)}
                  style={{ marginTop: '6px', fontSize: '11px', color: '#7c3aed', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                >
                  +{hiddenCount} more
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Success / system notification ──────────────────────────────────────────
const SystemNote: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '5px 12px', borderRadius: '20px',
      backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
      fontSize: '12px', color: '#15803d', fontWeight: 500,
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {text}
    </div>
  </div>
);

// ── Main component ──────────────────────────────────────────────────────────
const ChatMessageComponent: React.FC<ChatMessageProps> = ({
  message,
  pendingActions,
  onApply,
  onReject,
  isLast,
}) => {
  if (message.toolCallInfo) {
    const { name, parameters, result, error } = message.toolCallInfo;
    return <ToolCallCard name={name} parameters={parameters} result={result} error={error} />;
  }

  const isUser = message.role === 'user';
  const isApplied = /^Applied \d+ cell edit/i.test(message.content);
  const isCancelled = message.content === 'Cell edits cancelled.' || message.content === 'Generation stopped.';
  const isSystemNote = isApplied || isCancelled;

  if (isSystemNote) return <SystemNote text={message.content} />;

  const isError = message.content.startsWith('Error:');

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      alignItems: 'flex-end',
      gap: '8px',
      marginBottom: '12px',
      paddingLeft: isUser ? '32px' : '0',
      paddingRight: isUser ? '0' : '32px',
    }}>
      {/* Assistant avatar */}
      {!isUser && (
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
          backgroundColor: '#ede9fe',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          alignSelf: 'flex-end', marginBottom: '2px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
            <circle cx="9" cy="14" r="1" fill="#7c3aed" stroke="none"/>
            <circle cx="15" cy="14" r="1" fill="#7c3aed" stroke="none"/>
          </svg>
        </div>
      )}

      <div style={{
        maxWidth: '100%',
        padding: '10px 14px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
        backgroundColor: isUser ? '#4f46e5' : isError ? '#fef2f2' : '#f9fafb',
        color: isUser ? '#fff' : isError ? '#991b1b' : '#1f2937',
        fontSize: '14px',
        lineHeight: '1.5',
        wordBreak: 'break-word',
        boxShadow: isUser ? '0 2px 8px rgba(79,70,229,0.25)' : '0 1px 4px rgba(0,0,0,0.06)',
        border: isUser ? 'none' : '1px solid #f0f0f0',
      }}>
        {/* Attached images */}
        {message.images && message.images.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: message.content ? '8px' : '0' }}>
            {message.images.map((src, idx) => (
              <img key={idx} src={src} alt={`attachment ${idx + 1}`} style={{
                maxWidth: '180px', maxHeight: '180px', borderRadius: '8px',
                objectFit: 'contain', border: '1px solid rgba(255,255,255,0.3)', display: 'block',
              }} />
            ))}
          </div>
        )}

        {isUser
          ? <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
          : renderMarkdown(message.content)
        }

        {/* Pending actions */}
        {isLast && pendingActions && pendingActions.length > 0 && (
          <div style={{ marginTop: '12px', borderTop: '1px solid #e5e7eb', paddingTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#92400e' }}>
                {pendingActions.length} proposed edit{pendingActions.length > 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '10px', maxHeight: '120px', overflowY: 'auto' }}>
              {pendingActions.map((action, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '12px', padding: '3px 6px', borderRadius: '6px',
                  backgroundColor: '#fef3c7',
                }}>
                  <code style={{ fontFamily: 'monospace', fontWeight: 700, color: '#b45309', minWidth: '36px' }}>{action.coord}</code>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {String(action.value).substring(0, 40)}{String(action.value).length > 40 ? '…' : ''}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={onApply} style={{
                flex: 1, padding: '7px 0', borderRadius: '9px', border: 'none',
                backgroundColor: '#4f46e5', color: '#fff',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Apply
              </button>
              <button onClick={onReject} style={{
                flex: 1, padding: '7px 0', borderRadius: '9px',
                border: '1px solid #e5e7eb', backgroundColor: '#fff',
                color: '#6b7280', fontSize: '13px', cursor: 'pointer',
              }}>
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessageComponent;
