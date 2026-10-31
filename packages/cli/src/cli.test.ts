import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { main } from './index.js';
import { runInit } from './commands/init.js';

describe('DEVOS CLI Unit Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), 'devos-cli-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('prints help and exits 0 on --help', async () => {
    const exitCode = await main(['--help']);
    expect(exitCode).toBe(0);
  });

  it('prints version and exits 0 on --version', async () => {
    const exitCode = await main(['--version']);
    expect(exitCode).toBe(0);
  });

  it('exits 2 on unknown command', async () => {
    const exitCode = await main(['nonexistent-command']);
    expect(exitCode).toBe(2);
  });

  it('exits 2 when status is missing analysis id', async () => {
    const exitCode = await main(['status']);
    expect(exitCode).toBe(2);
  });

  it('exits 2 when report is missing analysis id', async () => {
    const exitCode = await main(['report']);
    expect(exitCode).toBe(2);
  });

  it('exits 2 when guard is missing analysis id', async () => {
    const exitCode = await main(['guard']);
    expect(exitCode).toBe(2);
  });

  it('exits 2 when analyze is called on non-git directory', async () => {
    const exitCode = await main(['analyze', tempDir]);
    expect(exitCode).toBe(2);
  });

  it('exits 3 when attempting to connect to offline backend', async () => {
    const exitCode = await main([
      'health',
      '--api-url',
      'http://127.0.0.1:59999',
    ]);
    expect(exitCode).toBe(3);
  });

  it('initializes .devos.json configuration file', async () => {
    const exitCode = await runInit({ cwd: tempDir });
    expect(exitCode).toBe(0);

    const configPath = path.join(tempDir, '.devos.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(content.projectType).toBe('monorepo');
    expect(content.defaultBranch).toBe('main');
  });

  it('handles existing .devos.json gracefully', async () => {
    await runInit({ cwd: tempDir });
    const secondRun = await runInit({ cwd: tempDir, json: true });
    expect(secondRun).toBe(0);
  });
});
