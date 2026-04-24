import { AiProviderConfig, ChatMessage } from '../../types/ai';
import { buildRequest, extractContent } from './ai-provider';

function isElectron(): boolean {
  return typeof window !== 'undefined' && window.electronAPI !== undefined;
}

export async function sendAiMessage(
  config: AiProviderConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  if (isElectron()) {
    // Electron IPC doesn't support AbortSignal natively; the caller handles
    // discarding the result when aborted.
    return window.electronAPI!.ai.sendMessage(config.type, config, messages);
  }
  return fetchDirect(config, messages, signal);
}

export async function testAiConnection(config: AiProviderConfig): Promise<boolean> {
  if (isElectron()) {
    return window.electronAPI!.ai.testConnection(config.type, config);
  }
  try {
    const endpoint = config.endpoint.replace(/\/+$/, '');
    const url = config.type === 'ollama'
      ? `${endpoint}/api/tags`
      : `${endpoint}/v1/models`;
    const headers: Record<string, string> = {};
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
    const res = await fetch(url, { headers });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listAiModels(config: AiProviderConfig): Promise<string[]> {
  if (isElectron()) {
    return window.electronAPI!.ai.listModels(config.type, config);
  }
  try {
    const endpoint = config.endpoint.replace(/\/+$/, '');
    if (config.type === 'ollama') {
      const res = await fetch(`${endpoint}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models ?? []).map((m: { name: string }) => m.name);
    } else {
      const headers: Record<string, string> = {};
      if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
      const res = await fetch(`${endpoint}/v1/models`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data ?? []).map((m: { id: string }) => m.id);
    }
  } catch {
    return [];
  }
}

async function fetchDirect(
  config: AiProviderConfig,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const req = buildRequest(config, messages);
  const response = await fetch(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(req.body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI provider error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return extractContent(config, data);
}
