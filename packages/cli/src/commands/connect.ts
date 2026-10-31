import path from 'node:path';
import { DevosApiClient } from '../api.js';

export interface ConnectOptions {
  repoPath: string;
  name?: string;
  apiUrl?: string;
  json?: boolean;
}

export async function runConnect(options: ConnectOptions): Promise<number> {
  const absolutePath = path.resolve(options.repoPath || '.');
  const repoName = options.name || path.basename(absolutePath);
  const client = new DevosApiClient(options.apiUrl);

  const created = await client.createRepository(repoName, absolutePath);

  if (options.json) {
    process.stdout.write(JSON.stringify(created, null, 2) + '\n');
    return 0;
  }

  process.stdout.write(`\nSuccessfully connected repository "${created.name}"\n`);
  process.stdout.write(`ID:   ${created.id}\n`);
  process.stdout.write(`Path: ${created.path}\n\n`);
  return 0;
}

