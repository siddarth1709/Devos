import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DevosApiClient, DevosApiError } from '../api.js';

export interface AnalyzeOptions {
  repoPath?: string;
  baseSha?: string;
  headSha?: string;
  apiUrl?: string;
  json?: boolean;
  gate?: boolean;
  policyPath?: string;
}

function runGit(cwd: string, ...args: string[]): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err: any) {
    throw new DevosApiError(`Git command failed (${args.join(' ')}): ${err.stderr || err.message}`, 2);
  }
}

export async function runAnalyze(options: AnalyzeOptions = {}): Promise<number> {
  const targetPath = path.resolve(options.repoPath || '.');

  if (!fs.existsSync(targetPath)) {
    process.stderr.write(`Error: Repository path does not exist: ${targetPath}\n`);
    return 2;
  }

  const isGit = runGit(targetPath, 'rev-parse', '--is-inside-work-tree');
  if (isGit !== 'true') {
    process.stderr.write(`Error: Target directory is not a Git repository: ${targetPath}\n`);
    return 2;
  }

  const resolvedHead = options.headSha ? runGit(targetPath, 'rev-parse', options.headSha) : runGit(targetPath, 'rev-parse', 'HEAD');

  let resolvedBase = options.baseSha;
  if (!resolvedBase) {
    try {
      resolvedBase = runGit(targetPath, 'rev-parse', 'HEAD~1');
    } catch {
      resolvedBase = resolvedHead;
    }
  } else {
    resolvedBase = runGit(targetPath, 'rev-parse', resolvedBase);
  }

  const client = new DevosApiClient(options.apiUrl);
  const repoName = path.basename(targetPath);

  const existingRepos = await client.listRepositories();
  let repo = existingRepos.find((r) => path.resolve(r.path) === targetPath || r.name === repoName);

  if (!repo) {
    repo = await client.createRepository(repoName, targetPath);
  }

  const analysis = await client.createAnalysis({
    repositoryId: repo.id,
    baseSha: resolvedBase,
    headSha: resolvedHead,
  });

  const [riskReport, healthReport, reviewReport] = await Promise.all([
    client.getRiskReport(analysis.id).catch(() => null),
    client.getHealthReport(analysis.id).catch(() => null),
    client.getChangeReview(analysis.id).catch(() => null),
  ]);

  let gateEvaluation: any = null;
  if (options.gate) {
    let policy: Record<string, unknown> | undefined;
    if (options.policyPath && fs.existsSync(options.policyPath)) {
      try {
        policy = JSON.parse(fs.readFileSync(options.policyPath, 'utf8'));
      } catch {
        policy = undefined;
      }
    }
    gateEvaluation = await client.evaluateReleaseGate(analysis.id, policy);
  }

  const finalAnalysis = analysis;

  if (options.json) {
    const payload = {
      analysis: finalAnalysis,
      risk: riskReport,
      health: healthReport,
      review: reviewReport,
      gate: gateEvaluation,
    };
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  } else {
    process.stdout.write('========================================\n');
    process.stdout.write(`DEVOS ANALYSIS COMPLETE: ${analysis.id}\n`);
    process.stdout.write('========================================\n\n');
    process.stdout.write(`Repository: ${repoName} (${repo.id})\n`);
    process.stdout.write(`Commit Range: ${resolvedBase.substring(0, 8)}..${resolvedHead.substring(0, 8)}\n`);
    process.stdout.write(`Lifecycle State: ${(finalAnalysis.status || 'completed').toUpperCase()}\n`);

    if (riskReport) {
      process.stdout.write(`Risk Evaluation: ${riskReport.score}/100 [${riskReport.level.toUpperCase()}] (Confidence: ${riskReport.confidence}%)\n`);
      process.stdout.write(`Blast Radius: ${riskReport.confirmedExposure?.distinctImpactedFiles ?? 0} files impacted (${riskReport.confirmedExposure?.directDependentsCount ?? 0} direct, ${riskReport.confirmedExposure?.transitiveDependentsCount ?? 0} transitive)\n`);
    }

    if (healthReport) {
      process.stdout.write(`Pre-Ship Health: ${healthReport.overallStatus} (${healthReport.passedCount}/${healthReport.totalChecks} checks passed)\n`);
    }

    if (gateEvaluation) {
      process.stdout.write(`Release Gate: ${gateEvaluation.gateStatus} (${gateEvaluation.passed ? 'PASSED' : 'FAILED'})\n`);
      if (!gateEvaluation.passed && gateEvaluation.blockingReasons) {
        for (const r of gateEvaluation.blockingReasons) {
          process.stdout.write(`  [BLOCK] ${r}\n`);
        }
      }
    }
    process.stdout.write('\n');
  }

  if (options.gate && gateEvaluation && !gateEvaluation.passed) {
    return 1;
  }

  return 0;
}
