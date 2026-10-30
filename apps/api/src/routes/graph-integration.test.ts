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
    expect(job.status).toBe('running');
    expect(job.finishedAt).toBeNull();
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
});
