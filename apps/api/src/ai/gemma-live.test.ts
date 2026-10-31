import { describe, it, expect } from 'vitest';
import { OllamaClient } from './ollama.js';

describe('Real Local Ollama & Gemma Live Integration', () => {
  const endpoint = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  const client = new OllamaClient(endpoint);

  it('runs real live inference when local Ollama runtime and model are available', async () => {
    const health = await client.checkHealth(2000);
    if (!health.running) {
      return;
    }

    if (health.models.length === 0) {
      return;
    }

    const targetModel = health.models[0].name;

    const res = await client.generateStructured({
      model: targetModel,
      prompt: 'Summarize code change in JSON with keys "summary" and "status": added user verification check to auth module.',
      system: 'Return valid JSON only matching schema: {"summary": string, "status": string}',
      timeoutMs: 45000,
      temperature: 0.1,
      maxTokens: 512,
    });

    expect(res.success).toBe(true);
    expect(res.parsed).toBeDefined();
    expect(typeof (res.parsed as any).summary).toBe('string');
  }, 60000);
});

