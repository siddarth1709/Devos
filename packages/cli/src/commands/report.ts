import { DevosApiClient } from '../api.js';

export interface ReportOptions {
  analysisId: string;
  apiUrl?: string;
  json?: boolean;
}

export async function runReport(options: ReportOptions): Promise<number> {
  if (!options.analysisId) {
    process.stderr.write('Error: Analysis ID is required. Usage: devos report <id>\n');
    return 2;
  }

  const client = new DevosApiClient(options.apiUrl);
  const risk = await client.getRiskReport(options.analysisId);
  const review = await client.getChangeReview(options.analysisId).catch(() => null);

  if (options.json) {
    process.stdout.write(JSON.stringify({ risk, review }, null, 2) + '\n');
    return 0;
  }

  process.stdout.write('========================================\n');
  process.stdout.write(`DEVOS RISK & IMPACT REPORT: ${options.analysisId}\n`);
  process.stdout.write('========================================\n\n');

  process.stdout.write(`Overall Risk Score: ${risk.score}/100 (${risk.level.toUpperCase()})\n`);
  process.stdout.write(`Confidence: ${risk.confidence}%\n`);
  process.stdout.write(`Severity: ${risk.severity}/100 | Likelihood: ${risk.likelihood}/100\n`);
  process.stdout.write(`Confirmed Exposure: ${risk.confirmedExposure?.directDependentsCount ?? 0} direct, ${risk.confirmedExposure?.transitiveDependentsCount ?? 0} transitive\n`);
  process.stdout.write(`Uncertainty Adjustment: ${risk.uncertaintyAdjustment ?? 0} (score: ${risk.uncertaintyScore ?? 0})\n\n`);

  if (risk.highestRiskTargets && risk.highestRiskTargets.length > 0) {
    process.stdout.write('Top Risk Components:\n');
    for (const t of risk.highestRiskTargets.slice(0, 5)) {
      process.stdout.write(`  - [${t.level.toUpperCase()}] ${t.targetKey} (score: ${t.score})\n`);
      for (const r of t.reasons.slice(0, 2)) {
        process.stdout.write(`      * ${r}\n`);
      }
    }
    process.stdout.write('\n');
  }

  if (review && review.suggestedReviewAreas && review.suggestedReviewAreas.length > 0) {
    process.stdout.write('Suggested Review Focus:\n');
    for (const a of review.suggestedReviewAreas.slice(0, 5)) {
      process.stdout.write(`  - ${a.targetKey} (${a.priority.toUpperCase()})\n`);
    }
    process.stdout.write('\n');
  }

  return 0;
}
