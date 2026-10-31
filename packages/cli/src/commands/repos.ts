import { DevosApiClient } from '../api.js';

export interface ReposOptions {
  apiUrl?: string;
  json?: boolean;
}

export async function runRepos(options: ReposOptions): Promise<number> {
  const client = new DevosApiClient(options.apiUrl);
  const repos = await client.listRepositories();

  if (options.json) {
    process.stdout.write(JSON.stringify({ count: repos.length, repositories: repos }, null, 2) + '\n');
    return 0;
  }

  process.stdout.write(`\nDEVOS Registered Repositories (${repos.length})\n`);
  process.stdout.write('--------------------------------------------------\n');
  if (repos.length === 0) {
    process.stdout.write('No repositories registered yet. Use "devos connect <path>" to add one.\n');
  } else {
    for (const r of repos) {
      process.stdout.write(`• ${r.name.padEnd(25)} ${r.path}\n  ID: ${r.id}\n`);
    }
  }
  process.stdout.write('\n');
  return 0;
}

