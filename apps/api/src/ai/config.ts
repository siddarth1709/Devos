import { configSchema, AppConfig } from '../config.js';

export interface AiConfig {
  enabled: boolean;
  ollamaBaseUrl: string;
  model: string;
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
  contextLimitChars: number;
}

export function resolveAiConfig(appConfig: AppConfig): AiConfig {
  const enabledEnv = process.env.DEVOS_AI_ENABLED ?? process.env.AI_ENABLED;
  const isEnabled = enabledEnv !== undefined
    ? enabledEnv === 'true' || enabledEnv === '1'
    : false;

  const timeoutEnv = process.env.OLLAMA_TIMEOUT_MS;
  const timeoutMs = timeoutEnv ? parseInt(timeoutEnv, 10) : 30000;

  const maxTokensEnv = process.env.OLLAMA_MAX_TOKENS;
  const maxTokens = maxTokensEnv ? parseInt(maxTokensEnv, 10) : 2048;

  const temperatureEnv = process.env.OLLAMA_TEMPERATURE;
  const temperature = temperatureEnv ? parseFloat(temperatureEnv) : 0.1;

  const contextLimitEnv = process.env.OLLAMA_CONTEXT_LIMIT;
  const contextLimitChars = contextLimitEnv ? parseInt(contextLimitEnv, 10) : 16000;

  return {
    enabled: isEnabled,
    ollamaBaseUrl: appConfig.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    model: appConfig.GEMMA_MODEL || 'gemma4:e2b',
    timeoutMs,
    maxTokens,
    temperature,
    contextLimitChars,
  };
}

