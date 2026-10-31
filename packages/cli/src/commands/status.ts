import { DevosApiClient } from '../api.js';

export interface StatusOptions {
  analysisId: string;
  apiUrl?: string;
  json?: boolean;
}

export async function runStatus(options: StatusOptions): Promise<number> {
  if (!options.analysisId) {
    process.stderr.write('Error: Analysis ID is required. Usage: devos status <id>\n');
    return 2;
  }

  const client = new DevosApiClient(options.apiUrl);
  const raw = await client.getAnalysis(options.analysisId);
  const analysis = raw?.job || raw;

  if (options.json) {
    process.stdout.write(JSON.stringify(raw, null, 2) + '\n');
    return 0;
  }

  process.stdout.write(`Analysis: ${analysis.id}\n`);
  process.stdout.write(`Repository: ${analysis.repositoryId}\n`);
  process.stdout.write(`Base Commit: ${analysis.baseSha}\n`);
  process.stdout.write(`Head Commit: ${analysis.headSha}\n`);
  process.stdout.write(`Status: ${(analysis.status || 'unknown').toUpperCase()}\n`);
  if (analysis.startedAt) {
    process.stdout.write(`Started: ${analysis.startedAt}\n`);
  }
  if (analysis.finishedAt) {
    process.stdout.write(`Finished: ${analysis.finishedAt}\n`);
  }
  if (analysis.error) {
    process.stdout.write(`Error: ${analysis.error}\n`);
  }

  return 0;
}
