import { describe, it, expect } from 'vitest';
import { loadConfig, configSchema } from './config.js';

describe('Config Module', () => {
  it('loads default values successfully with empty raw environment', () => {
    const config = loadConfig({});
    expect(config.PORT).toBe(3001);
    expect(config.HOST).toBe('127.0.0.1');
    expect(config.DATABASE_URL).toBe('file:./dev.db');
    expect(config.LOG_LEVEL).toBe('info');
    expect(config.CORS_ORIGIN).toBe('http://localhost:3000');
    expect(config.OLLAMA_BASE_URL).toBe('http://127.0.0.1:11434');
    expect(config.GEMMA_MODEL).toBe('gemma:2b');
    expect(config.GITHUB_CLIENT_ID).toBe('');
    expect(config.GITHUB_CLIENT_SECRET).toBe('');
    expect(config.GITHUB_CALLBACK_URL).toBe('http://localhost:3001/api/auth/github/callback');
    expect(config.FRONTEND_URL).toBe('http://localhost:3000');
    expect(config.SESSION_SECRET).toBe('devos-default-session-secret-key-32-chars-long');
    expect(config.DEVOS_DEMO_MODE).toBe(false);
  });

  it('correctly parses and coerces valid custom environment variables', () => {
    const custom = loadConfig({
      PORT: '8080',
      HOST: '0.0.0.0',
      DATABASE_URL: 'file:./custom.db',
      LOG_LEVEL: 'debug',
      CORS_ORIGIN: 'http://localhost:5173',
      OLLAMA_BASE_URL: 'http://localhost:11434',
      GEMMA_MODEL: 'gemma2:9b',
    });

    expect(custom.PORT).toBe(8080);
    expect(custom.HOST).toBe('0.0.0.0');
    expect(custom.DATABASE_URL).toBe('file:./custom.db');
    expect(custom.LOG_LEVEL).toBe('debug');
    expect(custom.CORS_ORIGIN).toBe('http://localhost:5173');
    expect(custom.OLLAMA_BASE_URL).toBe('http://localhost:11434');
    expect(custom.GEMMA_MODEL).toBe('gemma2:9b');
  });

  it('fails fast with a clear error message on invalid PORT', () => {
    expect(() => loadConfig({ PORT: 'not-a-number' })).toThrowError(
      /Invalid application configuration:\s+- PORT:/
    );

    expect(() => loadConfig({ PORT: '70000' })).toThrowError(
      /Invalid application configuration:\s+- PORT:/
    );
  });

  it('fails fast with a clear error message on invalid OLLAMA_BASE_URL', () => {
    expect(() => loadConfig({ OLLAMA_BASE_URL: 'invalid-url' })).toThrowError(
      /Invalid application configuration:\s+- OLLAMA_BASE_URL:/
    );
  });

  it('fails fast on invalid LOG_LEVEL', () => {
    expect(() => loadConfig({ LOG_LEVEL: 'ultra-verbose' })).toThrowError(
      /Invalid application configuration:\s+- LOG_LEVEL:/
    );
  });
});

