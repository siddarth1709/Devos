import { ModelInfo } from './types.js';

export interface OllamaCheckResult {
  running: boolean;
  models: ModelInfo[];
  error?: string;
}

export interface OllamaGenerateOptions {
  model: string;
  prompt: string;
  system?: string;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
}

export interface OllamaGenerateResult {
  success: boolean;
  response?: string;
  parsed?: unknown;
  error?: string;
  durationMs?: number;
}

export class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async checkHealth(timeoutMs = 3000): Promise<OllamaCheckResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!res.ok) {
        return {
          running: false,
          models: [],
          error: `Ollama returned HTTP ${res.status}`,
        };
      }

      const data = (await res.json()) as { models?: Array<Record<string, unknown>> };
      const rawModels = Array.isArray(data.models) ? data.models : [];

      const models: ModelInfo[] = rawModels.map((m) => ({
        name: String(m.name || m.model || ''),
        size: typeof m.size === 'number' ? m.size : undefined,
        modifiedAt: typeof m.modified_at === 'string' ? m.modified_at : undefined,
        digest: typeof m.digest === 'string' ? m.digest : undefined,
        details: typeof m.details === 'object' && m.details !== null ? (m.details as Record<string, unknown>) : undefined,
      }));

      return {
        running: true,
        models,
      };
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError';
      return {
        running: false,
        models: [],
        error: isAbort ? 'Connection timed out' : (err?.message || 'Failed to connect to Ollama'),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  isModelInstalled(configuredModel: string, installedModels: ModelInfo[]): boolean {
    const cleanConfigured = configuredModel.trim().toLowerCase();
    const normalized = cleanConfigured.includes(':') ? cleanConfigured : `${cleanConfigured}:latest`;

    return installedModels.some((m) => {
      const candidate = m.name.toLowerCase();
      if (candidate === cleanConfigured || candidate === normalized) {
        return true;
      }
      if (candidate.startsWith(cleanConfigured + ':') || cleanConfigured.startsWith(candidate + ':')) {
        return true;
      }
      return false;
    });
  }

  async generateStructured(options: OllamaGenerateOptions): Promise<OllamaGenerateResult> {
    const {
      model,
      prompt,
      system,
      timeoutMs = 30000,
      temperature = 0.1,
      maxTokens = 2048,
    } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();

    try {
      const bodyPayload = {
        model,
        prompt,
        system,
        stream: false,
        format: 'json',
        options: {
          temperature,
          num_predict: maxTokens,
        },
      };

      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      const durationMs = Date.now() - start;

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        return {
          success: false,
          error: `Ollama error HTTP ${res.status}: ${errorText || res.statusText}`,
          durationMs,
        };
      }

      const json = (await res.json()) as { response?: string };
      const rawResponse = json.response;

      if (typeof rawResponse !== 'string' || !rawResponse.trim()) {
        return {
          success: false,
          error: 'Empty response returned from model',
          durationMs,
        };
      }

      try {
        const parsed = JSON.parse(rawResponse);
        return {
          success: true,
          response: rawResponse,
          parsed,
          durationMs,
        };
      } catch (err: any) {
        return {
          success: false,
          response: rawResponse,
          error: `Model generated invalid JSON: ${err?.message || 'Parse error'}`,
          durationMs,
        };
      }
    } catch (err: any) {
      const durationMs = Date.now() - start;
      const isAbort = err?.name === 'AbortError';
      return {
        success: false,
        error: isAbort ? `Request timed out after ${timeoutMs}ms` : (err?.message || 'Inference request failed'),
        durationMs,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

