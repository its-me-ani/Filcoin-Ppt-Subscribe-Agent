import React, { useEffect, useRef, useState } from 'react';
import {
    IonButton,
    IonContent,
    IonFooter,
    IonIcon,
    IonInput,
    IonPage,
    IonSpinner,
    IonText,
    IonToolbar,
    IonHeader,
    IonTitle,
} from '@ionic/react';
import {
    sparkles,
    checkmarkCircle,
    warning,
    paperPlane,
} from 'ionicons/icons';
import {
    sendMessage,
    executePayment,
    type AgentResponse,
} from '../services/agent/copilot-client';
import '../components/copilot/CoPilotPanel.css'; // Re-use existing css for styling the chat

type ChatEntry =
    | { kind: 'user'; text: string }
    | { kind: 'assistant'; text: string }
    | { kind: 'tool'; name: string; ok: boolean; summary: string };

const Chip: React.FC<{ label: string; value: string; href?: string }> = ({ label, value, href }) => {
    const inner = (
        <div className="copilot-chip" style={{ display: 'inline-flex', flexDirection: 'column', background: '#f4f5f8', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e0e0e0', marginRight: '8px', marginBottom: '8px' }}>
            <span className="chip-label" style={{ fontSize: '12px', fontWeight: 'bold' }}>{label}</span>
            <span className="chip-value" style={{ fontSize: '14px', color: '#666', fontFamily: 'monospace' }}>{value}</span>
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

export const CopilotPage: React.FC = () => {
    const [input, setInput] = useState('');
    const [chat, setChat] = useState<ChatEntry[]>([]);
    const [state, setState] = useState<AgentResponse | null>(null);
    const [sessionId, setSessionId] = useState<string | undefined>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Scroll to bottom whenever chat or loading state changes
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
            const resp = await sendMessage(trimmed, sessionId, (turn) => {
                // Stream updates live
                if (turn.role === 'assistant' && turn.content) {
                    setChat((c) => [...c, { kind: 'assistant', text: turn.content }]);
                } else if (turn.role === 'tool' && turn.toolResult) {
                    setChat((c) => [
                        ...c,
                        {
                            kind: 'tool',
                            name: turn.toolResult!.name,
                            ok: turn.toolResult!.ok,
                            summary: 'Processing task...',
                        }
                    ]);
                }
            });

            setSessionId(resp.sessionId);
            setState(resp);

            const sessionTurns: ChatEntry[] = [];
            for (const turn of resp.turns) {
                if (turn.role === 'assistant' && turn.content) {
                    sessionTurns.push({ kind: 'assistant', text: turn.content });
                } else if (turn.role === 'tool' && turn.toolResult) {
                    const h = resp.history.find((x) => x.tool === turn.toolResult!.name);
                    sessionTurns.push({
                        kind: 'tool',
                        name: turn.toolResult.name,
                        ok: turn.toolResult.ok,
                        summary: h?.summary ?? (turn.toolResult.ok ? 'Completed successfully' : turn.toolResult.error ?? 'Failed'),
                    });
                }
            }

            // Wipe the streaming ones and set the proper final ones
            setChat((c) => {
                const c_old = c.filter(item => item.kind === 'user' && (item as any).text !== trimmed);
                return [...c_old, { kind: 'user', text: trimmed }, ...sessionTurns];
            });
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
        <IonPage>
            <IonHeader>
                <IonToolbar style={{ '--background': '#121212', color: '#fff' }} className="ion-padding-start">
                    <IonIcon slot="start" icon={sparkles} style={{ color: '#4da8da' }} />
                    <IonTitle style={{ color: '#fff', fontWeight: 'bold', letterSpacing: '0.5px' }}>Invoice Co-Pilot</IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent className="ion-padding" style={{ '--background': '#000000' }}>
                <div
                    className="copilot-chat-container"
                    ref={scrollRef}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        overflowY: 'auto',
                        maxWidth: '800px',
                        margin: '0 auto',
                        paddingTop: '10vh'
                    }}
                >
                    {chat.length === 0 && (
                        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                            <h1 style={{ color: '#fff', fontSize: '36px', fontWeight: '800', marginBottom: '16px', background: '-webkit-linear-gradient(45deg, #4da8da, #9b51e0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                What can I help you invoice today?
                            </h1>
                            <p style={{ color: '#a0a0a0', fontSize: '16px', maxWidth: '600px', margin: '0 auto' }}>
                                Describe your payment request. I will generate, validate, anchor the invoice on-chain, and set up the payment processing rail for you.
                            </p>
                        </div>
                    )}

                    {/* Central Input when empty, docked Input when chatting */}
                    {chat.length === 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', background: '#1e1e1e', borderRadius: '32px', border: '1px solid #333', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', width: '100%', maxWidth: '700px', margin: '0 auto 40px' }}>
                            <input
                                value={input}
                                placeholder="Describe an invoice or ask the Co-Pilot…"
                                onChange={(e) => setInput(e.target.value)}
                                onKeyUp={(e) => {
                                    if (e.key === 'Enter') void send(input);
                                }}
                                style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '16px', paddingLeft: '12px', height: '40px' }}
                            />
                            <IonButton fill="clear" onClick={() => void send(input)} disabled={loading || !input.trim()} style={{ color: '#4da8da' }}>
                                <IonIcon icon={paperPlane} />
                            </IonButton>
                        </div>
                    )}

                    {chat.length === 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', maxWidth: '700px', margin: '0 auto' }}>
                            {[
                                "Bill Protocol Labs $5,000 for May auditing",
                                "Invoice Dept. of Education for 12 training hours, $80/hr, x402",
                                "Issue ₹1,20,000 to AIC for Q1 consulting, agent-auto-pay in USDC"
                            ].map((example, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setInput(example)}
                                    style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', padding: '12px 16px', color: '#ccc', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#252525'; e.currentTarget.style.borderColor = '#4da8da'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.borderColor = '#333'; }}
                                >
                                    "{example}"
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Chat History */}
                    {chat.map((c, i) => (
                        <div key={i} className={`copilot-entry copilot-${c.kind}`} style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: c.kind === 'user' ? 'flex-end' : 'flex-start', width: '100%', maxWidth: '800px', margin: '0 auto 20px' }}>
                            {c.kind === 'user' && (
                                <div style={{ background: '#252525', color: '#fff', padding: '14px 20px', borderRadius: '20px', maxWidth: '85%', fontSize: '15px', lineHeight: '1.5' }}>
                                    {c.text}
                                </div>
                            )}
                            {c.kind === 'assistant' && (
                                <div style={{ color: '#ddd', padding: '14px 20px', borderRadius: '20px', maxWidth: '85%', fontSize: '15px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                    {c.text}
                                </div>
                            )}
                            {c.kind === 'tool' && (
                                <div style={{ background: '#121212', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', color: '#aaa', display: 'flex', alignItems: 'center', gap: '8px', borderLeft: `3px solid ${c.ok ? '#2dd36f' : '#eb445a'}` }}>
                                    <IonIcon icon={c.ok ? checkmarkCircle : warning} color={c.ok ? 'success' : 'danger'} />
                                    <strong style={{ color: '#fff' }}>{c.name}</strong>: {c.summary}
                                </div>
                            )}
                        </div>
                    ))}

                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', color: '#888', maxWidth: '800px', margin: '0 auto' }}>
                            <IonSpinner name="dots" color="medium" /> <span>Working on it...</span>
                        </div>
                    )}

                    {error && (
                        <div style={{ background: 'rgba(235, 68, 90, 0.1)', color: '#ff4d4d', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '800px', margin: '16px auto', border: '1px solid rgba(235, 68, 90, 0.3)' }}>
                            <IonIcon icon={warning} style={{ fontSize: '20px' }} /> {error}
                        </div>
                    )}

                    {state && (state.storage || state.anchor || state.payment) && (
                        <div style={{ marginTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '12px', maxWidth: '800px', margin: '24px auto 0' }}>
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
                        <div style={{ marginTop: '24px', background: '#1a1a1a', padding: '20px', borderRadius: '16px', border: '1px solid #333', maxWidth: '800px', margin: '24px auto 0', width: '100%' }}>
                            <IonText style={{ color: '#fff', display: 'block', marginBottom: '16px', fontSize: '15px' }}><strong>Payment Gateway Selection</strong></IonText>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <IonButton size="small" onClick={() => payNow('x402')} color="primary" fill="outline" style={{ '--border-radius': '8px' }}>x402 Standard</IonButton>
                                <IonButton size="small" onClick={() => payNow('mpp')} color="secondary" fill="outline" style={{ '--border-radius': '8px' }}>Tempo MPP</IonButton>
                                <IonButton size="small" onClick={() => payNow('erc8004')} color="tertiary" fill="outline" style={{ '--border-radius': '8px' }}>ERC-8004 Agent</IonButton>
                            </div>
                        </div>
                    )}
                </div>
            </IonContent>

            {/* Only show docked footer input if chat has started */}
            {chat.length > 0 && (
                <IonFooter style={{ borderTop: '1px solid #333', background: '#121212' }}>
                    <IonToolbar style={{ '--background': '#121212' }}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                            <input
                                value={input}
                                placeholder="Ask a follow-up or create another..."
                                onChange={(e) => setInput(e.target.value)}
                                onKeyUp={(e) => {
                                    if (e.key === 'Enter') void send(input);
                                }}
                                style={{
                                    flex: 1,
                                    background: '#252525',
                                    color: '#fff',
                                    paddingLeft: '20px',
                                    borderRadius: '24px',
                                    marginRight: '12px',
                                    height: '48px',
                                    border: '1px solid #333',
                                    outline: 'none',
                                    fontSize: '15px'
                                }}
                            />
                            <IonButton shape="round" onClick={() => void send(input)} disabled={loading || !input.trim()} style={{ height: '48px', width: '48px', '--border-radius': '50%' }}>
                                <IonIcon icon={paperPlane} />
                            </IonButton>
                        </div>
                    </IonToolbar>
                </IonFooter>
            )}
        </IonPage>
    );
};

export default CopilotPage;
