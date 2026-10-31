import { runAnalyze } from './commands/analyze.js';
import { runStatus } from './commands/status.js';
import { runReport } from './commands/report.js';
import { runReview } from './commands/review.js';
import { runHealth } from './commands/health.js';
import { runGuard } from './commands/guard.js';
import { runInit } from './commands/init.js';
import { DevosApiError } from './api.js';

export const VERSION = '0.1.0';

export function printHelp(): void {
  const help = `
DEVOS CLI - Software Change Intelligence Platform (v${VERSION})

USAGE:
  devos <command> [options]

COMMANDS:
  analyze [path]          Run full ingestion, AST, impact, and risk analysis on a repository
  status <id>             Get execution status and metadata for an analysis
  report <id>             Display comprehensive risk, blast radius, and impact report
  review <id>             Display change review report with verified findings
  health [id]             Check API health or verify 10 pre-ship health checks for an analysis
  guard <id>              Evaluate configurable release gate policies
  init [path]             Initialize .devos.json configuration in target repository

GLOBAL OPTIONS:
  -j, --json              Output results in structured JSON format
  --api-url <url>         Override DEVOS API base URL (default: http://127.0.0.1:3000)
  --base <sha>            Base commit SHA for analysis
  --head <sha>            Head commit SHA for analysis
  --gate                  Evaluate release gate and enforce exit code (1 on failure)
  --policy <file>         Path to custom release gate policy JSON file
  -h, --help              Show this help message
  -V, --version           Show CLI version

EXIT CODES:
  0                       Success / Safe to release / Clean
  1                       Quality Blocker / Gate Failed / Unsafe
  2                       Precondition / Usage Error
  3                       Backend API Offline / Connection Refused
`;
  process.stdout.write(help.trimStart() + '\n');
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  let json = false;
  let apiUrl: string | undefined;
  let baseSha: string | undefined;
  let headSha: string | undefined;
  let gate = false;
  let policyPath: string | undefined;

  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json' || arg === '-j') {
      json = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      return 0;
    } else if (arg === '--version' || arg === '-V' || arg === '-v') {
      process.stdout.write(`devos v${VERSION}\n`);
      return 0;
    } else if (arg === '--api-url') {
      apiUrl = args[++i];
    } else if (arg.startsWith('--api-url=')) {
      apiUrl = arg.split('=')[1];
    } else if (arg === '--base') {
      baseSha = args[++i];
    } else if (arg.startsWith('--base=')) {
      baseSha = arg.split('=')[1];
    } else if (arg === '--head') {
      headSha = args[++i];
    } else if (arg.startsWith('--head=')) {
      headSha = arg.split('=')[1];
    } else if (arg === '--gate') {
      gate = true;
    } else if (arg === '--policy') {
      policyPath = args[++i];
    } else if (arg.startsWith('--policy=')) {
      policyPath = arg.split('=')[1];
    } else {
      positional.push(arg);
    }
  }

  const command = positional[0] || 'help';

  try {
    switch (command) {
      case 'analyze': {
        const repoPath = positional[1] || '.';
        return await runAnalyze({
          repoPath,
          baseSha,
          headSha,
          apiUrl,
          json,
          gate,
          policyPath,
        });
      }
      case 'status': {
        const analysisId = positional[1];
        return await runStatus({ analysisId, apiUrl, json });
      }
      case 'report': {
        const analysisId = positional[1];
        return await runReport({ analysisId, apiUrl, json });
      }
      case 'review': {
        const analysisId = positional[1];
        return await runReview({ analysisId, apiUrl, json });
      }
      case 'health': {
        const analysisId = positional[1];
        return await runHealth({ analysisId, apiUrl, json, gate });
      }
      case 'guard': {
        const analysisId = positional[1];
        return await runGuard({ analysisId, policyPath, apiUrl, json });
      }
      case 'init': {
        const cwd = positional[1] || '.';
        return await runInit({ cwd, json });
      }
      case 'help': {
        printHelp();
        return 0;
      }
      default: {
        process.stderr.write(`Unknown command: "${command}". Run "devos --help" for available commands.\n`);
        return 2;
      }
    }
  } catch (err: any) {
    if (err instanceof DevosApiError) {
      if (json) {
        process.stdout.write(JSON.stringify({ error: err.message, exitCode: err.exitCode, data: err.data }) + '\n');
      } else {
        process.stderr.write(`Error: ${err.message}\n`);
      }
      return err.exitCode;
    }
    if (json) {
      process.stdout.write(JSON.stringify({ error: err.message || String(err), exitCode: 2 }) + '\n');
    } else {
      process.stderr.write(`Error: ${err.message || String(err)}\n`);
    }
    return 2;
  }
}
