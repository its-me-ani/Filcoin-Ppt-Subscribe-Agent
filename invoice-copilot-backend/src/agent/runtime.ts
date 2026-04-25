import { nanoid } from 'nanoid';
import { chat, type LlmMessage } from './llm.js';
import { runTool, TOOL_SPECS, type Session } from './tools/index.js';
import type { AgentTurn } from '../types.js';

const SYSTEM = `You are the Agentic Invoice Co-Pilot for government and educational billing.
You help users create, validate, store (on Filecoin/IPFS), anchor on-chain, and pay invoices
using agentic rails (x402, MPP/Tempo, ERC-8004).

RULES:
- Prefer tools over prose. Call tools in order: generate_invoice → validate_invoice → store_on_ipfs → anchor_on_chain → request_payment.
- If validation fails with errors, stop and ask the user to fix them before storing.
- Pick the payment rail from the user's intent: milestones/streaming → mpp; agent-to-agent → erc8004; pay-per-request API → x402.
- Never fabricate tx hashes or CIDs — always call the tool.`;

const SESSIONS = new Map<string, Session>();

export function getOrCreateSession(id?: string): Session {
  if (id && SESSIONS.has(id)) return SESSIONS.get(id)!;
  const s: Session = { id: id ?? `sess_${nanoid(8)}`, history: [] };
  SESSIONS.set(s.id, s);
  return s;
}

export function getSession(id: string): Session | undefined {
  return SESSIONS.get(id);
}

export async function runAgent(opts: {
  sessionId?: string;
  userMessage: string;
  maxSteps?: number;
  onTurn?: (turn: AgentTurn) => void;
}): Promise<{
  sessionId: string;
  turns: AgentTurn[];
  session: Session;
}> {
  const session = getOrCreateSession(opts.sessionId);
  const turns: AgentTurn[] = [];
  const messages: LlmMessage[] = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: opts.userMessage },
  ];

  const userTurn: AgentTurn = { role: 'user', content: opts.userMessage };
  turns.push(userTurn);
  if (opts.onTurn) opts.onTurn(userTurn);

  const maxSteps = opts.maxSteps ?? 8;
  for (let step = 0; step < maxSteps; step++) {
    const resp = await chat(messages, TOOL_SPECS);
    console.log(`[Turn ${step}] Gemini resp:`, JSON.stringify(resp, null, 2));

    if (resp.content || resp.toolCalls.length > 0) {
      const assistantTurn: AgentTurn = { role: 'assistant', content: resp.content, toolCalls: resp.toolCalls };
      turns.push(assistantTurn);
      if (opts.onTurn) opts.onTurn(assistantTurn);
      messages.push({ role: 'assistant', content: resp.content, toolCalls: resp.toolCalls });
    }

    if (resp.toolCalls.length === 0) break;

    for (const call of resp.toolCalls) {
      const result = await runTool(session, call.name, call.arguments);
      const toolTurn: AgentTurn = {
        role: 'tool',
        content: JSON.stringify(result),
        toolCall: { name: call.name, arguments: call.arguments },
        toolResult: { name: call.name, ok: result.ok, data: result.data, error: result.error },
      };
      turns.push(toolTurn);
      if (opts.onTurn) opts.onTurn(toolTurn);
      messages.push({
        role: 'tool',
        name: call.name,
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 4000),
      });
    }

    if (resp.finish !== 'tool_calls') break;
  }

  return { sessionId: session.id, turns, session };
}
