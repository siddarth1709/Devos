import { DevosApiClient } from '../api.js';

export interface ActionsOptions {
  subcommand?: string;
  targetId?: string;
  apiUrl?: string;
  json?: boolean;
}

export async function runActions(options: ActionsOptions): Promise<number> {
  const subcommand = options.subcommand || 'list';
  const targetId = options.targetId;
  const client = new DevosApiClient(options.apiUrl);

  if (!targetId) {
    process.stderr.write('Error: Target ID is required. Usage: devos actions <list|approve|execute> <id>\n');
    return 2;
  }

  if (subcommand === 'list') {
    const data = await client.getActions(targetId);
    const actions = data.actions || [];
    if (options.json) {
      process.stdout.write(JSON.stringify(data, null, 2) + '\n');
      return 0;
    }
    process.stdout.write(`\nActions for Analysis: ${targetId} (${actions.length})\n`);
    process.stdout.write('--------------------------------------------------\n');
    if (actions.length === 0) {
      process.stdout.write('No actions proposed for this analysis.\n\n');
      return 0;
    }
    for (const a of actions) {
      process.stdout.write(`• [${a.status.toUpperCase()}] ${a.actionName} (ID: ${a.id})\n`);
      if (a.approvedBy) process.stdout.write(`  Approved by: ${a.approvedBy}\n`);
      if (a.error) process.stdout.write(`  Error: ${a.error}\n`);
    }
    process.stdout.write('\n');
    return 0;
  }

  if (subcommand === 'approve') {
    const res = await client.approveAction(targetId, {
      approvedBy: 'cli-user',
      reason: 'Approved via CLI',
    });
    if (options.json) {
      process.stdout.write(JSON.stringify(res, null, 2) + '\n');
      return 0;
    }
    process.stdout.write(`\nAction ${targetId} successfully approved.\n\n`);
    return 0;
  }

  if (subcommand === 'execute') {
    const res = await client.executeAction(targetId);
    if (options.json) {
      process.stdout.write(JSON.stringify(res, null, 2) + '\n');
      return 0;
    }
    process.stdout.write(`\nAction ${targetId} executed successfully.\n\n`);
    return 0;
  }

  process.stderr.write(`Unknown actions subcommand: "${subcommand}". Expected list, approve, or execute.\n`);
  return 2;
}

