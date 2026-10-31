import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { loadConfig } from '../config.js';
import { createAnalysis, createInvestigation } from '../repo/index.js';
import { persistRiskAssessment, validateRiskProvenance } from '../risk/index.js';

describe('Deterministic Risk Engine Integration Tests', () => {
  let app: FastifyInstance;
  let allowedParentDir: string;
  let repoDir: string;
  let baseSha: string;
  let headSha: string;
  let headSha2: string;
  let emptySha: string;
  let repoId: string;

  function git(cmdRepo: string, ...args: string[]) {
    return execFileSync('git', args, { cwd: cmdRepo, encoding: 'utf8' }).trim();
  }

  beforeAll(async () => {
    allowedParentDir = realpathSync(mkdtempSync(path.join(tmpdir(), 'devos-risk-root-')));
    repoDir = path.join(allowedParentDir, 'risk-sample-repo');
    execFileSync('mkdir', ['-p', repoDir]);
    repoDir = realpathSync(repoDir);

    git(repoDir, 'init', '-q');
    git(repoDir, 'config', 'user.email', 'risk-tester@devos.dev');
    git(repoDir, 'config', 'user.name', 'Devos Risk Tester');

    writeFileSync(path.join(repoDir, 'base.ts'), 'export const baseFlag = 1;\n');

    execFileSync('mkdir', ['-p', path.join(repoDir, 'src')]);

    writeFileSync(
      path.join(repoDir, 'src/math.ts'),
      `export function add(a: number, b: number): number { return a + b; }\n`
    );

    writeFileSync(
      path.join(repoDir, 'src/reexports.ts'),
      `export { add } from './math.js';\n`
    );

    writeFileSync(
      path.join(repoDir, 'src/consumer.ts'),
      `import { add } from './reexports.js';\nexport function calc(): number { return add(1, 2); }\n`
    );

    writeFileSync(
      path.join(repoDir, 'src/standalone.ts'),
      `export const standaloneVal = 42;\n`
    );

    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-q', '-m', 'Initial baseline');
    baseSha = git(repoDir, 'rev-parse', 'HEAD');

    git(repoDir, 'commit', '--allow-empty', '-q', '-m', 'Empty commit');
    emptySha = git(repoDir, 'rev-parse', 'HEAD');

    writeFileSync(
      path.join(repoDir, 'src/math.ts'),
      `export function add(a: number, b: number): number { return a + b + 1; }\n`
    );
    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-q', '-m', 'Modified math.ts');
    headSha = git(repoDir, 'rev-parse', 'HEAD');

    writeFileSync(
      path.join(repoDir, 'src/standalone.ts'),
      `export const standaloneVal = 100;\n`
    );
    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-q', '-m', 'Modified standalone.ts');
    headSha2 = git(repoDir, 'rev-parse', 'HEAD');

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
        name: 'risk-sample-repo',
        path: repoDir,
      },
    });
    expect(regRes.statusCode).toBe(201);
    repoId = JSON.parse(regRes.body).id;
  });

  afterAll(async () => {
    if (app) await app.close();
    if (allowedParentDir) {
      rmSync(allowedParentDir, { recursive: true, force: true });
    }
    if (repoId) {
      await prisma.repository.deleteMany({ where: { id: repoId } });
    }
  });

  it('runs risk analysis automatically during POST /api/analyses and persists report', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha,
        headSha,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    const analysisId = body.id;

    const riskRes = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysisId}/risk`,
    });

    expect(riskRes.statusCode).toBe(200);
    const report = JSON.parse(riskRes.body);

    expect(report.analysisId).toBe(analysisId);
    expect(report.repositoryId).toBe(repoId);
    expect(report.commitSha).toBe(headSha);
    expect(report.modelVersion).toBe('v1.1.0-deterministic');
    expect(report.score).toBeGreaterThan(0);
    expect(typeof report.severity).toBe('number');
    expect(typeof report.likelihood).toBe('number');
    expect(typeof report.confidence).toBe('number');
    expect(report.confirmedExposure).toBeDefined();
    expect(report.potentialExposure).toBeDefined();
    expect(report.factors.length).toBeGreaterThan(0);
    expect(report.highestRiskTargets.length).toBeGreaterThan(0);
    expect(report.missingEvidence.length).toBeGreaterThan(0);

    const inv = await prisma.investigation.findFirst({
      where: {
        analysisId,
        stage: { in: ['risk_analysis_complete', 'risk_analysis_partial'] },
      },
    });
    expect(inv).not.toBeNull();
    expect(inv?.collector).toBe('deterministic-risk-engine');
  });

  it('evaluates verified empty diff as zero risk with 100 confidence', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha,
        headSha: emptySha,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    const analysisId = body.id;

    const riskRes = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysisId}/risk`,
    });

    expect(riskRes.statusCode).toBe(200);
    const report = JSON.parse(riskRes.body);

    expect(report.score).toBe(0);
    expect(report.level).toBe('low');
    expect(report.confidence).toBe(100);
    expect(report.stage).toBe('risk_analysis_complete');
    expect(report.confirmedExposure.directDependentsCount).toBe(0);
  });

  it('fails risk analysis when Git ingestion failed', async () => {
    const failedGitAnalysis = await createAnalysis({
      repositoryId: repoId,
      baseSha,
      headSha,
    });

    await createInvestigation({
      analysisId: failedGitAnalysis.id,
      stage: 'git_ingestion_failed',
      status: 'failed',
      startedAt: new Date(),
      finishedAt: new Date(),
      error: 'Simulated git ingestion failure',
      baseSha,
      headSha,
      collector: 'test-harness',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/analyses/${failedGitAnalysis.id}/risk`,
    });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('RISK_ANALYSIS_FAILED');

    const inv = await prisma.investigation.findFirst({
      where: { analysisId: failedGitAnalysis.id, stage: 'risk_analysis_failed' },
    });
    expect(inv).not.toBeNull();
  });

  it('retrieves component-level risk assessment with full provenance via GET /api/analyses/:id/risk/targets/:targetKey', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha,
        headSha,
      },
    });

    const body = JSON.parse(res.body);
    const analysisId = body.id;

    const targetKey = encodeURIComponent('file:src/math.ts');
    const targetRes = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysisId}/risk/targets/${targetKey}`,
    });

    expect(targetRes.statusCode).toBe(200);
    const target = JSON.parse(targetRes.body);

    expect(target.targetKey).toBe('file:src/math.ts');
    expect(target.targetType).toBe('file');
    expect(target.score).toBeGreaterThan(0);
    expect(target.level).toBeDefined();
    expect(target.isConfirmed).toBe(true);
    expect(target.reasons.length).toBeGreaterThan(0);
    expect(target.evidence.edgeKeys).toBeDefined();
    expect(target.evidence.scoringSignals).toBeDefined();
    expect(target.evidence.sourceChangeFile).toBe('src/math.ts');
  });

  it('14. fails when impact report has not been generated and does not produce clean zero-risk', async () => {
    const emptyAnalysis = await createAnalysis({
      repositoryId: repoId,
      baseSha,
      headSha,
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/analyses/${emptyAnalysis.id}/risk`,
    });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('RISK_ANALYSIS_FAILED');

    const inv = await prisma.investigation.findFirst({
      where: { analysisId: emptyAnalysis.id, stage: 'risk_analysis_failed' },
    });
    expect(inv).not.toBeNull();
    expect(inv?.status).toBe('failed');
  });

  it('15. fails risk analysis when prior impact analysis stage failed', async () => {
    const failedAnalysis = await createAnalysis({
      repositoryId: repoId,
      baseSha,
      headSha,
    });

    await createInvestigation({
      analysisId: failedAnalysis.id,
      stage: 'impact_analysis_failed',
      status: 'failed',
      startedAt: new Date(),
      finishedAt: new Date(),
      error: 'Simulated impact failure',
      baseSha,
      headSha,
      collector: 'test-harness',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/analyses/${failedAnalysis.id}/risk`,
    });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('RISK_ANALYSIS_FAILED');

    const inv = await prisma.investigation.findFirst({
      where: { analysisId: failedAnalysis.id, stage: 'risk_analysis_failed' },
    });
    expect(inv).not.toBeNull();
    expect(inv?.status).toBe('failed');
  });

  it('20. enforces idempotent persistence without duplicate risk records', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha,
        headSha,
      },
    });

    const body = JSON.parse(res.body);
    const analysisId = body.id;

    const post1 = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysisId}/risk`,
    });
    expect(post1.statusCode).toBe(200);

    const post2 = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysisId}/risk`,
    });
    expect(post2.statusCode).toBe(200);

    const assessmentCount = await prisma.riskAssessment.count({
      where: { analysisId },
    });
    expect(assessmentCount).toBe(1);
  });

  it('21. isolates risk assessments between different analyses on the same repository', async () => {
    const resA = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha,
        headSha,
      },
    });
    const analysisIdA = JSON.parse(resA.body).id;

    const resB = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha,
        headSha: headSha2,
      },
    });
    const analysisIdB = JSON.parse(resB.body).id;

    const reportA = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysisIdA}/risk`,
    });
    const reportB = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysisIdB}/risk`,
    });

    const jsonA = JSON.parse(reportA.body);
    const jsonB = JSON.parse(reportB.body);

    expect(jsonA.analysisId).toBe(analysisIdA);
    expect(jsonB.analysisId).toBe(analysisIdB);
    expect(jsonA.commitSha).toBe(headSha);
    expect(jsonB.commitSha).toBe(headSha2);
    expect(jsonA.highestRiskTargets).not.toEqual(jsonB.highestRiskTargets);
  });

  it('22. isolates historical commits when evaluating different commit SHAs', async () => {
    const records = await prisma.riskAssessment.findMany({
      where: { repositoryId: repoId },
    });

    const commits = new Set(records.map((r) => r.commitSha));
    expect(commits.has(headSha)).toBe(true);
    expect(commits.has(headSha2)).toBe(true);
  });

  it('23. rolls back transaction on persistence failure without leaving corrupt state', async () => {
    const badReport: any = {
      analysisId: 'anl_nonexistent_test',
      repositoryId: repoId,
      commitSha: headSha,
      modelVersion: 'v1.1.0-deterministic',
      score: 50,
      level: 'medium',
      severity: 50,
      likelihood: 50,
      confidence: 80,
      evidenceCompleteness: 80,
      factors: [],
      highestRiskTargets: [
        {
          targetKey: '',
          targetType: 'file',
          score: 50,
        },
      ],
      limitations: [],
      missingEvidence: [],
      metadata: {},
      timestamp: new Date().toISOString(),
      stage: 'risk_analysis_complete',
    };

    expect(() => validateRiskProvenance(badReport)).toThrow();

    await expect(
      persistRiskAssessment(
        {
          ...badReport,
          highestRiskTargets: [
            {
              targetKey: 'file:test.ts',
              targetType: 'file',
              targetFile: 'test.ts',
              targetSymbol: null,
              score: 50,
              level: 'medium',
              severity: 50,
              likelihood: 50,
              confidence: 80,
              isConfirmed: true,
              reasons: [],
              evidence: { impactPaths: [], edgeKeys: [], classification: 'changed', depth: 0 },
              unresolvedLimitations: [],
            },
          ],
        },
        baseSha,
        new Date(),
        {
          $transaction: async () => {
            throw new Error('Forced transaction failure');
          },
        } as any
      )
    ).rejects.toThrow('Forced transaction failure');

    const orphaned = await prisma.riskAssessment.findUnique({
      where: { analysisId: 'anl_nonexistent_test' },
    });
    expect(orphaned).toBeNull();
  });

  it('returns 404 for missing analysis or missing risk target', async () => {
    const missingRes = await app.inject({
      method: 'GET',
      url: '/api/analyses/missing-id/risk',
    });
    expect(missingRes.statusCode).toBe(404);

    const validRes = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha,
        headSha,
      },
    });
    const analysisId = JSON.parse(validRes.body).id;

    const missingTargetRes = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysisId}/risk/targets/${encodeURIComponent('file:missing.ts')}`,
    });
    expect(missingTargetRes.statusCode).toBe(404);
  });

  it('downgrades impact results and prevents confirmation when edge keys are not in persisted graph records', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha,
      headSha,
      status: 'completed',
    });

    await prisma.changedFile.create({
      data: {
        analysisId: analysis.id,
        path: 'src/math.ts',
        changeType: 'modified',
        baseSha,
        headSha,
        collector: 'git',
      },
    });

    await prisma.impactResult.create({
      data: {
        analysisId: analysis.id,
        repositoryId: repoId,
        commitSha: headSha,
        resultKey: 'res_invalid_edge',
        targetKey: 'file:src/downstream.ts',
        targetType: 'file',
        targetFile: 'src/downstream.ts',
        sourceChangeKey: 'file:src/math.ts',
        sourceChangeFile: 'src/math.ts',
        classification: 'direct',
        depth: 1,
        path: JSON.stringify(['file:src/math.ts', 'file:src/downstream.ts']),
        relationshipTypes: JSON.stringify(['imports_module']),
        edgeKeys: JSON.stringify(['edge_does_not_exist']),
        resolutionStatus: 'resolved',
        collector: 'change-impact-analyzer',
      },
    });

    await createInvestigation({
      analysisId: analysis.id,
      stage: 'git_ingestion_complete',
      status: 'completed',
      startedAt: new Date(),
      finishedAt: new Date(),
      baseSha,
      headSha,
      collector: 'git',
    });

    await createInvestigation({
      analysisId: analysis.id,
      stage: 'ast_extraction_complete',
      status: 'completed',
      startedAt: new Date(),
      finishedAt: new Date(),
      baseSha,
      headSha,
      collector: 'ast',
    });

    await createInvestigation({
      analysisId: analysis.id,
      stage: 'dependency_graph_complete',
      status: 'completed',
      startedAt: new Date(),
      finishedAt: new Date(),
      baseSha,
      headSha,
      collector: 'graph',
    });

    await createInvestigation({
      analysisId: analysis.id,
      stage: 'impact_analysis_complete',
      status: 'completed',
      startedAt: new Date(),
      finishedAt: new Date(),
      baseSha,
      headSha,
      collector: 'impact',
    });

    const riskPostRes = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysis.id}/risk`,
    });
    expect(riskPostRes.statusCode).toBe(200);

    const report = JSON.parse(riskPostRes.body);
    expect(report.confirmedExposure.directDependentsCount).toBe(0);
    expect(report.potentialExposure.unresolvedCount).toBeGreaterThanOrEqual(1);

    const targetRes = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysis.id}/risk/targets/${encodeURIComponent('file:src/downstream.ts')}`,
    });
    expect(targetRes.statusCode).toBe(200);
    const target = JSON.parse(targetRes.body);
    expect(target.isConfirmed).toBe(false);
    expect(target.unresolvedLimitations.some((l: string) => l.includes('edge_does_not_exist'))).toBe(true);
  });

  it('rejects confirmation when ImpactResult has mismatched repository provenance in live pipeline', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha,
      headSha,
      status: 'completed',
    });

    await prisma.changedFile.create({
      data: {
        analysisId: analysis.id,
        path: 'src/math.ts',
        changeType: 'modified',
        baseSha,
        headSha,
        collector: 'git',
      },
    });

    await prisma.impactResult.create({
      data: {
        analysisId: analysis.id,
        repositoryId: 'different_foreign_repo_id',
        commitSha: headSha,
        resultKey: 'res_foreign_repo',
        targetKey: 'file:src/consumer.ts',
        targetType: 'file',
        targetFile: 'src/consumer.ts',
        sourceChangeKey: 'file:src/math.ts',
        sourceChangeFile: 'src/math.ts',
        classification: 'direct',
        depth: 1,
        path: JSON.stringify(['file:src/math.ts', 'file:src/consumer.ts']),
        relationshipTypes: JSON.stringify(['imports_module']),
        edgeKeys: JSON.stringify(['edge_any']),
        resolutionStatus: 'resolved',
        collector: 'change-impact-analyzer',
      },
    });

    await createInvestigation({
      analysisId: analysis.id,
      stage: 'git_ingestion_complete',
      status: 'completed',
      startedAt: new Date(),
      finishedAt: new Date(),
      baseSha,
      headSha,
      collector: 'git',
    });

    await createInvestigation({
      analysisId: analysis.id,
      stage: 'ast_extraction_complete',
      status: 'completed',
      startedAt: new Date(),
      finishedAt: new Date(),
      baseSha,
      headSha,
      collector: 'ast',
    });

    await createInvestigation({
      analysisId: analysis.id,
      stage: 'dependency_graph_complete',
      status: 'completed',
      startedAt: new Date(),
      finishedAt: new Date(),
      baseSha,
      headSha,
      collector: 'graph',
    });

    await createInvestigation({
      analysisId: analysis.id,
      stage: 'impact_analysis_complete',
      status: 'completed',
      startedAt: new Date(),
      finishedAt: new Date(),
      baseSha,
      headSha,
      collector: 'impact',
    });

    const riskPostRes = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysis.id}/risk`,
    });
    expect(riskPostRes.statusCode).toBe(200);

    const report = JSON.parse(riskPostRes.body);
    expect(report.confirmedExposure.directDependentsCount).toBe(0);
    expect(report.limitations.some((l: string) => l.includes('Mismatched ImpactResult repositoryId'))).toBe(true);

    const targetRes = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysis.id}/risk/targets/${encodeURIComponent('file:src/consumer.ts')}`,
    });
    expect(targetRes.statusCode).toBe(200);
    const target = JSON.parse(targetRes.body);
    expect(target.isConfirmed).toBe(false);
  });
});
