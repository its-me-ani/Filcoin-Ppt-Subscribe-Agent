/**
 * CoPilotPanel — slide-in Agentic Co-Pilot chat panel.
 * Talks to invoice-copilot-backend via services/agent/copilot-client.ts.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonModal,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { sparkles, close, checkmarkCircle, warning, paperPlane } from 'ionicons/icons';
import {
  sendMessage,
  executePayment,
  type AgentResponse,
  type InvoiceDraft,
} from '../../services/agent/copilot-client';
import './CoPilotPanel.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  onInvoiceReady?: (invoice: InvoiceDraft) => void;
}

type ChatEntry =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; name: string; ok: boolean; summary: string };

export const CoPilotPanel: React.FC<Props> = ({ isOpen, onClose, initialPrompt, onInvoiceReady }) => {
  const [input, setInput] = useState('');
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [state, setState] = useState<AgentResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    if (isOpen && initialPrompt && !sentInitial.current) {
      sentInitial.current = true;
      void send(initialPrompt);
    }
    if (!isOpen) sentInitial.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPrompt]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError(null);
    setChat((c) => [...c, { kind: 'user', text: trimmed }]);
    setInput('');
    setLoading(true);
    try {
      const resp = await sendMessage(trimmed, sessionId);
      setSessionId(resp.sessionId);
      setState(resp);
      const newEntries: ChatEntry[] = [];
      for (const turn of resp.turns) {
        if (turn.role === 'assistant' && turn.content) {
          newEntries.push({ kind: 'assistant', text: turn.content });
        } else if (turn.role === 'tool' && turn.toolResult) {
          const h = resp.history.find((x) => x.tool === turn.toolResult!.name);
          newEntries.push({
            kind: 'tool',
            name: turn.toolResult.name,
            ok: turn.toolResult.ok,
            summary: h?.summary ?? (turn.toolResult.ok ? 'Done' : turn.toolResult.error ?? 'Failed'),
          });
        }
      }
      // Replace with deduped view (only last assistant line of each "round" + all tools)
      setChat((c) => [...c, ...newEntries]);
      if (resp.invoice && onInvoiceReady) onInvoiceReady(resp.invoice);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function payNow(rail: 'x402' | 'mpp' | 'erc8004') {
    if (!state?.anchor || !state.invoice) return;
    setLoading(true);
    try {
      const { receipt } = await executePayment({
        invoiceId: state.anchor.invoiceId,
        rail,
        amount: state.invoice.total ?? 0,
        currency: state.invoice.currency,
        payer: state.invoice.payer.walletAddress,
        payee: state.invoice.issuer.walletAddress,
        milestones: state.invoice.milestones,
      });
      setState((s) => (s ? { ...s, payment: { rail: receipt.rail, txRef: receipt.txRef, status: receipt.status } } : s));
      setChat((c) => [
        ...c,
        { kind: 'tool', name: 'request_payment', ok: receipt.status !== 'failed', summary: `Payment via ${rail}: ${receipt.status} (${receipt.txRef.slice(0, 14)}…)` },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="copilot-modal">
      <IonHeader>
        <IonToolbar color="primary">
          <IonIcon slot="start" icon={sparkles} style={{ marginLeft: 16 }} />
          <IonTitle>Invoice Co-Pilot</IonTitle>
          <IonButton slot="end" fill="clear" color="light" onClick={onClose}>
            <IonIcon icon={close} />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div className="copilot-chat" ref={scrollRef}>
          {chat.length === 0 && (
            <div className="copilot-hint">
              <IonText color="medium">
                <p>
                  Describe the invoice you want to issue. Examples:
                </p>
                <ul>
                  <li>“Bill NSUT ₹45,000 for March cloud hosting, milestone payment”</li>
                  <li>“Invoice Dept. of Education for 12 training hours, $80/hr, x402”</li>
                  <li>“Issue ₹1,20,000 to AIC for Q1 consulting, agent-auto-pay in USDC”</li>
                </ul>
              </IonText>
            </div>
          )}

          {chat.map((c, i) => (
            <div key={i} className={`copilot-entry copilot-${c.kind}`}>
              {c.kind === 'user' && <div className="bubble user">{c.text}</div>}
              {c.kind === 'assistant' && <div className="bubble assistant">{c.text}</div>}
              {c.kind === 'tool' && (
                <div className={`tool-row ${c.ok ? 'ok' : 'fail'}`}>
                  <IonIcon icon={c.ok ? checkmarkCircle : warning} />
                  <span className="tool-name">{c.name}</span>
                  <span className="tool-summary">{c.summary}</span>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="copilot-loading">
              <IonSpinner name="dots" /> <span>Co-Pilot is working…</span>
            </div>
          )}

          {error && (
            <div className="copilot-error">
              <IonIcon icon={warning} /> {error}
            </div>
          )}

          {state && (state.storage || state.anchor || state.payment) && (
            <div className="copilot-status">
              {state.storage && (
                <Chip
                  label="Stored"
                  value={`${state.storage.provider} · ${state.storage.cid.slice(0, 10)}…`}
                  href={state.storage.gatewayUrl}
                />
              )}
              {state.anchor && (
                <Chip
                  label="Anchored"
                  value={`${state.anchor.txHash.slice(0, 10)}…`}
                />
              )}
              {state.payment && (
                <Chip
                  label={`Paid via ${state.payment.rail}`}
                  value={state.payment.status}
                />
              )}
            </div>
          )}

          {state?.anchor && !state.payment && (
            <div className="copilot-pay">
              <IonText color="medium"><small>Pay this invoice now:</small></IonText>
              <div className="pay-buttons">
                <IonButton size="small" onClick={() => payNow('x402')}>x402</IonButton>
                <IonButton size="small" onClick={() => payNow('mpp')}>MPP (Tempo)</IonButton>
                <IonButton size="small" onClick={() => payNow('erc8004')}>ERC-8004</IonButton>
              </div>
            </div>
          )}
        </div>
      </IonContent>

      <IonFooter>
        <IonToolbar>
          <div className="copilot-input-row">
            <IonInput
              value={input}
              placeholder="Describe an invoice or ask the Co-Pilot…"
              onIonInput={(e) => setInput(e.detail.value ?? '')}
              onKeyUp={(e) => {
                if (e.key === 'Enter') void send(input);
              }}
            />
            <IonButton onClick={() => void send(input)} disabled={loading || !input.trim()}>
              <IonIcon icon={paperPlane} />
            </IonButton>
          </div>
        </IonToolbar>
      </IonFooter>
    </IonModal>
  );
};

const Chip: React.FC<{ label: string; value: string; href?: string }> = ({ label, value, href }) => {
  const inner = (
    <div className="copilot-chip">
      <span className="chip-label">{label}</span>
      <span className="chip-value">{value}</span>
    </div>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
      {inner}
    </a>
  ) : (
    inner
  );
};

export default CoPilotPanel;
