import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { loadConfig } from '../config.js';
import { AiIntelligenceService } from './service.js';

describe('AI Routes & Intelligence Layer Integration Tests', () => {
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
    allowedParentDir = realpathSync(mkdtempSync(path.join(tmpdir(), 'devos-ai-intel-')));
    repoDir = path.join(allowedParentDir, 'sample-ai-repo');
    execFileSync('mkdir', ['-p', repoDir]);
    repoDir = realpathSync(repoDir);

    git(repoDir, 'init', '-q');
    git(repoDir, 'config', 'user.email', 'ai-tester@devos.dev');
    git(repoDir, 'config', 'user.name', 'Devos AI Tester');

    execFileSync('mkdir', ['-p', path.join(repoDir, 'src')]);
    writeFileSync(path.join(repoDir, 'src/calculator.ts'), 'export function calculateTotal(items: number[]) { return items.reduce((a, b) => a + b, 0); }\n');

    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-m', 'Initial commit');
    baseSha = git(repoDir, 'rev-parse', 'HEAD');

    writeFileSync(
      path.join(repoDir, 'src/calculator.ts'),
      'export function calculateTotal(items: number[]) { return items.reduce((a, b) => a + b, 0); }\nexport function calculateDiscount(total: number, percent: number) { return total * (percent / 100); }\n'
    );
    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-m', 'feat(calculator): add discount calculation');
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
        name: 'ai-test-repo',
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

  it('GET /api/ai/status reports AI status correctly without errors', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/ai/status',
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(typeof data.enabled).toBe('boolean');
    expect(typeof data.ollamaRunning).toBe('boolean');
    expect(typeof data.endpoint).toBe('string');
    expect(typeof data.configuredModel).toBe('string');
    expect(Array.isArray(data.installedModels)).toBe(true);
  });

  it('GET /api/analyses/:id/ai/status returns status within analysis scope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysisId}/ai/status`,
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.analysisId).toBe(analysisId);
    expect(typeof data.enabled).toBe('boolean');
  });

  it('returns 404 for non-existent analysis on AI endpoints', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyses/nonexistent-analysis-id/ai/review',
    });

    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('POST /api/analyses/:id/ai/review falls back to deterministic review when AI is disabled', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysisId}/ai/review`,
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(true);
    expect(data.fallback).toBeDefined();
    expect(data.notice).toContain('deterministic');
  });

  it('POST /api/analyses/:id/ai/risk-explanation does not alter stored deterministic risk assessment', async () => {
    const riskBefore = await prisma.riskAssessment.findUnique({
      where: { analysisId },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysisId}/ai/risk-explanation`,
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(true);
    expect(data.data.immutableRiskScore).toBe(riskBefore?.score ?? 0);
    expect(data.data.immutableRiskLevel).toBe(riskBefore?.level ?? 'unknown');
    expect(data.data.nonFailureProbabilityNotice).toContain('NOT an empirical failure probability');

    const riskAfter = await prisma.riskAssessment.findUnique({
      where: { analysisId },
    });

    expect(riskAfter?.score).toBe(riskBefore?.score);
    expect(riskAfter?.level).toBe(riskBefore?.level);
    expect(riskAfter?.factors).toBe(riskBefore?.factors);
  });

  it('POST /api/analyses/:id/ai/commit-message returns commit suggestions', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysisId}/ai/commit-message`,
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(true);
    expect(data.data.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(typeof data.data.suggestions[0].conventionalCommit).toBe('string');
  });

  it('POST /api/analyses/:id/ai/release-notes returns release note draft', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysisId}/ai/release-notes`,
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(true);
    expect(typeof data.data.markdown).toBe('string');
    expect(data.data.markdown).toContain('Release Notes');
  });

  it('POST /api/analyses/:id/ai/ask answers evidence-grounded questions', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysisId}/ai/ask`,
      payload: {
        question: 'Which file was changed in this commit?',
      },
    });

    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.success).toBe(true);
    expect(data.data.question).toBe('Which file was changed in this commit?');
    expect(typeof data.data.answer).toBe('string');
    expect(data.data.fileReferences).toContain('src/calculator.ts');
  });

  it('enabled AI service successfully runs with mocked Ollama responses', async () => {
    const mockService = new AiIntelligenceService({
      enabled: true,
      ollamaBaseUrl: 'http://127.0.0.1:11434',
      model: 'gemma4:e2b',
    });

    vi.spyOn(mockService, 'getStatus').mockResolvedValue({
      enabled: true,
      ollamaRunning: true,
      endpoint: 'http://127.0.0.1:11434',
      configuredModel: 'gemma4:e2b',
      modelInstalled: true,
      installedModels: ['gemma4:e2b'],
    });

    const clientSpy = vi.spyOn((mockService as any).client, 'generateStructured');
    clientSpy.mockResolvedValue({
      success: true,
      parsed: {
        summary: 'Added discount calculation logic to calculator module.',
        behavioralChanges: ['Introduced calculateDiscount function.'],
        reviewPriorities: ['Verify percentage math and edge cases like negative numbers.'],
        potentialRegressions: ['None identified for existing calculateTotal function.'],
        crossModuleConcerns: ['No consumers impacted yet.'],
        findings: [
          {
            id: 'mock-finding-1',
            title: 'New exported calculation API',
            description: 'calculateDiscount exported from calculator.ts',
            findingType: 'model_inference',
            severity: 'low',
            confidence: 'High',
            fileReferences: ['src/calculator.ts'],
            symbolReferences: ['calculateDiscount'],
            evidenceReferences: [],
          },
        ],
        missingEvidence: [],
        humanReviewQuestions: ['Is input sanitization expected for percentage bounds?'],
      },
    });

    const reviewRes = await mockService.reviewChanges(analysisId);
    expect(reviewRes.success).toBe(true);
    expect(reviewRes.aiEnabled).toBe(true);
    expect(reviewRes.data?.summary).toContain('discount calculation');
    expect(reviewRes.data?.findings[0].fileReferences).toContain('src/calculator.ts');

    clientSpy.mockRestore();
  });
});

