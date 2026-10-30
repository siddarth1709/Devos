import { z } from 'zod';

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

