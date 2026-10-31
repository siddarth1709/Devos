import fs from 'node:fs';
import { DevosApiClient } from '../api.js';

export interface GuardOptions {
  analysisId: string;
  policyPath?: string;
  apiUrl?: string;
  json?: boolean;
}

export async function runGuard(options: GuardOptions): Promise<number> {
  if (!options.analysisId) {
    process.stderr.write('Error: Analysis ID is required. Usage: devos guard <id> [--policy <file>]\n');
    return 2;
  }

  let policy: Record<string, unknown> | undefined;
  if (options.policyPath) {
    if (!fs.existsSync(options.policyPath)) {
      process.stderr.write(`Error: Policy file not found: ${options.policyPath}\n`);
      return 2;
    }
    try {
      policy = JSON.parse(fs.readFileSync(options.policyPath, 'utf8'));
    } catch (err: any) {
      process.stderr.write(`Error: Failed to parse policy JSON: ${err.message}\n`);
      return 2;
    }
  }

  const client = new DevosApiClient(options.apiUrl);
  const evaluation = await client.evaluateReleaseGate(options.analysisId, policy);

  if (options.json) {
    process.stdout.write(JSON.stringify(evaluation, null, 2) + '\n');
  } else {
    process.stdout.write('========================================\n');
    process.stdout.write(`DEVOS RELEASE GATE EVALUATION: ${options.analysisId}\n`);
    process.stdout.write('========================================\n\n');
    process.stdout.write(`Gate Status: ${evaluation.gateStatus}\n`);
    process.stdout.write(`Result: ${evaluation.passed ? 'PASSED (Safe to Release)' : 'FAILED (Release Blocked)'}\n\n`);

    if (evaluation.blockingReasons && evaluation.blockingReasons.length > 0) {
      process.stdout.write('Blocking Reasons:\n');
      for (const reason of evaluation.blockingReasons) {
        process.stdout.write(`  [BLOCK] ${reason}\n`);
      }
      process.stdout.write('\n');
    }

    if (evaluation.warnings && evaluation.warnings.length > 0) {
      process.stdout.write('Warnings:\n');
      for (const warning of evaluation.warnings) {
        process.stdout.write(`  [WARN]  ${warning}\n`);
      }
      process.stdout.write('\n');
    }
  }

  return evaluation.passed ? 0 : 1;
}
