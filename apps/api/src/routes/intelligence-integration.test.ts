import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { loadConfig } from '../config.js';

describe('Intelligence Routes Integration Tests', () => {
  let app: FastifyInstance;
  let allowedParentDir: string;
  let repoDir: string;
  let baseSha: string;
  let headSha: string;
  let repoId: string;
  let analysisId: string;

  function git(cmdRepo: string, ...args: string[]) {
    return execFileSync('git', args, { cwd: cmdRepo, encoding: 'utf8' }).trim();
  }

  beforeAll(async () => {
    allowedParentDir = realpathSync(mkdtempSync(path.join(tmpdir(), 'devos-intel-root-')));
    repoDir = path.join(allowedParentDir, 'sample-repo');
    execFileSync('mkdir', ['-p', repoDir]);
    repoDir = realpathSync(repoDir);

    git(repoDir, 'init', '-q');
    git(repoDir, 'config', 'user.email', 'intel-tester@devos.dev');
    git(repoDir, 'config', 'user.name', 'Devos Intel Tester');

    execFileSync('mkdir', ['-p', path.join(repoDir, 'src')]);
    writeFileSync(path.join(repoDir, 'src/math.ts'), 'export function sum(a: number, b: number) { return a + b; }\n');
    writeFileSync(path.join(repoDir, 'src/math.test.ts'), 'import { sum } from "./math.js";\n');

    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-m', 'Initial commit');
    baseSha = git(repoDir, 'rev-parse', 'HEAD');

    writeFileSync(
      path.join(repoDir, 'src/math.ts'),
      'export function sum(a: number, b: number) { return a + b + 0; }\nexport function multiply(a: number, b: number) { return a * b; }\n'
    );
    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-m', 'feat(math): add multiply function and tweak sum');
    headSha = git(repoDir, 'rev-parse', 'HEAD');

    app = await buildApp({
      logger: false,
      appConfig: loadConfig({
        ALLOWED_REPO_ROOT: allowedParentDir,
      }),
    });
    await app.ready();

    const regRes = await app.inject({
      method: 'POST',
      url: '/api/repositories',
      payload: {
        name: 'intelligence-test-repo',
        path: repoDir,
      },
    });
    expect(regRes.statusCode).toBe(201);
    repoId = JSON.parse(regRes.body).id;

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha,
        headSha,
      },
    });

    expect(createRes.statusCode).toBe(201);
    const body = JSON.parse(createRes.body);
    analysisId = body.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (allowedParentDir) {
      rmSync(allowedParentDir, { recursive: true, force: true });
    }
  });

  it('GET /api/analyses/:id/review returns change review report', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysisId}/review`,
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.analysisId).toBe(analysisId);
    expect(data.verifiedFindings.changedFilesCount).toBeGreaterThanOrEqual(1);
    expect(data.riskEvaluation).toBeDefined();
    expect(Array.isArray(data.suggestedReviewAreas)).toBe(true);
  });

  it('GET /api/analyses/:id/commit-message returns structured commit assistant output', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysisId}/commit-message`,
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(typeof data.conventionalMessage).toBe('string');
    expect(typeof data.type).toBe('string');
    expect(Array.isArray(data.bullets)).toBe(true);
  });

  it('GET /api/analyses/:id/release-notes returns markdown and structured release notes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysisId}/release-notes`,
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.analysisId).toBe(analysisId);
    expect(typeof data.markdown).toBe('string');
    expect(data.markdown).toContain('# Release Notes');
    expect(data.structured.blastRadius).toBeDefined();
  });

  it('GET /api/analyses/:id/health returns pre-ship health evaluation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysisId}/health`,
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.analysisId).toBe(analysisId);
    expect(data.totalChecks).toBe(10);
    expect(data.overallStatus).toBeDefined();
    expect(Array.isArray(data.checks)).toBe(true);
  });

  it('POST /api/analyses/:id/health/gate evaluates release gate policy', async () => {
    const passRes = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysisId}/health/gate`,
      payload: {
        policy: {
          maxRiskScore: 90,
          minConfidence: 30,
        },
      },
    });

    expect(passRes.statusCode).toBe(200);
    const passData = JSON.parse(passRes.body);
    expect(passData.passed).toBe(true);
    expect(['PASSED', 'WARNED']).toContain(passData.gateStatus);

    const failRes = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysisId}/health/gate`,
      payload: {
        policy: {
          maxRiskScore: 0,
        },
      },
    });

    expect(failRes.statusCode).toBe(200);
    const failData = JSON.parse(failRes.body);
    expect(failData.passed).toBe(false);
    expect(failData.gateStatus).toBe('FAILED');
    expect(failData.blockingReasons.length).toBeGreaterThan(0);
  });

  it('returns 404 for nonexistent analysis', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/analyses/nonexistent-id/health',
    });

    expect(res.statusCode).toBe(404);
  });
});
