import { DevosApiClient } from '../api.js';

export interface ReviewOptions {
  analysisId: string;
  apiUrl?: string;
  json?: boolean;
}

export async function runReview(options: ReviewOptions): Promise<number> {
  if (!options.analysisId) {
    process.stderr.write('Error: Analysis ID is required. Usage: devos review <id>\n');
    return 2;
  }

  const client = new DevosApiClient(options.apiUrl);
  const review = await client.getChangeReview(options.analysisId);

  if (options.json) {
    process.stdout.write(JSON.stringify(review, null, 2) + '\n');
    return 0;
  }

  process.stdout.write('========================================\n');
  process.stdout.write(`DEVOS CHANGE REVIEW REPORT: ${options.analysisId}\n`);
  process.stdout.write('========================================\n\n');

  process.stdout.write(`Summary: ${review.summary}\n\n`);

  process.stdout.write('Verified Findings:\n');
  process.stdout.write(`  - Changed Files: ${review.verifiedFindings.changedFilesCount}\n`);
  process.stdout.write(`  - Changed Symbols: ${review.verifiedFindings.changedSymbolsCount}\n`);
  process.stdout.write(`  - Confirmed Direct Impacts: ${review.verifiedFindings.confirmedDirectImpacts}\n`);
  process.stdout.write(`  - Confirmed Transitive Impacts: ${review.verifiedFindings.confirmedTransitiveImpacts}\n`);
  process.stdout.write(`  - Max Confirmed Depth: ${review.verifiedFindings.maxConfirmedDepth}\n\n`);

  process.stdout.write('Uncertain Observations:\n');
  process.stdout.write(`  - Unresolved Dependencies: ${review.uncertainObservations.unresolvedDependenciesCount}\n`);
  process.stdout.write(`  - Ambiguous Dependencies: ${review.uncertainObservations.ambiguousDependenciesCount}\n`);
  process.stdout.write(`  - Uncertainty Penalty: ${review.uncertainObservations.uncertaintyAdjustment}\n\n`);

  if (review.suggestedReviewAreas.length > 0) {
    process.stdout.write('Suggested Review Areas:\n');
    for (const a of review.suggestedReviewAreas) {
      process.stdout.write(`  - [${a.priority.toUpperCase()}] ${a.targetKey} (${a.riskScore}/100): ${a.reason}\n`);
    }
    process.stdout.write('\n');
  }

  return 0;
}
