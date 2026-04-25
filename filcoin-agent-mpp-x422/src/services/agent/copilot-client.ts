/**
 * Co-Pilot API client — talks to invoice-copilot-backend.
 *
 * The backend hosts the agent runtime, LLM provider, storage router,
 * payment router, and on-chain anchor. The frontend only renders chat
 * turns and action chips; it never talks to IPFS/chain/LLM directly.
 */

export interface InvoiceDraft {
  id: string;
  issuer: { name: string; walletAddress?: string };
  payer: { name: string; walletAddress?: string; email?: string };
  items: { description: string; quantity: number; unitPrice: number; taxPct?: number }[];
  currency: string;
  issuedAt: string;
  dueDate?: string;
  notes?: string;
  paymentRail?: 'x402' | 'mpp' | 'erc8004' | 'manual';
  milestones?: { label: string; amount: number }[];
  subtotal?: number;
  tax?: number;
  total?: number;
}

export interface AgentTurn {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCall?: { name: string; arguments: Record<string, unknown> };
  toolResult?: { name: string; ok: boolean; data?: unknown; error?: string };
}

export interface AgentResponse {
  sessionId: string;
  turns: AgentTurn[];
  invoice?: InvoiceDraft;
  storage?: { cid: string; provider: string; gatewayUrl: string };
  anchor?: { invoiceId: string; txHash: string };
  payment?: { rail: string; txRef: string; status: string };
  history: { tool: string; ok: boolean; summary: string }[];
}

const BACKEND_URL =
  (import.meta.env.VITE_COPILOT_BACKEND_URL as string | undefined) || 'http://localhost:8787';

export async function sendMessage(
  message: string,
  sessionId?: string,
  onTurn?: (turn: AgentTurn) => void,
  signal?: AbortSignal,
): Promise<AgentResponse> {
  const res = await fetch(`${BACKEND_URL}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
    signal,
  });
  if (!res.ok) throw new Error(`Co-Pilot ${res.status}: ${await res.text()}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No readable stream from response');

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: AgentResponse | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // keep the last incomplete chunk in buffer

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const payload = JSON.parse(line);
        if (payload.type === 'error') throw new Error(payload.error);
        if (payload.type === 'turn' && onTurn) {
          onTurn(payload.turn);
        }
        if (payload.type === 'done') {
          finalResult = payload.result as AgentResponse;
        }
      } catch (e) {
        if ((e as Error).message !== 'Unexpected end of JSON input') console.warn('Failed to parse NDJSON segment', e);
        else throw e;
      }
    }
  }

  if (!finalResult) throw new Error('Stream ended without a done payload');
  return finalResult;
}

export async function getSession(id: string): Promise<AgentResponse> {
  const res = await fetch(`${BACKEND_URL}/api/agent/session/${id}`);
  if (!res.ok) throw new Error(`Session not found`);
  return res.json();
}

export async function health(): Promise<{
  ok: boolean;
  provider: string;
  storage: string;
  chain: { id: number; anchoring: boolean };
}> {
  const res = await fetch(`${BACKEND_URL}/health`);
  if (!res.ok) throw new Error('Co-Pilot backend unreachable');
  return res.json();
}

export async function executePayment(req: {
  invoiceId: string;
  rail: 'x402' | 'mpp' | 'erc8004';
  amount: number;
  currency: string;
  payer?: string;
  payee?: string;
  milestones?: { label: string; amount: number }[];
}): Promise<{
  receipt: { rail: string; status: string; txRef: string; explorerUrl?: string };
}> {
  const res = await fetch(`${BACKEND_URL}/api/payments/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Payment ${res.status}: ${await res.text()}`);
  return res.json();
}
