import { AiConfig } from './config.js';
import { OllamaClient } from './ollama.js';
import { AiProviderStatus } from './types.js';

export async function checkAiProviderStatus(config: AiConfig): Promise<AiProviderStatus> {
  const client = new OllamaClient(config.ollamaBaseUrl);
  const health = await client.checkHealth(3000);

  const installedModels = health.models.map((m) => m.name);
  const modelInstalled = health.running
    ? client.isModelInstalled(config.model, health.models)
    : false;

  return {
    enabled: config.enabled,
    ollamaRunning: health.running,
    endpoint: config.ollamaBaseUrl,
    configuredModel: config.model,
    modelInstalled,
    installedModels,
    error: health.error ?? null,
  };
}

