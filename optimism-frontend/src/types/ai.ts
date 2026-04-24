export type AiProviderType = 'ollama' | 'lmstudio' | 'custom';

export type AiMode = 'auto' | 'summarize' | 'edit' | 'analyze' | 'format';

export interface AiProviderConfig {
  type: AiProviderType;
  endpoint: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[]; // base64 data URLs (e.g. "data:image/png;base64,...")
  timestamp: number;
  /** Present when this message represents a tool call + result (display only, not sent to AI). */
  toolCallInfo?: {
    name: string;
    parameters: Record<string, any>;
    result?: any;
    error?: string;
  };
}

export interface CellEditAction {
  coord: string;
  value: string | number;
  type: 'text' | 'value' | 'formula';
  formatting?: {
    fontColor?: string;
    bgColor?: string;
  };
}

export interface AiResponse {
  message: string;
  actions?: CellEditAction[];
}

export const DEFAULT_AI_CONFIG: AiProviderConfig = {
  type: 'ollama',
  endpoint: 'http://localhost:11434',
  model: 'llama3.1',
  temperature: 0.3,
};

export const PROVIDER_DEFAULTS: Record<AiProviderType, { endpoint: string; model: string }> = {
  ollama: { endpoint: 'http://localhost:11434', model: 'llama3.1' },
  lmstudio: { endpoint: 'http://localhost:1234', model: 'default' },
  custom: { endpoint: 'http://localhost:8080', model: '' },
};
