import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { loadConfig } from '../config.js';
import { createAnalysis } from '../repo/index.js';
import { executeImpactAnalysisForAnalysis } from '../impact/index.js';

describe('Change Impact Analysis Integration Tests', () => {
  let app: FastifyInstance;
  let allowedParentDir: string;
  let repoDir: string;
  let baseSha: string;
  let headSha: string;
  let headSha2: string;
  let repoId: string;

  function git(cmdRepo: string, ...args: string[]) {
    return execFileSync('git', args, { cwd: cmdRepo, encoding: 'utf8' }).trim();
  }

  beforeAll(async () => {
    allowedParentDir = realpathSync(mkdtempSync(path.join(tmpdir(), 'devos-impact-root-')));
    repoDir = path.join(allowedParentDir, 'impact-sample-repo');
    execFileSync('mkdir', ['-p', repoDir]);
    repoDir = realpathSync(repoDir);

    git(repoDir, 'init', '-q');
    git(repoDir, 'config', 'user.email', 'impact-tester@devos.dev');
    git(repoDir, 'config', 'user.name', 'Devos Impact Tester');

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
    git(repoDir, 'commit', '-q', '-m', 'Initial baseline with all files');
    baseSha = git(repoDir, 'rev-parse', 'HEAD');

    writeFileSync(
      path.join(repoDir, 'src/math.ts'),
      `export function add(a: number, b: number): number { return a + b + 0; }\n`
    );
    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-q', '-m', 'Head commit modifying only math.ts');
    headSha = git(repoDir, 'rev-parse', 'HEAD');

    writeFileSync(
      path.join(repoDir, 'src/standalone.ts'),
      `export const standaloneVal = 99;\n`
    );
    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-q', '-m', 'Second commit modifying only standalone.ts');
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
        name: 'impact-sample-repo',
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

  it('runs impact analysis during analysis creation and persists results with full provenance', async () => {
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

    const reportRes = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysisId}/impact`,
    });

    expect(reportRes.statusCode).toBe(200);
    const report = JSON.parse(reportRes.body);

    expect(report.stage).toBe('impact_analysis_complete');
    expect(report.summary.analysisId).toBe(analysisId);
    expect(report.summary.changedFilesCount).toBeGreaterThan(0);
    expect(report.summary.directImpactCount).toBeGreaterThan(0);
    expect(report.results.length).toBeGreaterThan(0);

    const reexportImpact = report.results.find(
      (r: any) => r.sourceChangeFile === 'src/math.ts' && r.targetKey === 'file:src/reexports.ts'
    );
    expect(reexportImpact).toBeDefined();
    expect(reexportImpact.classification).toBe('direct');

    const consumerImpact = report.results.find(
      (r: any) => r.sourceChangeFile === 'src/math.ts' && r.targetKey === 'file:src/consumer.ts'
    );
    expect(consumerImpact).toBeDefined();
    expect(consumerImpact.classification).toBe('direct');
    expect(consumerImpact.depth).toBe(1);

    const inv = await prisma.investigation.findFirst({
      where: { analysisId, stage: 'impact_analysis_complete' },
    });
    expect(inv).toBeDefined();
    expect(inv?.collector).toBe('change-impact-analyzer');
  });

  it('retrieves specific impact details by target key via API', async () => {
    const analysis = await prisma.analysis.findFirst({
      where: { repositoryId: repoId, headSha },
      orderBy: { createdAt: 'desc' },
    });
    expect(analysis).toBeDefined();

    const encodedTarget = encodeURIComponent('file:src/consumer.ts');
    const res = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysis!.id}/impact/targets/${encodedTarget}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.targetKey).toBe('file:src/consumer.ts');
    expect(body.impacts.length).toBeGreaterThan(0);
    expect(body.impacts[0].classification).toBe('direct');
  });

  it('returns 404 for non-existent target key', async () => {
    const analysis = await prisma.analysis.findFirst({
      where: { repositoryId: repoId, headSha },
      orderBy: { createdAt: 'desc' },
    });

    const encodedGhost = encodeURIComponent('file:src/non-existent.ts');
    const res = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysis!.id}/impact/targets/${encodedGhost}`,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('supports idempotent re-execution without duplicate record accumulation', async () => {
    const analysis = await prisma.analysis.findFirst({
      where: { repositoryId: repoId, headSha },
      orderBy: { createdAt: 'desc' },
    });

    const countBefore = await prisma.impactResult.count({
      where: { analysisId: analysis!.id },
    });

    const triggerRes = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysis!.id}/impact`,
    });
    expect(triggerRes.statusCode).toBe(200);

    const countAfter = await prisma.impactResult.count({
      where: { analysisId: analysis!.id },
    });
    expect(countAfter).toBe(countBefore);
  });

  it('isolates impact analysis between two different analyses of the same repository', async () => {
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha: headSha,
        headSha: headSha2,
      },
    });

    expect(res2.statusCode).toBe(201);
    const body2 = JSON.parse(res2.body);
    const analysisId2 = body2.id;

    const report2Res = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysisId2}/impact`,
    });

    expect(report2Res.statusCode).toBe(200);
    const report2 = JSON.parse(report2Res.body);

    expect(report2.summary.changedFilesCount).toBe(1);
    expect(report2.results.every((r: any) => r.sourceChangeFile === 'src/standalone.ts')).toBe(true);
    expect(report2.summary.directImpactCount).toBe(0);
    expect(report2.summary.transitiveImpactCount).toBe(0);

    const recordsAnalysis2 = await prisma.impactResult.findMany({
      where: { analysisId: analysisId2 },
    });
    expect(recordsAnalysis2.every((r) => r.commitSha === headSha2)).toBe(true);
  });

  it('fails impact analysis honestly when dependency graph is missing or failed', async () => {
    const emptyAnalysis = await createAnalysis({
      repositoryId: repoId,
      baseSha,
      headSha,
      status: 'running',
    });

    const result = await executeImpactAnalysisForAnalysis({
      analysisId: emptyAnalysis.id,
      repoPath: repoDir,
    });

    expect(result.success).toBe(false);
    expect(result.stage).toBe('impact_analysis_failed');

    const inv = await prisma.investigation.findFirst({
      where: { analysisId: emptyAnalysis.id, stage: 'impact_analysis_failed' },
    });
    expect(inv).toBeDefined();
    expect(inv?.status).toBe('failed');
  });

  it('handles partial dependency graph records honestly by propagating impact_analysis_partial', async () => {
    const partialAnalysis = await createAnalysis({
      repositoryId: repoId,
      baseSha,
      headSha,
      status: 'running',
    });

    await prisma.dependencyNode.create({
      data: {
        analysisId: partialAnalysis.id,
        nodeKey: 'file:src/math.ts',
        nodeType: 'file',
        name: 'math.ts',
        repositoryId: repoId,
        commitSha: headSha,
        collector: 'dependency-graph-builder',
      },
    });

    await prisma.changedFile.create({
      data: {
        analysisId: partialAnalysis.id,
        path: 'src/math.ts',
        changeType: 'modified',
        baseSha,
        headSha,
        collector: 'git-diff-collector',
      },
    });

    await prisma.investigation.create({
      data: {
        analysisId: partialAnalysis.id,
        status: 'in_progress',
        stage: 'dependency_graph_partial',
        baseSha,
        headSha,
        collector: 'dependency-graph-builder',
      },
    });

    const result = await executeImpactAnalysisForAnalysis({
      analysisId: partialAnalysis.id,
      repoPath: repoDir,
    });

    expect(result.success).toBe(true);
    expect(result.stage).toBe('impact_analysis_partial');
    expect(result.report?.summary.isPartial).toBe(true);

    const inv = await prisma.investigation.findFirst({
      where: { analysisId: partialAnalysis.id, stage: 'impact_analysis_partial' },
    });
    expect(inv).toBeDefined();
  });

  it('isolates impact analysis from subsequent working tree modifications', async () => {
    const analysis = await prisma.analysis.findFirst({
      where: { repositoryId: repoId, headSha },
      orderBy: { createdAt: 'desc' },
    });

    const dirtyFilePath = path.join(repoDir, 'src/dirty-untracked.ts');
    writeFileSync(dirtyFilePath, 'import { add } from "./math.js";\n');

    try {
      const res = await app.inject({
        method: 'POST',
        url: `/api/analyses/${analysis!.id}/impact`,
      });
      expect(res.statusCode).toBe(200);
      const report = JSON.parse(res.body);

      expect(report.results.some((r: any) => r.targetKey === 'file:src/dirty-untracked.ts')).toBe(false);
    } finally {
      rmSync(dirtyFilePath, { force: true });
    }
  });

  it('re-executes and updates impact results when graph data changes', async () => {
    const analysis = await prisma.analysis.findFirst({
      where: { repositoryId: repoId, headSha },
      orderBy: { createdAt: 'desc' },
    });

    const initialReport = await app.inject({
      method: 'GET',
      url: `/api/analyses/${analysis!.id}/impact`,
    });
    const initialResults = JSON.parse(initialReport.body).results;
    expect(initialResults.some((r: any) => r.targetKey === 'file:src/late-consumer.ts')).toBe(false);

    await prisma.dependencyEdge.create({
      data: {
        analysisId: analysis!.id,
        repositoryId: repoId,
        edgeKey: 'file:src/late-consumer.ts->file:src/math.ts:imports_module:1:1',
        from: 'file:src/late-consumer.ts',
        to: 'file:src/math.ts',
        kind: 'imports_module',
        sourceFile: 'src/late-consumer.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
        commitSha: headSha,
        collector: 'test-graph',
      },
    });

    const updatedRes = await app.inject({
      method: 'POST',
      url: `/api/analyses/${analysis!.id}/impact`,
    });
    expect(updatedRes.statusCode).toBe(200);
    const updatedReport = JSON.parse(updatedRes.body);

    const lateConsumer = updatedReport.results.find((r: any) => r.targetKey === 'file:src/late-consumer.ts');
    expect(lateConsumer).toBeDefined();
    expect(lateConsumer.classification).toBe('direct');
  });

  it('rolls back database changes atomically when impact persistence fails', async () => {
    const analysis = await prisma.analysis.findFirst({
      where: { repositoryId: repoId, headSha },
      orderBy: { createdAt: 'desc' },
    });

    const countBefore = await prisma.impactResult.count({
      where: { analysisId: analysis!.id },
    });

    const failingClient = {
      $transaction: async () => {
        throw new Error('Database transaction connection aborted');
      },
    };

    const result = await executeImpactAnalysisForAnalysis(
      { analysisId: analysis!.id, repoPath: repoDir },
      failingClient as any
    );

    expect(result.success).toBe(false);
    expect(result.stage).toBe('impact_analysis_failed');

    const countAfter = await prisma.impactResult.count({
      where: { analysisId: analysis!.id },
    });
    expect(countAfter).toBe(countBefore);
  });

  it('handles file rename where dependent imports old path and documents limitation without fabricating impact', async () => {
    const renameAnalysis = await createAnalysis({
      repositoryId: repoId,
      baseSha,
      headSha,
      status: 'running',
    });

    await prisma.changedFile.create({
      data: {
        analysisId: renameAnalysis.id,
        path: 'src/calc.ts',
        oldPath: 'src/math.ts',
        changeType: 'renamed',
        baseSha,
        headSha,
        collector: 'git-diff-collector',
      },
    });

    await prisma.dependencyNode.createMany({
      data: [
        {
          analysisId: renameAnalysis.id,
          nodeKey: 'file:src/calc.ts',
          nodeType: 'file',
          name: 'calc.ts',
          repositoryId: repoId,
          commitSha: headSha,
          collector: 'dependency-graph-builder',
        },
        {
          analysisId: renameAnalysis.id,
          nodeKey: 'file:src/consumerNew.ts',
          nodeType: 'file',
          name: 'consumerNew.ts',
          repositoryId: repoId,
          commitSha: headSha,
          collector: 'dependency-graph-builder',
        },
        {
          analysisId: renameAnalysis.id,
          nodeKey: 'file:src/consumerOld.ts',
          nodeType: 'file',
          name: 'consumerOld.ts',
          repositoryId: repoId,
          commitSha: headSha,
          collector: 'dependency-graph-builder',
        },
      ],
    });

    await prisma.dependencyEdge.createMany({
      data: [
        {
          analysisId: renameAnalysis.id,
          repositoryId: repoId,
          edgeKey: 'file:src/consumerNew.ts->file:src/calc.ts:imports_module:1:1',
          from: 'file:src/consumerNew.ts',
          to: 'file:src/calc.ts',
          kind: 'imports_module',
          sourceFile: 'src/consumerNew.ts',
          sourceLine: 1,
          resolutionStatus: 'resolved',
          commitSha: headSha,
          collector: 'dependency-graph-builder',
        },
        {
          analysisId: renameAnalysis.id,
          repositoryId: repoId,
          edgeKey: 'file:src/consumerOld.ts->module:./math.js:imports_module:1:1',
          from: 'file:src/consumerOld.ts',
          to: 'module:./math.js',
          kind: 'imports_module',
          sourceFile: 'src/consumerOld.ts',
          sourceLine: 1,
          resolutionStatus: 'unresolved',
          commitSha: headSha,
          collector: 'dependency-graph-builder',
        },
      ],
    });

    const result = await executeImpactAnalysisForAnalysis({
      analysisId: renameAnalysis.id,
      repoPath: repoDir,
    });

    expect(result.success).toBe(true);
    const report = result.report!;

    const changedItem = report.results.find((r) => r.targetKey === 'file:src/calc.ts');
    expect(changedItem).toBeDefined();
    expect(changedItem?.metadata).toEqual({ changeType: 'renamed', oldPath: 'src/math.ts' });

    const consumerNewImpact = report.results.find((r) => r.targetKey === 'file:src/consumerNew.ts');
    expect(consumerNewImpact).toBeDefined();
    expect(consumerNewImpact?.classification).toBe('direct');

    const consumerOldFabricated = report.results.find((r) => r.targetKey === 'file:src/consumerOld.ts');
    expect(consumerOldFabricated).toBeUndefined();

    expect(report.limitations?.length).toBeGreaterThan(0);
    expect(report.limitations?.[0]).toContain('src/math.ts');
  });
});
