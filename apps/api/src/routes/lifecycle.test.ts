import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { execFileSync } from 'node:child_process';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { loadConfig } from '../config.js';
import { createRepository, createAnalysis, createInvestigation } from '../repo/index.js';

describe('Analysis Lifecycle and Completion State Transitions', () => {
  let app: FastifyInstance;
  let repoId: string;
  let repoRoot: string;

  beforeAll(async () => {
    repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    }).trim();

    const config = loadConfig({
      ...process.env,
      ALLOWED_REPO_ROOT: repoRoot,
    });
    app = await buildApp({ appConfig: config, logger: false });
    await app.ready();

    const repo = await createRepository({
      name: 'lifecycle-test-repo',
      path: repoRoot,
    });
    repoId = repo.id;
  });

  afterAll(async () => {
    await app.close();
    if (repoId) {
      await prisma.repository.deleteMany({
        where: { id: repoId },
      });
    }
  });

  it('rejects completion with 404 when analysis does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyses/non-existent-id/complete',
      payload: {},
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('rejects completion with 400 PREMATURE_COMPLETION when investigation records are empty', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha: '0000000000000000000000000000000000000001',
      headSha: '0000000000000000000000000000000000000002',
      status: 'running',
      startedAt: new Date(),
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysis.id}/complete`,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('PREMATURE_COMPLETION');
    expect(res.json().error.message).toContain('No pipeline stage records found');
  });

  it('rejects completion with 400 PREMATURE_COMPLETION when required pipeline stages are missing', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha: '0000000000000000000000000000000000000003',
      headSha: '0000000000000000000000000000000000000004',
      status: 'running',
      startedAt: new Date(),
    });

    await createInvestigation({
      analysisId: analysis.id,
      stage: 'git_ingestion_complete',
      status: 'completed',
      baseSha: analysis.baseSha,
      headSha: analysis.headSha,
      collector: 'test-collector',
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysis.id}/complete`,
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('PREMATURE_COMPLETION');
    expect(res.json().error.message).toContain('Missing required pipeline stages');
    expect(res.json().error.message).toContain('ast_extraction');
    expect(res.json().error.message).toContain('dependency_graph');
    expect(res.json().error.message).toContain('impact_analysis');
    expect(res.json().error.message).toContain('risk_analysis');
  });

  it('transitions to failed status when an upstream stage has failed', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha: '0000000000000000000000000000000000000005',
      headSha: '0000000000000000000000000000000000000006',
      status: 'running',
      startedAt: new Date(),
    });

    await createInvestigation({
      analysisId: analysis.id,
      stage: 'git_ingestion_complete',
      status: 'completed',
      baseSha: analysis.baseSha,
      headSha: analysis.headSha,
      collector: 'test-collector',
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    await createInvestigation({
      analysisId: analysis.id,
      stage: 'ast_extraction_failed',
      status: 'failed',
      baseSha: analysis.baseSha,
      headSha: analysis.headSha,
      collector: 'test-collector',
      startedAt: new Date(),
      finishedAt: new Date(),
      error: 'Parse error in source file',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysis.id}/complete`,
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.job.status).toBe('failed');
    expect(body.job.finishedAt).not.toBeNull();
    expect(body.report).toBeNull();

    const stored = await prisma.analysis.findUnique({ where: { id: analysis.id } });
    expect(stored?.status).toBe('failed');
  });

  it('transitions to partial status when an upstream stage is partial', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha: '0000000000000000000000000000000000000007',
      headSha: '0000000000000000000000000000000000000008',
      status: 'running',
      startedAt: new Date(),
    });

    await createInvestigation({
      analysisId: analysis.id,
      stage: 'git_ingestion_complete',
      status: 'completed',
      baseSha: analysis.baseSha,
      headSha: analysis.headSha,
      collector: 'test-collector',
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    await createInvestigation({
      analysisId: analysis.id,
      stage: 'ast_extraction_partial',
      status: 'completed',
      baseSha: analysis.baseSha,
      headSha: analysis.headSha,
      collector: 'test-collector',
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysis.id}/complete`,
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.job.status).toBe('partial');
    expect(body.job.finishedAt).not.toBeNull();

    const stored = await prisma.analysis.findUnique({ where: { id: analysis.id } });
    expect(stored?.status).toBe('partial');
  });

  it('transitions to completed status when all required stages completed successfully', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha: '0000000000000000000000000000000000000009',
      headSha: '0000000000000000000000000000000000000010',
      status: 'running',
      startedAt: new Date(),
    });

    await createInvestigation({
      analysisId: analysis.id,
      stage: 'git_ingestion_complete',
      status: 'completed',
      baseSha: analysis.baseSha,
      headSha: analysis.headSha,
      collector: 'test-collector',
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    await createInvestigation({
      analysisId: analysis.id,
      stage: 'ast_extraction_complete',
      status: 'completed',
      baseSha: analysis.baseSha,
      headSha: analysis.headSha,
      collector: 'test-collector',
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    await createInvestigation({
      analysisId: analysis.id,
      stage: 'dependency_graph_complete',
      status: 'completed',
      baseSha: analysis.baseSha,
      headSha: analysis.headSha,
      collector: 'test-collector',
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    await createInvestigation({
      analysisId: analysis.id,
      stage: 'impact_analysis_complete',
      status: 'completed',
      baseSha: analysis.baseSha,
      headSha: analysis.headSha,
      collector: 'test-collector',
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    await createInvestigation({
      analysisId: analysis.id,
      stage: 'risk_analysis_complete',
      status: 'completed',
      baseSha: analysis.baseSha,
      headSha: analysis.headSha,
      collector: 'test-collector',
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysis.id}/complete`,
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.job.status).toBe('completed');
    expect(body.job.finishedAt).not.toBeNull();

    const stored = await prisma.analysis.findUnique({ where: { id: analysis.id } });
    expect(stored?.status).toBe('completed');
  });

  it('preserves failed status across repeated completion calls without overwriting', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha: '0000000000000000000000000000000000000011',
      headSha: '0000000000000000000000000000000000000012',
      status: 'failed',
      startedAt: new Date(),
      finishedAt: new Date(),
      error: 'Unrecoverable error in AST parser',
    });

    const firstRes = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysis.id}/complete`,
      payload: {},
    });
    expect(firstRes.statusCode).toBe(200);
    expect(firstRes.json().job.status).toBe('failed');

    const secondRes = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysis.id}/complete`,
      payload: {},
    });
    expect(secondRes.statusCode).toBe(200);
    expect(secondRes.json().job.status).toBe('failed');

    const stored = await prisma.analysis.findUnique({ where: { id: analysis.id } });
    expect(stored?.status).toBe('failed');
  });

  it('preserves partial status across repeated completion calls without overwriting', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha: '0000000000000000000000000000000000000013',
      headSha: '0000000000000000000000000000000000000014',
      status: 'partial',
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    const firstRes = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysis.id}/complete`,
      payload: {},
    });
    expect(firstRes.statusCode).toBe(200);
    expect(firstRes.json().job.status).toBe('partial');

    const secondRes = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysis.id}/complete`,
      payload: {},
    });
    expect(secondRes.statusCode).toBe(200);
    expect(secondRes.json().job.status).toBe('partial');

    const stored = await prisma.analysis.findUnique({ where: { id: analysis.id } });
    expect(stored?.status).toBe('partial');
  });

  it('idempotently returns completed status on repeated completion calls', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha: '0000000000000000000000000000000000000015',
      headSha: '0000000000000000000000000000000000000016',
      status: 'completed',
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    const firstRes = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysis.id}/complete`,
      payload: {},
    });
    expect(firstRes.statusCode).toBe(200);
    expect(firstRes.json().job.status).toBe('completed');

    const secondRes = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysis.id}/complete`,
      payload: {},
    });
    expect(secondRes.statusCode).toBe(200);
    expect(secondRes.json().job.status).toBe('completed');
  });

  it('GET /api/analyses/:id returns running when running, and terminal status after completion', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha: '0000000000000000000000000000000000000017',
      headSha: '0000000000000000000000000000000000000018',
      status: 'running',
      startedAt: new Date(),
    });

    const beforeRes = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysis.id}`,
    });
    expect(beforeRes.statusCode).toBe(200);
    expect(beforeRes.json().job.status).toBe('running');
    expect(beforeRes.json().job.finishedAt).toBeNull();
    expect(beforeRes.json().report).toBeNull();

    await createInvestigation({
      analysisId: analysis.id,
      stage: 'git_ingestion_complete',
      status: 'completed',
      baseSha: analysis.baseSha,
      headSha: analysis.headSha,
      collector: 'test-collector',
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    await createInvestigation({
      analysisId: analysis.id,
      stage: 'ast_extraction_complete',
      status: 'completed',
      baseSha: analysis.baseSha,
      headSha: analysis.headSha,
      collector: 'test-collector',
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    await createInvestigation({
      analysisId: analysis.id,
      stage: 'dependency_graph_complete',
      status: 'completed',
      baseSha: analysis.baseSha,
      headSha: analysis.headSha,
      collector: 'test-collector',
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    await createInvestigation({
      analysisId: analysis.id,
      stage: 'impact_analysis_complete',
      status: 'completed',
      baseSha: analysis.baseSha,
      headSha: analysis.headSha,
      collector: 'test-collector',
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    await createInvestigation({
      analysisId: analysis.id,
      stage: 'risk_analysis_complete',
      status: 'completed',
      baseSha: analysis.baseSha,
      headSha: analysis.headSha,
      collector: 'test-collector',
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    const completeRes = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysis.id}/complete`,
      payload: {},
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.json().job.status).toBe('completed');

    const afterRes = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysis.id}`,
    });
    expect(afterRes.statusCode).toBe(200);
    expect(afterRes.json().job.status).toBe('completed');
    expect(afterRes.json().job.finishedAt).not.toBeNull();
  });

  it('direct POST /api/analyses synchronous execution completes to completed without separate completion request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha: 'HEAD~1',
        headSha: 'HEAD',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe('completed');
    expect(body.finishedAt).not.toBeNull();
    expect(body.startedAt).not.toBeNull();
    expect(body.error).toBeNull();

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/analyses/${body.id}`,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().job.status).toBe('completed');
    expect(getRes.json().job.finishedAt).not.toBeNull();
    expect(getRes.json().report).not.toBeNull();
  });
});
