import { DevosApiClient } from '../api.js';

export interface RiskOptions {
  analysisId: string;
  apiUrl?: string;
  json?: boolean;
}

export async function runRisk(options: RiskOptions): Promise<number> {
  if (!options.analysisId) {
    process.stderr.write('Error: Analysis ID is required. Usage: devos risk <analysisId>\n');
    return 2;
  }

  const client = new DevosApiClient(options.apiUrl);
  const data = await client.getRiskReport(options.analysisId);
  const assessment = data.assessment || data;

  if (options.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    return 0;
  }

  process.stdout.write(`\nDeterministic Risk Assessment: ${options.analysisId}\n`);
  process.stdout.write('--------------------------------------------------\n');
  process.stdout.write(`Score:      ${assessment.score}/100\n`);
  process.stdout.write(`Level:      ${assessment.level}\n`);
  process.stdout.write(`Confidence: ${assessment.confidence}%\n`);
  process.stdout.write(`Severity:   ${assessment.severity}/5\n`);
  process.stdout.write(`Likelihood: ${assessment.likelihood}/5\n\n`);

  if (assessment.factors && assessment.factors.length > 0) {
    process.stdout.write('Contributing Factors:\n');
    for (const f of assessment.factors) {
      process.stdout.write(`  • ${f.name} (+${f.weight})\n`);
    }
  }
  process.stdout.write('\n');
  return 0;
}

