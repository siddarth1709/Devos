import fs from 'node:fs';
import path from 'node:path';

export interface InitOptions {
  cwd?: string;
  json?: boolean;
}

export async function runInit(options: InitOptions = {}): Promise<number> {
  const targetDir = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const configPath = path.join(targetDir, '.devos.json');

  if (fs.existsSync(configPath)) {
    if (options.json) {
      process.stdout.write(JSON.stringify({ status: 'exists', configPath }) + '\n');
    } else {
      process.stdout.write(`Configuration file already exists at ${configPath}\n`);
    }
    return 0;
  }

  const repoName = path.basename(targetDir);
  const config = {
    repository: repoName,
    projectType: 'monorepo',
    defaultBranch: 'main',
    analysis: {
      engine: 'ast-fastify-next',
      exclude: ['node_modules', 'dist', '.next'],
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  if (options.json) {
    process.stdout.write(JSON.stringify({ status: 'created', configPath, config }) + '\n');
  } else {
    process.stdout.write(`Initialized DEVOS configuration at ${configPath}\n`);
  }

  return 0;
}
