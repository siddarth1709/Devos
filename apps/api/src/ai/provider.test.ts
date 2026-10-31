import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaClient } from './ollama.js';
import { resolveAiConfig } from './config.js';
import { checkAiProviderStatus } from './health.js';

describe('AI Provider & Ollama Client Unit Tests', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('detects when Ollama server is running and lists models', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          { name: 'gemma4:latest', size: 9461576343, modified_at: '2026-10-31T00:00:00Z' },
          { name: 'gemma:2b', size: 1600000000, modified_at: '2026-10-30T00:00:00Z' },
        ],
      }),
    } as any);

    const client = new OllamaClient('http://127.0.0.1:11434');
    const result = await client.checkHealth();

    expect(result.running).toBe(true);
    expect(result.models.length).toBe(2);
    expect(result.models[0].name).toBe('gemma4:latest');
    expect(result.error).toBeUndefined();
  });

  it('detects when Ollama server is unavailable or offline', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:11434'));

    const client = new OllamaClient('http://127.0.0.1:11434');
    const result = await client.checkHealth();

    expect(result.running).toBe(false);
    expect(result.models).toEqual([]);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('handles Ollama server returning non-200 HTTP status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
    } as any);

    const client = new OllamaClient('http://127.0.0.1:11434');
    const result = await client.checkHealth();

    expect(result.running).toBe(false);
    expect(result.error).toContain('502');
  });

  it('correctly matches installed model names with and without tag variants', () => {
    const client = new OllamaClient('http://127.0.0.1:11434');
    const models = [
      { name: 'gemma4:latest' },
      { name: 'gemma:2b' },
      { name: 'codegemma:7b' },
    ];

    expect(client.isModelInstalled('gemma4', models)).toBe(true);
    expect(client.isModelInstalled('gemma4:latest', models)).toBe(true);
    expect(client.isModelInstalled('gemma:2b', models)).toBe(true);
    expect(client.isModelInstalled('gemma:7b', models)).toBe(false);
    expect(client.isModelInstalled('llama3', models)).toBe(false);
  });

  it('parses structured JSON generation successfully', async () => {
    const mockOutput = JSON.stringify({
      summary: 'Change adds validation',
      behavioralChanges: ['Added boundary check'],
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        response: mockOutput,
      }),
    } as any);

    const client = new OllamaClient('http://127.0.0.1:11434');
    const res = await client.generateStructured({
      model: 'gemma4:latest',
      prompt: 'Summarize changes',
    });

    expect(res.success).toBe(true);
    expect(res.parsed).toEqual({
      summary: 'Change adds validation',
      behavioralChanges: ['Added boundary check'],
    });
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('detects and reports malformed JSON from model output without crashing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        response: 'This is plain text, not valid JSON { broken: ',
      }),
    } as any);

    const client = new OllamaClient('http://127.0.0.1:11434');
    const res = await client.generateStructured({
      model: 'gemma4:latest',
      prompt: 'Summarize changes',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('invalid JSON');
    expect(res.response).toBe('This is plain text, not valid JSON { broken: ');
  });

  it('handles empty response string from model', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        response: '   ',
      }),
    } as any);

    const client = new OllamaClient('http://127.0.0.1:11434');
    const res = await client.generateStructured({
      model: 'gemma4:latest',
      prompt: 'Summarize changes',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Empty response');
  });

  it('handles generation request timeout via abort signal', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    global.fetch = vi.fn().mockRejectedValue(abortError);

    const client = new OllamaClient('http://127.0.0.1:11434');
    const res = await client.generateStructured({
      model: 'gemma4:latest',
      prompt: 'Summarize changes',
      timeoutMs: 100,
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('timed out');
  });

  it('handles provider HTTP 500 error during generation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'CUDA out of memory',
    } as any);

    const client = new OllamaClient('http://127.0.0.1:11434');
    const res = await client.generateStructured({
      model: 'gemma4:latest',
      prompt: 'Summarize changes',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('HTTP 500');
    expect(res.error).toContain('CUDA out of memory');
  });

  it('checkAiProviderStatus returns complete status report', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        models: [{ name: 'gemma4:e2b' }],
      }),
    } as any);

    const status = await checkAiProviderStatus({
      enabled: false,
      ollamaBaseUrl: 'http://127.0.0.1:11434',
      model: 'gemma4:e2b',
      timeoutMs: 5000,
      maxTokens: 2048,
      temperature: 0.1,
      contextLimitChars: 16000,
    });

    expect(status.enabled).toBe(false);
    expect(status.ollamaRunning).toBe(true);
    expect(status.modelInstalled).toBe(true);
    expect(status.configuredModel).toBe('gemma4:e2b');
    expect(status.installedModels).toEqual(['gemma4:e2b']);
  });
});

