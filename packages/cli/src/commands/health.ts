import { DevosApiClient } from '../api.js';

export interface HealthOptions {
  analysisId?: string;
  apiUrl?: string;
  json?: boolean;
  gate?: boolean;
}

export async function runHealth(options: HealthOptions): Promise<number> {
  const client = new DevosApiClient(options.apiUrl);

  if (!options.analysisId) {
    const serverHealth = await client.checkServerHealth();
    if (options.json) {
      process.stdout.write(JSON.stringify(serverHealth, null, 2) + '\n');
    } else {
      process.stdout.write(`DEVOS Server Health: ${serverHealth.status.toUpperCase()}\n`);
    }
    return serverHealth.status === 'ok' ? 0 : 1;
  }

  const healthReport = await client.getHealthReport(options.analysisId);

  if (options.json) {
    process.stdout.write(JSON.stringify(healthReport, null, 2) + '\n');
  } else {
    process.stdout.write('========================================\n');
    process.stdout.write(`DEVOS PRE-SHIP HEALTH REPORT: ${options.analysisId}\n`);
    process.stdout.write('========================================\n\n');
    process.stdout.write(`Overall Health Status: ${healthReport.overallStatus}\n`);
    process.stdout.write(`Summary: ${healthReport.passedCount} Passed, ${healthReport.warnedCount} Warned, ${healthReport.failedCount} Failed\n\n`);

    for (const check of healthReport.checks) {
      const tag = `[${check.status}]`.padEnd(8);
      process.stdout.write(`${tag} ${check.name}: ${check.message}\n`);
    }
    process.stdout.write('\n');
  }

  if (healthReport.overallStatus === 'UNHEALTHY') {
    return 1;
  }

  return 0;
}
