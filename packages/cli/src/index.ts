import { runAnalyze } from './commands/analyze.js';
import { runStatus } from './commands/status.js';
import { runReport } from './commands/report.js';
import { runReview } from './commands/review.js';
import { runHealth } from './commands/health.js';
import { runGuard } from './commands/guard.js';
import { runInit } from './commands/init.js';
import { runRepos } from './commands/repos.js';
import { runConnect } from './commands/connect.js';
import { runGraph } from './commands/graph.js';
import { runFindings } from './commands/findings.js';
import { runRisk } from './commands/risk.js';
import { runActions } from './commands/actions.js';
import { runAuth } from './commands/auth.js';
import { runDoctor } from './commands/doctor.js';
import { runConfig } from './commands/config.js';
import { DevosApiError } from './api.js';

export const VERSION = '0.1.0';

export function printHelp(): void {
  const help = `
DEVOS CLI - Software Change Intelligence Platform (v${VERSION})

USAGE:
  devos <command> [options]

COMMANDS:
  init [path]             Initialize .devos.json configuration in target repository
  login                   Authenticate CLI with DEVOS account via GitHub
  logout                  Log out of current session
  repos                   List all registered repositories
  connect <path> [name]   Connect and register a repository
  analyze [path]          Run full ingestion, AST, impact, and risk analysis on a repository
  status <id>             Get execution status and metadata for an analysis
  report <id>             Display comprehensive risk, blast radius, and impact report
  graph <id>              Display dependency graph nodes and edges
  review <id>             Display change review report with verified findings
  findings <id>           List deterministic and AI findings with decision status
  risk <id>               Display deterministic risk breakdown and contributing factors
  guard <id>              Evaluate configurable release gate policies
  actions <subcommand>    Manage secure actions (list <id>, approve <id>, execute <id>)
  config                  Display CLI configuration and API endpoints
  doctor                  Run diagnostic health checks on API, Git, and inference
  health [id]             Check API health or verify 10 pre-ship health checks for an analysis

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
    } else if (arg === '--token') {
      process.env.DEVOS_API_TOKEN = args[++i];
    } else if (arg.startsWith('--token=')) {
      process.env.DEVOS_API_TOKEN = arg.split('=')[1];
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
      case 'init': {
        const cwd = positional[1] || '.';
        return await runInit({ cwd, json });
      }
      case 'login': {
        return await runAuth({ action: 'login', apiUrl, json });
      }
      case 'logout': {
        return await runAuth({ action: 'logout', apiUrl, json });
      }
      case 'whoami': {
        return await runAuth({ action: 'whoami', apiUrl, json });
      }
      case 'repos': {
        return await runRepos({ apiUrl, json });
      }
      case 'connect': {
        const repoPath = positional[1] || '.';
        const name = positional[2];
        return await runConnect({ repoPath, name, apiUrl, json });
      }
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
      case 'graph': {
        const analysisId = positional[1];
        return await runGraph({ analysisId, apiUrl, json });
      }
      case 'review': {
        const analysisId = positional[1];
        return await runReview({ analysisId, apiUrl, json });
      }
      case 'findings': {
        const analysisId = positional[1];
        return await runFindings({ analysisId, apiUrl, json });
      }
      case 'risk': {
        const analysisId = positional[1];
        return await runRisk({ analysisId, apiUrl, json });
      }
      case 'guard': {
        const analysisId = positional[1];
        return await runGuard({ analysisId, policyPath, apiUrl, json });
      }
      case 'actions': {
        const subcommand = positional[1];
        const targetId = positional[2];
        return await runActions({ subcommand, targetId, apiUrl, json });
      }
      case 'config': {
        const key = positional[1];
        const value = positional[2];
        return await runConfig({ key, value, apiUrl, json });
      }
      case 'doctor': {
        return await runDoctor({ apiUrl, json });
      }
      case 'health': {
        const analysisId = positional[1];
        return await runHealth({ analysisId, apiUrl, json, gate });
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
