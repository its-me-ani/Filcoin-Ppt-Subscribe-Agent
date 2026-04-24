import { env } from '../config/env.js';
import type { ToolCall } from '../types.js';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  toolCalls?: any[];
}

export interface LlmToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LlmResponse {
  content: string;
  toolCalls: (ToolCall & { id: string })[];
  finish: 'stop' | 'tool_calls' | 'length';
}

export async function chat(messages: LlmMessage[], tools: LlmToolSpec[]): Promise<LlmResponse> {
  switch (env.ai.provider) {
    case 'openai':
      return openai(messages, tools);
    case 'anthropic':
      return anthropic(messages, tools);
    case 'ollama':
      return ollama(messages, tools);
    case 'gemini':
      return gemini(messages, tools);
    case 'mock':
    default:
      return mock(messages, tools);
  }
}

// ─── Mock LLM — deterministic plan for the demo path ───────────────────────
async function mock(messages: LlmMessage[], _tools: LlmToolSpec[]): Promise<LsResp> {
  const userText = messages.filter((m) => m.role === 'user').pop()?.content ?? '';
  const toolMsgs = messages.filter((m) => m.role === 'tool');
  const lastTool = toolMsgs[toolMsgs.length - 1];
  const lastName = lastTool?.name;

  // Simple state machine mirroring the happy path
  if (!lastName) {
    return {
      content: 'Drafting invoice from your prompt…',
      toolCalls: [{
        id: 't1',
        name: 'generate_invoice',
        arguments: { prompt: userText },
      }],
      finish: 'tool_calls',
    };
  }
  if (lastName === 'generate_invoice') {
    return {
      content: 'Validating…',
      toolCalls: [{ id: 't2', name: 'validate_invoice', arguments: {} }],
      finish: 'tool_calls',
    };
  }
  if (lastName === 'validate_invoice') {
    return {
      content: 'Storing on IPFS/Filecoin…',
      toolCalls: [{ id: 't3', name: 'store_on_ipfs', arguments: {} }],
      finish: 'tool_calls',
    };
  }
  if (lastName === 'store_on_ipfs') {
    return {
      content: 'Anchoring on-chain…',
      toolCalls: [{ id: 't4', name: 'anchor_on_chain', arguments: {} }],
      finish: 'tool_calls',
    };
  }
  if (lastName === 'anchor_on_chain') {
    return {
      content: 'Setting up payment…',
      toolCalls: [{
        id: 't5',
        name: 'request_payment',
        arguments: { rail: inferRail(userText) },
      }],
      finish: 'tool_calls',
    };
  }
  if (lastName === 'request_payment') {
    return {
      content: '✅ Invoice ready. Stored on IPFS, anchored on-chain, payment scheduled.',
      toolCalls: [],
      finish: 'stop',
    };
  }
  return { content: 'Done.', toolCalls: [], finish: 'stop' };
}

type LsResp = LlmResponse;

function inferRail(prompt: string): 'x402' | 'mpp' | 'erc8004' {
  const t = prompt.toLowerCase();
  if (t.includes('milestone') || t.includes('streaming') || t.includes('multi-part')) return 'mpp';
  if (t.includes('agent') || t.includes('auto') || t.includes('erc')) return 'erc8004';
  return 'x402';
}

// ─── OpenAI ─────────────────────────────────────────────────────────────────
async function openai(messages: LlmMessage[], tools: LlmToolSpec[]): Promise<LlmResponse> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.ai.apiKey}`,
    },
    body: JSON.stringify({
      model: env.ai.model,
      messages,
      tools: tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      tool_choice: 'auto',
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  const msg = data.choices[0].message;
  return {
    content: msg.content ?? '',
    toolCalls: (msg.tool_calls ?? []).map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || '{}'),
    })),
    finish: data.choices[0].finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
  };
}

// ─── Anthropic ──────────────────────────────────────────────────────────────
async function anthropic(messages: LlmMessage[], tools: LlmToolSpec[]): Promise<LlmResponse> {
  const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const conv = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }],
        };
      }
      return { role: m.role, content: m.content };
    });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ai.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.ai.model,
      max_tokens: 1024,
      system: sys,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
      messages: conv,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;

  let text = '';
  const calls: (ToolCall & { id: string })[] = [];
  for (const block of data.content ?? []) {
    if (block.type === 'text') text += block.text;
    if (block.type === 'tool_use') calls.push({ id: block.id, name: block.name, arguments: block.input });
  }
  return {
    content: text,
    toolCalls: calls,
    finish: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
  };
}

// ─── Ollama (no native tool-calling; use JSON-mode convention) ──────────────
async function ollama(messages: LlmMessage[], tools: LlmToolSpec[]): Promise<LlmResponse> {
  const sys =
    messages.find((m) => m.role === 'system')?.content ?? '' +
    `\n\nYou MUST respond with a single JSON object: { "content": string, "tool": { "name": string, "arguments": object } | null }. Available tools: ${JSON.stringify(tools.map((t) => ({ name: t.name, description: t.description })))}`;
  const convo = messages.filter((m) => m.role !== 'system');

  const res = await fetch(`${env.ai.endpoint || 'http://localhost:11434'}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.ai.model,
      messages: [{ role: 'system', content: sys }, ...convo],
      format: 'json',
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const data = (await res.json()) as any;
  try {
    const parsed = JSON.parse(data.message?.content ?? '{}');
    return {
      content: parsed.content ?? '',
      toolCalls: parsed.tool ? [{ id: 'ol1', name: parsed.tool.name, arguments: parsed.tool.arguments ?? {} }] : [],
      finish: parsed.tool ? 'tool_calls' : 'stop',
    };
  } catch {
    return { content: data.message?.content ?? '', toolCalls: [], finish: 'stop' };
  }
}

// ─── Gemini ─────────────────────────────────────────────────────────────────
async function gemini(messages: LlmMessage[], tools: LlmToolSpec[]): Promise<LlmResponse> {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: env.ai.apiKey });
  
  const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      if (m.role === 'tool') {
        let resultObj = m.content;
        try { resultObj = JSON.parse(m.content); } catch (e) {}
        return {
          role: 'user',
          parts: [{ functionResponse: { name: m.name || 'tool', response: typeof resultObj === 'object' ? resultObj : { result: resultObj } } }],
        };
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        return {
          role: 'model',
          parts: m.toolCalls.map(tc => tc.raw || {
            functionCall: { name: tc.name, args: tc.arguments }
          }),
        };
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      };
    });

  const response = await ai.models.generateContent({
    model: env.ai.model || 'gemini-1.5-flash',
    contents: contents as any,
    config: {
      systemInstruction: sys,
      tools: [{ functionDeclarations: tools as any }],
    },
  });

  let text = '';
  const calls: (ToolCall & { id: string })[] = [];
  const parts = response.candidates?.[0]?.content?.parts || [];
  
  for (const part of parts) {
    if (part.text) text += part.text;
    if (part.functionCall) {
      calls.push({
        id: `call_${Math.random().toString(36).substring(7)}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args as any,
        raw: part,
      } as any);
    }
  }

  return {
    content: text,
    toolCalls: calls,
    finish: calls.length > 0 ? 'tool_calls' : 'stop',
  };
}
