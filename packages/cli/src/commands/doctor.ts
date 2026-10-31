import { execSync } from 'node:child_process';
import { DevosApiClient } from '../api.js';

export interface DoctorOptions {
  apiUrl?: string;
  json?: boolean;
}

export async function runDoctor(options: DoctorOptions): Promise<number> {
  const client = new DevosApiClient(options.apiUrl);
  const checks: Record<string, { status: 'pass' | 'warn' | 'fail'; message: string }> = {};

  try {
    const health = await client.checkServerHealth();
    checks.api = { status: 'pass', message: `Connected to DEVOS API (${health.status})` };
  } catch (err: any) {
    checks.api = { status: 'fail', message: `Cannot connect to DEVOS API: ${err.message}` };
  }

  try {
    const gitVer = execSync('git --version', { encoding: 'utf-8' }).trim();
    checks.git = { status: 'pass', message: gitVer };
  } catch {
    checks.git = { status: 'fail', message: 'Git CLI not found in PATH' };
  }

  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags');
    if (res.ok) {
      checks.ollama = { status: 'pass', message: 'Ollama local inference runtime available' };
    } else {
      checks.ollama = { status: 'warn', message: 'Ollama returned non-200; AI layer will be disabled' };
    }
  } catch {
    checks.ollama = { status: 'warn', message: 'Ollama not detected; local AI layer will be disabled (deterministic engine active)' };
  }

  const hasFailures = Object.values(checks).some((c) => c.status === 'fail');

  if (options.json) {
    process.stdout.write(JSON.stringify({ checks, healthy: !hasFailures }, null, 2) + '\n');
    return hasFailures ? 1 : 0;
  }

  process.stdout.write('\nDEVOS System Doctor\n');
  process.stdout.write('--------------------------------------------------\n');
  for (const [key, check] of Object.entries(checks)) {
    const tag = check.status === 'pass' ? '[PASS]' : check.status === 'warn' ? '[WARN]' : '[FAIL]';
    process.stdout.write(`${tag.padEnd(8)} ${key.padEnd(10)}: ${check.message}\n`);
  }
  process.stdout.write('\n');

  return hasFailures ? 1 : 0;
}

