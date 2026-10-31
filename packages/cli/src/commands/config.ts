export interface ConfigOptions {
  key?: string;
  value?: string;
  apiUrl?: string;
  json?: boolean;
}

export async function runConfig(options: ConfigOptions): Promise<number> {
  const currentConfig = {
    apiUrl: options.apiUrl || process.env.DEVOS_API_URL || 'http://127.0.0.1:3000',
    ollamaUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    model: process.env.GEMMA_MODEL || 'gemma4:e2b',
    timeoutMs: 30000,
  };

  if (options.json) {
    process.stdout.write(JSON.stringify(currentConfig, null, 2) + '\n');
    return 0;
  }

  process.stdout.write('\nDEVOS Configuration\n');
  process.stdout.write('--------------------------------------------------\n');
  for (const [k, v] of Object.entries(currentConfig)) {
    process.stdout.write(`${k.padEnd(15)}: ${v}\n`);
  }
  process.stdout.write('\n');
  return 0;
}

