import { ipcMain } from 'electron';

interface AiConfig {
  type: string;
  endpoint: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[]; // base64 data URLs
}

function buildOllamaRequest(config: AiConfig, messages: ChatMessage[]) {
  return {
    url: `${config.endpoint}/api/chat`,
    body: {
      model: config.model,
      messages: messages.map(m => {
        const msg: Record<string, any> = { role: m.role, content: m.content };
        if (m.images && m.images.length > 0) {
          // Ollama expects raw base64 (no data URL prefix)
          msg.images = m.images.map(img => {
            const comma = img.indexOf(',');
            return comma >= 0 ? img.slice(comma + 1) : img;
          });
        }
        return msg;
      }),
      stream: false,
      options: {
        temperature: config.temperature ?? 0.3,
        ...(config.maxTokens ? { num_predict: config.maxTokens } : {}),
      },
    },
  };
}

function buildOpenAICompatibleRequest(config: AiConfig, messages: ChatMessage[]) {
  const endpoint = config.endpoint.replace(/\/+$/, '');
  return {
    url: `${endpoint}/v1/chat/completions`,
    body: {
      model: config.model,
      messages: messages.map(m => {
        if (m.images && m.images.length > 0) {
          // OpenAI vision format: content is an array of parts
          const parts: any[] = [];
          if (m.content) parts.push({ type: 'text', text: m.content });
          for (const img of m.images) {
            parts.push({ type: 'image_url', image_url: { url: img } });
          }
          return { role: m.role, content: parts };
        }
        return { role: m.role, content: m.content };
      }),
      stream: false,
      temperature: config.temperature ?? 0.3,
      ...(config.maxTokens ? { max_tokens: config.maxTokens } : {}),
    },
    headers: config.apiKey
      ? { Authorization: `Bearer ${config.apiKey}` }
      : {},
  };
}

async function sendToProvider(config: AiConfig, messages: ChatMessage[]): Promise<string> {
  let url: string;
  let body: object;
  let extraHeaders: Record<string, string> = {};

  if (config.type === 'ollama') {
    const req = buildOllamaRequest(config, messages);
    url = req.url;
    body = req.body;
  } else {
    // lmstudio and custom both use OpenAI-compatible API
    const req = buildOpenAICompatibleRequest(config, messages);
    url = req.url;
    body = req.body;
    extraHeaders = req.headers;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI provider error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Ollama returns { message: { content: "..." } }
  if (config.type === 'ollama') {
    return data.message?.content ?? '';
  }
  // OpenAI-compatible returns { choices: [{ message: { content: "..." } }] }
  return data.choices?.[0]?.message?.content ?? '';
}

export function registerAiHandlers() {
  ipcMain.handle('ai:send-message', async (_event, _provider: string, config: AiConfig, messages: ChatMessage[]) => {
    return sendToProvider(config, messages);
  });

  ipcMain.handle('ai:test-connection', async (_event, _provider: string, config: AiConfig) => {
    try {
      const endpoint = config.endpoint.replace(/\/+$/, '');
      if (config.type === 'ollama') {
        const res = await fetch(`${endpoint}/api/tags`);
        return res.ok;
      } else {
        const res = await fetch(`${endpoint}/v1/models`, {
          headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
        });
        return res.ok;
      }
    } catch {
      return false;
    }
  });

  ipcMain.handle('ai:list-models', async (_event, _provider: string, config: AiConfig) => {
    const endpoint = config.endpoint.replace(/\/+$/, '');
    if (config.type === 'ollama') {
      const res = await fetch(`${endpoint}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models ?? []).map((m: { name: string }) => m.name);
    } else {
      const res = await fetch(`${endpoint}/v1/models`, {
        headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data ?? []).map((m: { id: string }) => m.id);
    }
  });
}
