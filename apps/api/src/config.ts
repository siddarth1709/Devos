import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(envPath: string) {
  try {
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch {
    // Ignore errors reading .env
  }
}

// Load env files if running outside test
if (process.env.NODE_ENV !== 'test') {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  loadEnvFile(path.resolve(process.cwd(), 'apps/api/.env'));
}

export const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().min(1).default('127.0.0.1'),
  DATABASE_URL: z.string().min(1).default('file:./dev.db'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  OLLAMA_BASE_URL: z.string().url().default('http://127.0.0.1:11434'),
  GEMMA_MODEL: z.string().min(1).default('gemma:2b'),
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  GITHUB_CALLBACK_URL: z.string().default('http://localhost:3001/api/auth/github/callback'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  SESSION_SECRET: z.string().default('devos-default-session-secret-key-32-chars-long'),
  DEVOS_DEMO_MODE: z
    .preprocess(
      (val) => val === 'true' || val === true || val === '1',
      z.boolean()
    )
    .default(false),
  ALLOWED_REPO_ROOT: z.string().default(process.cwd()),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(rawEnv: Record<string, string | undefined> = process.env): AppConfig {
  const result = configSchema.safeParse(rawEnv);

  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid application configuration:\n${errorDetails}`);
  }

  return result.data;
}

export const config = loadConfig();
