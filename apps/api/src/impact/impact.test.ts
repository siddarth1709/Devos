import { describe, it, expect } from 'vitest';
import { traverseImpact } from './traversal.js';
import { validateImpactProvenance } from './persistence.js';
import { ImpactResultItem } from './types.js';

describe('Change Impact Analysis Engine Unit Tests', () => {
  const analysisId = 'anl_test_001';
  const repositoryId = 'repo_test_001';
  const commitSha = '1111111111111111111111111111111111111111';

  it('identifies direct impact from a changed dependency', () => {
    const changedFiles = [{ path: 'src/math.ts', changeType: 'modified' }];
    const nodes = [
      { nodeKey: 'file:src/math.ts', nodeType: 'file', name: 'math.ts' },
      { nodeKey: 'file:src/consumer.ts', nodeType: 'file', name: 'consumer.ts' },
    ];
    const edges = [
      {
        edgeKey: 'file:src/consumer.ts->file:src/math.ts:imports_module:1:1',
        from: 'file:src/consumer.ts',
        to: 'file:src/math.ts',
        kind: 'imports_module',
        sourceFile: 'src/consumer.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols: [],
      nodes,
      edges,
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report.summary.changedFilesCount).toBe(1);
    expect(report.summary.directImpactCount).toBe(1);
    expect(report.summary.transitiveImpactCount).toBe(0);

    const direct = report.results.find((r) => r.targetKey === 'file:src/consumer.ts');
    expect(direct).toBeDefined();
    expect(direct?.classification).toBe('direct');
    expect(direct?.depth).toBe(1);
    expect(direct?.path).toEqual(['file:src/math.ts', 'file:src/consumer.ts']);
    expect(direct?.relationshipTypes).toEqual(['imports_module']);
  });

  it('identifies transitive impact through multiple dependency levels', () => {
    const changedFiles = [{ path: 'src/core.ts', changeType: 'modified' }];
    const nodes = [
      { nodeKey: 'file:src/core.ts', nodeType: 'file', name: 'core.ts' },
      { nodeKey: 'file:src/mid.ts', nodeType: 'file', name: 'mid.ts' },
      { nodeKey: 'file:src/app.ts', nodeType: 'file', name: 'app.ts' },
    ];
    const edges = [
      {
        edgeKey: 'file:src/mid.ts->file:src/core.ts:imports_module:1:1',
        from: 'file:src/mid.ts',
        to: 'file:src/core.ts',
        kind: 'imports_module',
        sourceFile: 'src/mid.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
      {
        edgeKey: 'file:src/app.ts->file:src/mid.ts:imports_module:1:1',
        from: 'file:src/app.ts',
        to: 'file:src/mid.ts',
        kind: 'imports_module',
        sourceFile: 'src/app.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols: [],
      nodes,
      edges,
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report.summary.directImpactCount).toBe(1);
    expect(report.summary.transitiveImpactCount).toBe(1);
    expect(report.summary.maxDepthReached).toBe(2);

    const mid = report.results.find((r) => r.targetKey === 'file:src/mid.ts');
    expect(mid?.classification).toBe('direct');
    expect(mid?.depth).toBe(1);

    const app = report.results.find((r) => r.targetKey === 'file:src/app.ts');
    expect(app?.classification).toBe('transitive');
    expect(app?.depth).toBe(2);
    expect(app?.path).toEqual(['file:src/core.ts', 'file:src/mid.ts', 'file:src/app.ts']);
  });

  it('identifies multiple consumers of one changed module', () => {
    const changedFiles = [{ path: 'src/utils.ts', changeType: 'modified' }];
    const edges = [
      {
        edgeKey: 'file:src/user.ts->file:src/utils.ts:imports_module:1:1',
        from: 'file:src/user.ts',
        to: 'file:src/utils.ts',
        kind: 'imports_module',
        sourceFile: 'src/user.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
      {
        edgeKey: 'file:src/billing.ts->file:src/utils.ts:imports_module:1:1',
        from: 'file:src/billing.ts',
        to: 'file:src/utils.ts',
        kind: 'imports_module',
        sourceFile: 'src/billing.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols: [],
      nodes: [],
      edges,
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report.summary.directImpactCount).toBe(2);
    const targets = report.results.filter((r) => r.classification === 'direct').map((r) => r.targetKey);
    expect(targets).toContain('file:src/user.ts');
    expect(targets).toContain('file:src/billing.ts');
  });

  it('identifies symbol-level import impact and associates changed symbols', () => {
    const changedFiles = [{ path: 'src/math.ts', changeType: 'modified' }];
    const symbols = [
      {
        symbolKey: 'src/math.ts#add:function:1:1',
        name: 'add',
        kind: 'function',
        file: 'src/math.ts',
        lineStart: 1,
        lineEnd: 3,
        isExported: true,
      },
      {
        symbolKey: 'src/math.ts#multiply:function:5:1',
        name: 'multiply',
        kind: 'function',
        file: 'src/math.ts',
        lineStart: 5,
        lineEnd: 7,
        isExported: true,
      },
    ];
    const edges = [
      {
        edgeKey: 'file:src/consumer.ts->symbol:src/math.ts#add:function:1:1:imports_symbol:1:1',
        from: 'file:src/consumer.ts',
        to: 'symbol:src/math.ts#add:function:1:1',
        kind: 'imports_symbol',
        sourceFile: 'src/consumer.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols,
      nodes: [],
      edges,
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report.summary.changedSymbolsCount).toBe(2);
    const symImpact = report.results.find(
      (r) => r.targetKey === 'file:src/consumer.ts' && r.sourceChangeKey === 'symbol:src/math.ts#add:function:1:1'
    );
    expect(symImpact).toBeDefined();
    expect(symImpact?.classification).toBe('direct');
    expect(symImpact?.sourceChangeSymbol).toBe('src/math.ts#add:function:1:1');
  });

  it('identifies re-export impact through intermediate barrels', () => {
    const changedFiles = [{ path: 'src/internal.ts', changeType: 'modified' }];
    const edges = [
      {
        edgeKey: 'file:src/barrel.ts->file:src/internal.ts:re_exports:1:1',
        from: 'file:src/barrel.ts',
        to: 'file:src/internal.ts',
        kind: 're_exports',
        sourceFile: 'src/barrel.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
      {
        edgeKey: 'file:src/app.ts->file:src/barrel.ts:imports_module:1:1',
        from: 'file:src/app.ts',
        to: 'file:src/barrel.ts',
        kind: 'imports_module',
        sourceFile: 'src/app.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols: [],
      nodes: [],
      edges,
      analysisId,
      repositoryId,
      commitSha,
    });

    const barrel = report.results.find((r) => r.targetKey === 'file:src/barrel.ts');
    expect(barrel?.classification).toBe('direct');
    expect(barrel?.relationshipTypes).toEqual(['re_exports']);

    const app = report.results.find((r) => r.targetKey === 'file:src/app.ts');
    expect(app?.classification).toBe('transitive');
    expect(app?.relationshipTypes).toEqual(['re_exports', 'imports_module']);
  });

  it('handles changed files with no dependents honestly as changed only', () => {
    const changedFiles = [{ path: 'src/leaf.ts', changeType: 'modified' }];
    const edges = [
      {
        edgeKey: 'file:src/leaf.ts->file:src/dep.ts:imports_module:1:1',
        from: 'file:src/leaf.ts',
        to: 'file:src/dep.ts',
        kind: 'imports_module',
        sourceFile: 'src/leaf.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols: [],
      nodes: [],
      edges,
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report.summary.changedFilesCount).toBe(1);
    expect(report.summary.directImpactCount).toBe(0);
    expect(report.summary.transitiveImpactCount).toBe(0);
    expect(report.results.length).toBe(1);
    expect(report.results[0]?.classification).toBe('changed');
  });

  it('handles multiple changed files and isolates their respective impact paths', () => {
    const changedFiles = [
      { path: 'src/modA.ts', changeType: 'modified' },
      { path: 'src/modB.ts', changeType: 'modified' },
    ];
    const edges = [
      {
        edgeKey: 'file:src/consumerA.ts->file:src/modA.ts:imports_module:1:1',
        from: 'file:src/consumerA.ts',
        to: 'file:src/modA.ts',
        kind: 'imports_module',
        sourceFile: 'src/consumerA.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
      {
        edgeKey: 'file:src/consumerB.ts->file:src/modB.ts:imports_module:1:1',
        from: 'file:src/consumerB.ts',
        to: 'file:src/modB.ts',
        kind: 'imports_module',
        sourceFile: 'src/consumerB.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols: [],
      nodes: [],
      edges,
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report.summary.changedFilesCount).toBe(2);
    expect(report.summary.directImpactCount).toBe(2);

    const resA = report.results.find((r) => r.targetKey === 'file:src/consumerA.ts');
    expect(resA?.sourceChangeFile).toBe('src/modA.ts');

    const resB = report.results.find((r) => r.targetKey === 'file:src/consumerB.ts');
    expect(resB?.sourceChangeFile).toBe('src/modB.ts');
  });

  it('detects cyclic dependencies and terminates traversal without infinite loops', () => {
    const changedFiles = [{ path: 'src/cycleA.ts', changeType: 'modified' }];
    const edges = [
      {
        edgeKey: 'file:src/cycleB.ts->file:src/cycleA.ts:imports_module:1:1',
        from: 'file:src/cycleB.ts',
        to: 'file:src/cycleA.ts',
        kind: 'imports_module',
        sourceFile: 'src/cycleB.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
      {
        edgeKey: 'file:src/cycleA.ts->file:src/cycleB.ts:imports_module:1:1',
        from: 'file:src/cycleA.ts',
        to: 'file:src/cycleB.ts',
        kind: 'imports_module',
        sourceFile: 'src/cycleA.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols: [],
      nodes: [],
      edges,
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report.summary.directImpactCount).toBe(1);
    expect(report.results.some((r) => r.targetKey === 'file:src/cycleB.ts')).toBe(true);
  });

  it('deduplicates multiple paths to the same target preserving the minimum depth', () => {
    const changedFiles = [{ path: 'src/root.ts', changeType: 'modified' }];
    const edges = [
      {
        edgeKey: 'file:src/directConsumer.ts->file:src/root.ts:imports_module:1:1',
        from: 'file:src/target.ts',
        to: 'file:src/root.ts',
        kind: 'imports_module',
        sourceFile: 'src/target.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
      {
        edgeKey: 'file:src/intermediate.ts->file:src/root.ts:imports_module:1:1',
        from: 'file:src/intermediate.ts',
        to: 'file:src/root.ts',
        kind: 'imports_module',
        sourceFile: 'src/intermediate.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
      {
        edgeKey: 'file:src/target.ts->file:src/intermediate.ts:imports_module:1:1',
        from: 'file:src/target.ts',
        to: 'file:src/intermediate.ts',
        kind: 'imports_module',
        sourceFile: 'src/target.ts',
        sourceLine: 2,
        resolutionStatus: 'resolved',
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols: [],
      nodes: [],
      edges,
      analysisId,
      repositoryId,
      commitSha,
    });

    const targetResults = report.results.filter(
      (r) => r.targetKey === 'file:src/target.ts' && r.sourceChangeKey === 'file:src/root.ts'
    );
    expect(targetResults.length).toBe(1);
    expect(targetResults[0]?.depth).toBe(1);
    expect(targetResults[0]?.classification).toBe('direct');
  });

  it('identifies unresolved dependencies and marks them honestly without guessing', () => {
    const changedFiles = [{ path: 'src/module.ts', changeType: 'modified' }];
    const edges = [
      {
        edgeKey: 'file:src/broken.ts->file:src/module.ts:imports_module:1:1',
        from: 'file:src/broken.ts',
        to: 'file:src/module.ts',
        kind: 'imports_module',
        sourceFile: 'src/broken.ts',
        sourceLine: 1,
        resolutionStatus: 'unresolved',
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols: [],
      nodes: [],
      edges,
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report.summary.unresolvedImpactCount).toBe(1);
    expect(report.summary.isPartial).toBe(true);
    expect(report.stage).toBe('impact_analysis_partial');

    const unres = report.results.find((r) => r.targetKey === 'file:src/broken.ts');
    expect(unres?.classification).toBe('unresolved');
    expect(unres?.resolutionStatus).toBe('unresolved');
  });

  it('identifies ambiguous dependencies and marks them honestly', () => {
    const changedFiles = [{ path: 'src/clash.ts', changeType: 'modified' }];
    const edges = [
      {
        edgeKey: 'file:src/ambigConsumer.ts->file:src/clash.ts:imports_module:1:1',
        from: 'file:src/ambigConsumer.ts',
        to: 'file:src/clash.ts',
        kind: 'imports_module',
        sourceFile: 'src/ambigConsumer.ts',
        sourceLine: 1,
        resolutionStatus: 'ambiguous',
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols: [],
      nodes: [],
      edges,
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report.summary.ambiguousImpactCount).toBe(1);
    expect(report.summary.isPartial).toBe(true);
    expect(report.stage).toBe('impact_analysis_partial');

    const ambig = report.results.find((r) => r.targetKey === 'file:src/ambigConsumer.ts');
    expect(ambig?.classification).toBe('ambiguous');
    expect(ambig?.resolutionStatus).toBe('ambiguous');
  });

  it('respects maximum traversal depth bounds', () => {
    const changedFiles = [{ path: 'src/level0.ts', changeType: 'modified' }];
    const edges = [
      {
        edgeKey: 'file:src/level1.ts->file:src/level0.ts:imports_module:1:1',
        from: 'file:src/level1.ts',
        to: 'file:src/level0.ts',
        kind: 'imports_module',
        sourceFile: 'src/level1.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
      {
        edgeKey: 'file:src/level2.ts->file:src/level1.ts:imports_module:1:1',
        from: 'file:src/level2.ts',
        to: 'file:src/level1.ts',
        kind: 'imports_module',
        sourceFile: 'src/level2.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
      {
        edgeKey: 'file:src/level3.ts->file:src/level2.ts:imports_module:1:1',
        from: 'file:src/level3.ts',
        to: 'file:src/level2.ts',
        kind: 'imports_module',
        sourceFile: 'src/level3.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols: [],
      nodes: [],
      edges,
      analysisId,
      repositoryId,
      commitSha,
      maxDepth: 2,
    });

    expect(report.summary.maxDepthReached).toBe(2);
    expect(report.results.some((r) => r.targetKey === 'file:src/level1.ts')).toBe(true);
    expect(report.results.some((r) => r.targetKey === 'file:src/level2.ts')).toBe(true);
    expect(report.results.some((r) => r.targetKey === 'file:src/level3.ts')).toBe(false);
  });

  it('produces deterministic output across repeated executions', () => {
    const changedFiles = [
      { path: 'src/z.ts', changeType: 'modified' },
      { path: 'src/a.ts', changeType: 'modified' },
    ];
    const edges = [
      {
        edgeKey: 'file:src/b.ts->file:src/a.ts:imports_module:1:1',
        from: 'file:src/b.ts',
        to: 'file:src/a.ts',
        kind: 'imports_module',
        sourceFile: 'src/b.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
      {
        edgeKey: 'file:src/c.ts->file:src/z.ts:imports_module:1:1',
        from: 'file:src/c.ts',
        to: 'file:src/z.ts',
        kind: 'imports_module',
        sourceFile: 'src/c.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
    ];

    const report1 = traverseImpact({
      changedFiles,
      symbols: [],
      nodes: [],
      edges,
      analysisId,
      repositoryId,
      commitSha,
    });

    const report2 = traverseImpact({
      changedFiles,
      symbols: [],
      nodes: [],
      edges,
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report1.results.map((r) => r.resultKey)).toEqual(report2.results.map((r) => r.resultKey));
    expect(report1.summary).toEqual(report2.summary);
  });

  it('validates provenance and rejects items missing mandatory fields', () => {
    const validItem: ImpactResultItem = {
      resultKey: 'file:src/a.ts->file:src/b.ts:direct',
      analysisId: 'anl_123',
      repositoryId: 'repo_123',
      commitSha: '2222222222222222222222222222222222222222',
      targetKey: 'file:src/b.ts',
      targetType: 'file',
      targetFile: 'src/b.ts',
      targetSymbol: null,
      sourceChangeKey: 'file:src/a.ts',
      sourceChangeFile: 'src/a.ts',
      sourceChangeSymbol: null,
      classification: 'direct',
      depth: 1,
      path: ['file:src/a.ts', 'file:src/b.ts'],
      relationshipTypes: ['imports_module'],
      edgeKeys: ['edge_1'],
      resolutionStatus: 'resolved',
      collector: 'change-impact-analyzer',
    };

    expect(() => validateImpactProvenance([validItem])).not.toThrow();

    const missingAnalysis = { ...validItem, analysisId: '' };
    expect(() => validateImpactProvenance([missingAnalysis])).toThrow(/analysisId/);

    const missingRepo = { ...validItem, repositoryId: '' };
    expect(() => validateImpactProvenance([missingRepo])).toThrow(/repositoryId/);

    const missingSha = { ...validItem, commitSha: '' };
    expect(() => validateImpactProvenance([missingSha])).toThrow(/commitSha/);

    const missingTarget = { ...validItem, targetKey: '' };
    expect(() => validateImpactProvenance([missingTarget])).toThrow(/targetKey/);

    const missingCollector = { ...validItem, collector: '' };
    expect(() => validateImpactProvenance([missingCollector])).toThrow(/collector/);
  });

  it('maps diff hunks to AST symbols precisely and ignores non-overlapping symbols', () => {
    const changedFiles = [
      {
        path: 'src/service.ts',
        changeType: 'modified',
        hunks: [{ oldStart: 25, oldLines: 2, newStart: 25, newLines: 5 }],
      },
    ];
    const symbols = [
      {
        symbolKey: 'src/service.ts#helper:function:1:1',
        name: 'helper',
        kind: 'function',
        file: 'src/service.ts',
        lineStart: 1,
        lineEnd: 10,
        isExported: true,
      },
      {
        symbolKey: 'src/service.ts#execute:function:20:1',
        name: 'execute',
        kind: 'function',
        file: 'src/service.ts',
        lineStart: 20,
        lineEnd: 30,
        isExported: true,
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols,
      nodes: [],
      edges: [],
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report.summary.changedFilesCount).toBe(1);
    expect(report.summary.changedSymbolsCount).toBe(1);
    expect(report.results.some((r) => r.targetKey === 'symbol:src/service.ts#execute:function:20:1')).toBe(true);
    expect(report.results.some((r) => r.targetKey === 'symbol:src/service.ts#helper:function:1:1')).toBe(false);
  });

  it('honestly limits impact to file-level when no AST symbol matches hunk', () => {
    const changedFiles = [
      {
        path: 'src/config.ts',
        changeType: 'modified',
        hunks: [{ oldStart: 1, oldLines: 3, newStart: 1, newLines: 3 }],
      },
    ];
    const symbols = [
      {
        symbolKey: 'src/config.ts#AppConfig:interface:20:1',
        name: 'AppConfig',
        kind: 'interface',
        file: 'src/config.ts',
        lineStart: 20,
        lineEnd: 30,
        isExported: true,
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols,
      nodes: [],
      edges: [],
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report.summary.changedFilesCount).toBe(1);
    expect(report.summary.changedSymbolsCount).toBe(0);
    expect(report.results.length).toBe(1);
    expect(report.results[0]?.targetKey).toBe('file:src/config.ts');
  });

  it('handles deleted files and renamed files with provenance metadata without fabricating symbols', () => {
    const changedFiles = [
      { path: 'src/old.ts', changeType: 'deleted' },
      { path: 'src/new.ts', changeType: 'renamed', oldPath: 'src/legacy.ts' },
    ];
    const symbols = [
      {
        symbolKey: 'src/old.ts#ghost:function:1:1',
        name: 'ghost',
        kind: 'function',
        file: 'src/old.ts',
        lineStart: 1,
        lineEnd: 5,
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols,
      nodes: [],
      edges: [],
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report.summary.changedFilesCount).toBe(2);
    expect(report.summary.changedSymbolsCount).toBe(0);
    expect(report.results.some((r) => r.targetKey === 'symbol:src/old.ts#ghost:function:1:1')).toBe(false);

    const renamed = report.results.find((r) => r.targetKey === 'file:src/new.ts');
    expect(renamed).toBeDefined();
    expect(renamed?.metadata).toEqual({ changeType: 'renamed', oldPath: 'src/legacy.ts' });
  });

  it('preserves distinct origin evidence when multiple changed files reach the same target', () => {
    const changedFiles = [
      { path: 'src/originA.ts', changeType: 'modified' },
      { path: 'src/originB.ts', changeType: 'modified' },
    ];
    const edges = [
      {
        edgeKey: 'file:src/sharedTarget.ts->file:src/originA.ts:imports_module:1:1',
        from: 'file:src/sharedTarget.ts',
        to: 'file:src/originA.ts',
        kind: 'imports_module',
        sourceFile: 'src/sharedTarget.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
      {
        edgeKey: 'file:src/sharedTarget.ts->file:src/originB.ts:imports_module:2:1',
        from: 'file:src/sharedTarget.ts',
        to: 'file:src/originB.ts',
        kind: 'imports_module',
        sourceFile: 'src/sharedTarget.ts',
        sourceLine: 2,
        resolutionStatus: 'resolved',
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols: [],
      nodes: [],
      edges,
      analysisId,
      repositoryId,
      commitSha,
    });

    const targetFromA = report.results.find(
      (r) => r.targetKey === 'file:src/sharedTarget.ts' && r.sourceChangeKey === 'file:src/originA.ts'
    );
    expect(targetFromA).toBeDefined();
    expect(targetFromA?.sourceChangeFile).toBe('src/originA.ts');
    expect(targetFromA?.classification).toBe('direct');

    const targetFromB = report.results.find(
      (r) => r.targetKey === 'file:src/sharedTarget.ts' && r.sourceChangeKey === 'file:src/originB.ts'
    );
    expect(targetFromB).toBeDefined();
    expect(targetFromB?.sourceChangeFile).toBe('src/originB.ts');
    expect(targetFromB?.classification).toBe('direct');
  });

  it('traverses references_symbol relationship edges correctly', () => {
    const changedFiles = [{ path: 'src/data.ts', changeType: 'modified' }];
    const symbols = [
      {
        symbolKey: 'src/data.ts#RecordItem:type:1:1',
        name: 'RecordItem',
        kind: 'type',
        file: 'src/data.ts',
        lineStart: 1,
        lineEnd: 3,
        isExported: true,
      },
    ];
    const edges = [
      {
        edgeKey: 'file:src/view.ts->symbol:src/data.ts#RecordItem:type:1:1:references_symbol:10:5',
        from: 'file:src/view.ts',
        to: 'symbol:src/data.ts#RecordItem:type:1:1',
        kind: 'references_symbol',
        sourceFile: 'src/view.ts',
        sourceLine: 10,
        resolutionStatus: 'resolved',
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols,
      nodes: [],
      edges,
      analysisId,
      repositoryId,
      commitSha,
    });

    const refImpact = report.results.find((r) => r.targetKey === 'file:src/view.ts');
    expect(refImpact).toBeDefined();
    expect(refImpact?.classification).toBe('direct');
    expect(refImpact?.relationshipTypes).toEqual(['contains', 'references_symbol']);
  });

  it('detects deletion at the end of a symbol as a modified symbol', () => {
    const changedFiles = [
      {
        path: 'src/math.ts',
        changeType: 'modified',
        hunks: [{ oldStart: 22, oldLines: 4, newStart: 22, newLines: 0 }],
      },
    ];
    const symbols = [
      {
        symbolKey: 'src/math.ts#calculate:function:10:1',
        name: 'calculate',
        kind: 'function',
        file: 'src/math.ts',
        lineStart: 10,
        lineEnd: 25,
        isExported: true,
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols,
      nodes: [],
      edges: [],
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report.summary.changedFilesCount).toBe(1);
    expect(report.summary.changedSymbolsCount).toBe(1);
    expect(report.results.some((r) => r.targetKey === 'symbol:src/math.ts#calculate:function:10:1')).toBe(true);
  });

  it('handles deletion of an entire symbol by falling back to file-level impact without fabricating symbols', () => {
    const changedFiles = [
      {
        path: 'src/math.ts',
        changeType: 'modified',
        hunks: [{ oldStart: 5, oldLines: 15, newStart: 5, newLines: 0 }],
      },
    ];
    const symbols = [
      {
        symbolKey: 'src/math.ts#keep:function:40:1',
        name: 'keep',
        kind: 'function',
        file: 'src/math.ts',
        lineStart: 40,
        lineEnd: 50,
        isExported: true,
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols,
      nodes: [],
      edges: [],
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report.summary.changedFilesCount).toBe(1);
    expect(report.summary.changedSymbolsCount).toBe(0);
    expect(report.results.length).toBe(1);
    expect(report.results[0]?.targetKey).toBe('file:src/math.ts');
  });

  it('handles a deletion between surviving symbols without fabricating nonexistent symbol impacts', () => {
    const changedFiles = [
      {
        path: 'src/math.ts',
        changeType: 'modified',
        hunks: [{ oldStart: 15, oldLines: 6, newStart: 15, newLines: 0 }],
      },
    ];
    const symbols = [
      {
        symbolKey: 'src/math.ts#topFunc:function:1:1',
        name: 'topFunc',
        kind: 'function',
        file: 'src/math.ts',
        lineStart: 1,
        lineEnd: 10,
        isExported: true,
      },
      {
        symbolKey: 'src/math.ts#bottomFunc:function:25:1',
        name: 'bottomFunc',
        kind: 'function',
        file: 'src/math.ts',
        lineStart: 25,
        lineEnd: 35,
        isExported: true,
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols,
      nodes: [],
      edges: [],
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report.summary.changedFilesCount).toBe(1);
    expect(report.summary.changedSymbolsCount).toBe(0);
    expect(report.results.length).toBe(1);
    expect(report.results[0]?.targetKey).toBe('file:src/math.ts');
  });

  it('handles renamed files accounting for new path, preserving old identity, and reporting old-path limitations', () => {
    const changedFiles = [
      {
        path: 'src/calc.ts',
        changeType: 'renamed',
        oldPath: 'src/math.ts',
      },
    ];
    const nodes = [
      { nodeKey: 'file:src/calc.ts', nodeType: 'file', name: 'calc.ts' },
      { nodeKey: 'file:src/consumerNew.ts', nodeType: 'file', name: 'consumerNew.ts' },
    ];
    const edges = [
      {
        edgeKey: 'file:src/consumerNew.ts->file:src/calc.ts:imports_module:1:1',
        from: 'file:src/consumerNew.ts',
        to: 'file:src/calc.ts',
        kind: 'imports_module',
        sourceFile: 'src/consumerNew.ts',
        sourceLine: 1,
        resolutionStatus: 'resolved',
      },
    ];

    const report = traverseImpact({
      changedFiles,
      symbols: [],
      nodes,
      edges,
      analysisId,
      repositoryId,
      commitSha,
    });

    expect(report.summary.changedFilesCount).toBe(1);
    expect(report.summary.directImpactCount).toBe(1);

    const changedFile = report.results.find((r) => r.targetKey === 'file:src/calc.ts');
    expect(changedFile).toBeDefined();
    expect(changedFile?.metadata).toEqual({ changeType: 'renamed', oldPath: 'src/math.ts' });

    const consumerNew = report.results.find((r) => r.targetKey === 'file:src/consumerNew.ts');
    expect(consumerNew).toBeDefined();
    expect(consumerNew?.classification).toBe('direct');

    expect(report.summary.limitations?.length).toBeGreaterThan(0);
    expect(report.summary.limitations?.[0]).toContain('src/math.ts');
  });
});
