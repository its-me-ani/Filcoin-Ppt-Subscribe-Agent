import { AiProviderConfig, DEFAULT_AI_CONFIG } from '../../types/ai';

const AI_SETTINGS_KEY = 'ai_provider_settings';

export function getAiSettings(): AiProviderConfig {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // Fall through to default
  }
  return { ...DEFAULT_AI_CONFIG };
}

export function saveAiSettings(config: Partial<AiProviderConfig>): void {
  const current = getAiSettings();
  const updated = { ...current, ...config };
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(updated));
}
