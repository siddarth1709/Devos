import { DevosApiClient } from '../api.js';

export interface FindingsOptions {
  analysisId: string;
  apiUrl?: string;
  json?: boolean;
}

export async function runFindings(options: FindingsOptions): Promise<number> {
  if (!options.analysisId) {
    process.stderr.write('Error: Analysis ID is required. Usage: devos findings <analysisId>\n');
    return 2;
  }

  const client = new DevosApiClient(options.apiUrl);
  const data = await client.getFindings(options.analysisId);
  const findings = data.findings || [];

  if (options.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
    return 0;
  }

  process.stdout.write(`\nFindings for Analysis: ${options.analysisId} (${findings.length})\n`);
  process.stdout.write('--------------------------------------------------\n');
  if (findings.length === 0) {
    process.stdout.write('No findings reported for this analysis.\n\n');
    return 0;
  }

  for (const f of findings) {
    process.stdout.write(`• [${f.severity.toUpperCase()}] ${f.title}\n`);
    process.stdout.write(`  Status: ${f.status} | Origin: ${f.origin} | Confidence: ${f.confidence}\n`);
    if (f.decision) {
      process.stdout.write(`  Decision: ${f.decision} by ${f.decisionActor || 'reviewer'}\n`);
    }
    process.stdout.write(`  ${f.description}\n\n`);
  }
  return 0;
}

