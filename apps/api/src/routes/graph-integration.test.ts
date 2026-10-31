import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { loadConfig } from '../config.js';
import { buildAndPersistDependencyGraph } from '../graph/index.js';
import { createAnalysis } from '../repo/index.js';

describe('Dependency Graph Builder Integration Tests', () => {
  let app: FastifyInstance;
  let allowedParentDir: string;
  let repoDir: string;
  let baseSha: string;
  let headSha: string;
  let repoId: string;

  function git(cmdRepo: string, ...args: string[]) {
    return execFileSync('git', args, { cwd: cmdRepo, encoding: 'utf8' }).trim();
  }

  beforeAll(async () => {
    allowedParentDir = realpathSync(mkdtempSync(path.join(tmpdir(), 'devos-graph-root-')));
    repoDir = path.join(allowedParentDir, 'graph-sample-repo');
    execFileSync('mkdir', ['-p', repoDir]);
    repoDir = realpathSync(repoDir);

    git(repoDir, 'init', '-q');
    git(repoDir, 'config', 'user.email', 'graph-tester@devos.dev');
    git(repoDir, 'config', 'user.name', 'Devos Graph Tester');

    writeFileSync(path.join(repoDir, 'base.ts'), 'export const baseFlag = 1;\n');
    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-q', '-m', 'Base commit');
    baseSha = git(repoDir, 'rev-parse', 'HEAD');

    execFileSync('mkdir', ['-p', path.join(repoDir, 'src')]);

    writeFileSync(
      path.join(repoDir, 'src/math.ts'),
      `
export function add(a: number, b: number): number {
  return a + b;
}

export default class Calculator {
  public calculate(x: number, y: number): number {
    return add(x, y);
  }
}
      `.trim() + '\n'
    );

    writeFileSync(
      path.join(repoDir, 'src/reexports.ts'),
      `
export { add } from './math.js';
export { default as MathCalculator } from './math.js';
      `.trim() + '\n'
    );

    writeFileSync(
      path.join(repoDir, 'src/app.ts'),
      `
import React from 'react';
import { add, MathCalculator } from './reexports.js';
import './math.js';

export function run(): number {
  const calc = new MathCalculator();
  return calc.calculate(1, 2);
}
      `.trim() + '\n'
    );

    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-q', '-m', 'Head commit with graph fixtures');
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
        name: 'graph-sample-repo',
        path: repoDir,
      },
    });
    expect(regRes.statusCode).toBe(201);
    repoId = regRes.json().id;
  });

  afterAll(async () => {
    await app.close();
    if (repoId) {
      await prisma.repository.deleteMany({
        where: { id: repoId },
      });
    }
    await prisma.$disconnect();
    rmSync(allowedParentDir, { recursive: true, force: true });
  });

  it('constructs and persists graph nodes, edges, provenance, and lifecycle metrics', async () => {
    const analysisRes = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha,
        headSha,
      },
    });

    expect(analysisRes.statusCode).toBe(201);
    const job = analysisRes.json();
    expect(job.status).toBe('completed');
    expect(job.finishedAt).not.toBeNull();
    const analysisId = job.id;

    const nodes = await prisma.dependencyNode.findMany({
      where: { analysisId },
    });
    expect(nodes.length).toBeGreaterThan(0);

    for (const node of nodes) {
      expect(node.analysisId).toBe(analysisId);
      expect(node.repositoryId).toBe(repoId);
      expect(node.commitSha).toBe(headSha);
      expect(node.collector).toBe('dependency-graph-builder');
      expect(['file', 'symbol', 'module']).toContain(node.nodeType);
    }

    const edges = await prisma.dependencyEdge.findMany({
      where: { analysisId },
    });
    expect(edges.length).toBeGreaterThan(0);

    for (const edge of edges) {
      expect(edge.analysisId).toBe(analysisId);
      expect(edge.repositoryId).toBe(repoId);
      expect(edge.commitSha).toBe(headSha);
      expect(edge.collector).toBe('dependency-graph-builder');
      expect(['imports_module', 'imports_symbol', 're_exports', 'contains', 'references_symbol']).toContain(edge.kind);
    }

    const importModuleEdges = edges.filter((e) => e.kind === 'imports_module');
    expect(importModuleEdges.some((e) => e.from === 'file:src/app.ts' && e.to === 'file:src/reexports.ts')).toBe(true);
    expect(importModuleEdges.some((e) => e.from === 'file:src/app.ts' && e.to === 'module:react')).toBe(true);

    const importSymbolEdges = edges.filter((e) => e.kind === 'imports_symbol');
    expect(importSymbolEdges.some((e) => e.from === 'file:src/app.ts' && e.to.includes('src/math.ts#add:function'))).toBe(true);
    expect(importSymbolEdges.some((e) => e.from === 'file:src/app.ts' && e.to.includes('src/math.ts#Calculator:class'))).toBe(true);

    const graphInv = await prisma.investigation.findFirst({
      where: { analysisId, stage: 'dependency_graph_complete' },
    });
    expect(graphInv).not.toBeNull();
    expect(graphInv?.status).toBe('in_progress');
    expect(graphInv?.collector).toBe('dependency-graph-builder');
  });

  it('supports idempotent graph rebuilding for an analysis without duplicate accumulation', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha,
      headSha,
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
    });

    const symbols = await prisma.symbol.findMany({
      where: { commitSha: headSha, repositoryId: repoId },
    });

    const buildOpts = {
      analysisId: analysis.id,
      repositoryId: repoId,
      repoPath: repoDir,
      headSha,
      baseSha,
      trackedFiles: ['src/app.ts', 'src/math.ts', 'src/reexports.ts', 'base.ts'],
      symbols,
    };

    const run1 = await buildAndPersistDependencyGraph(buildOpts);
    expect(run1.success).toBe(true);

    const nodeCount1 = await prisma.dependencyNode.count({ where: { analysisId: analysis.id } });
    const edgeCount1 = await prisma.dependencyEdge.count({ where: { analysisId: analysis.id } });
    expect(nodeCount1).toBeGreaterThan(0);
    expect(edgeCount1).toBeGreaterThan(0);

    const run2 = await buildAndPersistDependencyGraph(buildOpts);
    expect(run2.success).toBe(true);

    const nodeCount2 = await prisma.dependencyNode.count({ where: { analysisId: analysis.id } });
    const edgeCount2 = await prisma.dependencyEdge.count({ where: { analysisId: analysis.id } });

    expect(nodeCount2).toBe(nodeCount1);
    expect(edgeCount2).toBe(edgeCount1);
  });

  it('records dependency_graph_failed and marks analysis failed if persistence encounters fatal error', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha,
      headSha,
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
    });

    const mockFailingClient = {
      ...prisma,
      $transaction: async () => {
        throw new Error('Database write error during graph persistence');
      },
    } as unknown as typeof prisma;

    const res = await buildAndPersistDependencyGraph(
      {
        analysisId: analysis.id,
        repositoryId: repoId,
        repoPath: repoDir,
        headSha,
        baseSha,
        trackedFiles: ['src/math.ts'],
        symbols: [],
      },
      mockFailingClient
    );

    expect(res.success).toBe(false);
    expect(res.stage).toBe('dependency_graph_failed');

    const updatedAnalysis = await prisma.analysis.findUnique({
      where: { id: analysis.id },
    });
    expect(updatedAnalysis?.status).toBe('failed');
    expect(updatedAnalysis?.finishedAt).not.toBeNull();
    expect(updatedAnalysis?.error).toContain('Dependency graph construction failed');

    const failedInv = await prisma.investigation.findFirst({
      where: { analysisId: analysis.id, stage: 'dependency_graph_failed' },
    });
    expect(failedInv).not.toBeNull();
    expect(failedInv?.status).toBe('failed');
  });

  it('records dependency_graph_partial when unresolved dependencies exist', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha,
      headSha,
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
    });

    const symbolsWithUnresolved = [
      {
        symbolKey: 'src/dummy.ts#unresolved:import:1:1',
        name: 'ghost',
        kind: 'import',
        file: 'src/dummy.ts',
        lineStart: 1,
        lineEnd: 1,
        isExported: false,
        importKind: 'named',
        importedName: 'ghost',
        localName: 'ghost',
        moduleSpecifier: './non-existent-module.js',
      },
    ];

    const res = await buildAndPersistDependencyGraph({
      analysisId: analysis.id,
      repositoryId: repoId,
      repoPath: repoDir,
      headSha,
      baseSha,
      trackedFiles: ['src/dummy.ts'],
      symbols: symbolsWithUnresolved,
    });

    expect(res.success).toBe(true);
    expect(res.stage).toBe('dependency_graph_partial');
    expect(res.result.metrics.unresolvedDependencies).toBeGreaterThan(0);

    const partialInv = await prisma.investigation.findFirst({
      where: { analysisId: analysis.id, stage: 'dependency_graph_partial' },
    });
    expect(partialInv).not.toBeNull();
    expect(partialInv?.status).toBe('in_progress');
    const errObj = JSON.parse(partialInv?.error ?? '{}');
    expect(errObj.metrics.unresolvedDependencies).toBeGreaterThan(0);
  });

  it('enforces database-level edge uniqueness on (analysisId, edgeKey)', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha,
      headSha,
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
    });

    await prisma.dependencyEdge.create({
      data: {
        analysisId: analysis.id,
        repositoryId: repoId,
        edgeKey: 'unique-test-edge-1',
        from: 'file:src/math.ts',
        to: 'file:src/app.ts',
        kind: 'imports_module',
        sourceFile: 'src/app.ts',
        sourceLine: 1,
        sourceCol: 1,
        resolutionStatus: 'resolved',
        commitSha: headSha,
        collector: 'dependency-graph-builder',
      },
    });

    await expect(
      prisma.dependencyEdge.create({
        data: {
          analysisId: analysis.id,
          repositoryId: repoId,
          edgeKey: 'unique-test-edge-1',
          from: 'file:src/math.ts',
          to: 'file:src/app.ts',
          kind: 'imports_module',
          sourceFile: 'src/app.ts',
          sourceLine: 1,
          sourceCol: 1,
          resolutionStatus: 'resolved',
          commitSha: headSha,
          collector: 'dependency-graph-builder',
        },
      })
    ).rejects.toThrow();
  });

  it('validates and persists full provenance for resolved, unresolved, and ambiguous edges', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha,
      headSha,
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
    });

    const testSymbols = [
      {
        symbolKey: 'src/prov.ts#resolvedImport:import:1:1',
        name: 'add',
        kind: 'import',
        file: 'src/prov.ts',
        lineStart: 1,
        lineEnd: 1,
        isExported: false,
        importKind: 'named',
        importedName: 'add',
        localName: 'add',
        moduleSpecifier: './math.js',
      },
      {
        symbolKey: 'src/prov.ts#unresolvedImport:import:2:1',
        name: 'missing',
        kind: 'import',
        file: 'src/prov.ts',
        lineStart: 2,
        lineEnd: 2,
        isExported: false,
        importKind: 'named',
        importedName: 'missing',
        localName: 'missing',
        moduleSpecifier: './ghost.js',
      },
      {
        symbolKey: 'src/math.ts#add:function:1:1',
        name: 'add',
        kind: 'function',
        file: 'src/math.ts',
        lineStart: 1,
        lineEnd: 3,
        isExported: true,
      },
    ];

    const res = await buildAndPersistDependencyGraph({
      analysisId: analysis.id,
      repositoryId: repoId,
      repoPath: repoDir,
      headSha,
      baseSha,
      trackedFiles: ['src/prov.ts', 'src/math.ts'],
      symbols: testSymbols,
    });

    expect(res.success).toBe(true);

    const edges = await prisma.dependencyEdge.findMany({
      where: { analysisId: analysis.id },
    });

    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
      expect(edge.analysisId).toBe(analysis.id);
      expect(edge.repositoryId).toBe(repoId);
      expect(edge.commitSha).toBe(headSha);
      expect(edge.sourceFile).toBeDefined();
      expect(edge.sourceFile.length).toBeGreaterThan(0);
      expect(edge.collector).toBe('dependency-graph-builder');
      expect(edge.edgeKey).toBeDefined();
      expect(edge.edgeKey.length).toBeGreaterThan(0);
    }

    const resolvedEdge = edges.find((e) => e.resolutionStatus === 'resolved' && e.kind === 'imports_symbol');
    expect(resolvedEdge).toBeDefined();
    expect(resolvedEdge?.analysisId).toBe(analysis.id);
    expect(resolvedEdge?.repositoryId).toBe(repoId);

    const unresolvedEdge = edges.find((e) => e.resolutionStatus === 'unresolved' && e.kind === 'imports_symbol');
    expect(unresolvedEdge).toBeDefined();
    expect(unresolvedEdge?.analysisId).toBe(analysis.id);
    expect(unresolvedEdge?.repositoryId).toBe(repoId);
  });

  it('handles namespace imports and side-effect imports correctly', async () => {
    const analysis = await createAnalysis({
      repositoryId: repoId,
      baseSha,
      headSha,
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
    });

    const nsSymbols = [
      {
        symbolKey: 'src/ns_consumer.ts#ns:import:1:1',
        name: 'mathNs',
        kind: 'import',
        file: 'src/ns_consumer.ts',
        lineStart: 1,
        lineEnd: 1,
        isExported: false,
        importKind: 'namespace',
        importedName: '*',
        localName: 'mathNs',
        moduleSpecifier: './math.js',
      },
      {
        symbolKey: 'src/ns_consumer.ts#sideEffect:import:2:1',
        name: './math.js',
        kind: 'import',
        file: 'src/ns_consumer.ts',
        lineStart: 2,
        lineEnd: 2,
        isExported: false,
        importKind: 'side-effect',
        importedName: null,
        localName: null,
        moduleSpecifier: './math.js',
      },
    ];

    const res = await buildAndPersistDependencyGraph({
      analysisId: analysis.id,
      repositoryId: repoId,
      repoPath: repoDir,
      headSha,
      baseSha,
      trackedFiles: ['src/ns_consumer.ts', 'src/math.ts'],
      symbols: nsSymbols,
    });

    expect(res.success).toBe(true);

    const edges = await prisma.dependencyEdge.findMany({
      where: { analysisId: analysis.id },
    });

    const nsSymbolEdge = edges.find(
      (e) => e.kind === 'imports_symbol' && e.sourceLine === 1
    );
    expect(nsSymbolEdge).toBeDefined();
    expect(nsSymbolEdge?.to).toBe('file:src/math.ts');
    expect(nsSymbolEdge?.resolutionStatus).toBe('resolved');

    const sideEffectSymbolEdge = edges.find(
      (e) => e.kind === 'imports_symbol' && e.sourceLine === 2
    );
    expect(sideEffectSymbolEdge).toBeUndefined();

    const sideEffectModEdge = edges.find(
      (e) => e.kind === 'imports_module' && e.sourceLine === 2
    );
    expect(sideEffectModEdge).toBeDefined();
    expect(sideEffectModEdge?.to).toBe('file:src/math.ts');
  });

  it('detects multiple wildcard re-exports with overlapping symbols in real git repository', async () => {
    writeFileSync(
      path.join(repoDir, 'src/wildA.ts'),
      'export const conflict = "fromA";\n'
    );
    writeFileSync(
      path.join(repoDir, 'src/wildB.ts'),
      'export const conflict = "fromB";\n'
    );
    writeFileSync(
      path.join(repoDir, 'src/wildBarrel.ts'),
      'export * from "./wildA.js";\nexport * from "./wildB.js";\n'
    );
    writeFileSync(
      path.join(repoDir, 'src/wildConsumer.ts'),
      'import { conflict } from "./wildBarrel.js";\n'
    );

    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-q', '-m', 'Wildcard fixture commit');
    const wildHeadSha = git(repoDir, 'rev-parse', 'HEAD');

    const analysisRes = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha,
        headSha: wildHeadSha,
      },
    });

    expect(analysisRes.statusCode).toBe(201);
    const body = JSON.parse(analysisRes.body);

    const ambiguousEdge = await prisma.dependencyEdge.findFirst({
      where: {
        analysisId: body.id,
        kind: 'imports_symbol',
        resolutionStatus: 'ambiguous',
      },
    });

    expect(ambiguousEdge).not.toBeNull();
    expect(ambiguousEdge?.analysisId).toBe(body.id);
    expect(ambiguousEdge?.repositoryId).toBe(repoId);
    expect(ambiguousEdge?.commitSha).toBe(wildHeadSha);
    expect(ambiguousEdge?.sourceFile).toBe('src/wildConsumer.ts');
    expect(ambiguousEdge?.collector).toBe('dependency-graph-builder');

    const meta = JSON.parse(ambiguousEdge?.metadata ?? '{}');
    expect(meta.candidates?.length).toBe(2);
    expect(meta.reason).toBe('AMBIGUOUS_WILDCARD_EXPORT');
  });

  it('isolates graph states between two different analyses of the same repository', async () => {
    const analysis1 = await createAnalysis({
      repositoryId: repoId,
      baseSha,
      headSha,
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
    });

    const analysis2 = await createAnalysis({
      repositoryId: repoId,
      baseSha,
      headSha,
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
    });

    await buildAndPersistDependencyGraph({
      analysisId: analysis1.id,
      repositoryId: repoId,
      repoPath: repoDir,
      headSha,
      baseSha,
      trackedFiles: ['src/math.ts'],
      symbols: [
        {
          symbolKey: 'src/math.ts#add:function:1:1',
          name: 'add',
          kind: 'function',
          file: 'src/math.ts',
          lineStart: 1,
          lineEnd: 3,
          isExported: true,
        },
      ],
    });

    await buildAndPersistDependencyGraph({
      analysisId: analysis2.id,
      repositoryId: repoId,
      repoPath: repoDir,
      headSha,
      baseSha,
      trackedFiles: ['src/math.ts', 'src/reexports.ts', 'src/app.ts'],
      symbols: [],
    });

    const nodes1 = await prisma.dependencyNode.findMany({ where: { analysisId: analysis1.id } });
    const nodes2 = await prisma.dependencyNode.findMany({ where: { analysisId: analysis2.id } });

    expect(nodes1.length).toBe(2);
    expect(nodes2.length).toBe(3);
    expect(nodes1.every((n) => n.analysisId === analysis1.id)).toBe(true);
    expect(nodes2.every((n) => n.analysisId === analysis2.id)).toBe(true);
  });

  it('supports legacy dependency edges with nullable analysisId alongside new unique edges', async () => {
    const legacyEdge1 = await prisma.dependencyEdge.create({
      data: {
        analysisId: null,
        repositoryId: null,
        edgeKey: '',
        from: 'file:legacy1.ts',
        to: 'file:legacy2.ts',
        kind: 'imports_module',
        sourceFile: 'legacy1.ts',
        sourceLine: 1,
        sourceCol: null,
        resolutionStatus: 'resolved',
        commitSha: headSha,
        collector: 'legacy-collector',
      },
    });

    const legacyEdge2 = await prisma.dependencyEdge.create({
      data: {
        analysisId: null,
        repositoryId: null,
        edgeKey: '',
        from: 'file:legacy3.ts',
        to: 'file:legacy4.ts',
        kind: 'imports_module',
        sourceFile: 'legacy3.ts',
        sourceLine: 1,
        sourceCol: null,
        resolutionStatus: 'resolved',
        commitSha: headSha,
        collector: 'legacy-collector',
      },
    });

    expect(legacyEdge1.id).toBeDefined();
    expect(legacyEdge2.id).toBeDefined();
    expect(legacyEdge1.analysisId).toBeNull();
    expect(legacyEdge2.analysisId).toBeNull();
  });
});
