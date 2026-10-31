import { describe, it, expect } from 'vitest';
import { calculateDeterministicRisk, RISK_MODEL_VERSION } from './scoring.js';
import { identifyChangedSymbols } from './analyzer.js';
import { validateRiskProvenance } from './persistence.js';
import { RiskScoringInput } from './types.js';

describe('Deterministic Risk Engine Unit Tests', () => {
  const baseInput: RiskScoringInput = {
    analysisId: 'anl_test_01',
    repositoryId: 'repo_test_01',
    commitSha: 'commit_sha_1234',
    changedFiles: [],
    changedSymbols: [],
    impactResults: [],
    investigations: [
      { stage: 'git_ingestion_complete', status: 'completed' },
      { stage: 'ast_extraction_complete', status: 'completed' },
      { stage: 'dependency_graph_complete', status: 'completed' },
      { stage: 'impact_analysis_complete', status: 'completed' },
    ],
    hasDiffHunks: true,
    isVerifiedEmptyDiff: true,
  };

  it('1. evaluates zero risk and 100 confidence when no files are changed in a verified empty diff', () => {
    const report = calculateDeterministicRisk(baseInput);

    expect(report.score).toBe(0);
    expect(report.level).toBe('low');
    expect(report.severity).toBe(0);
    expect(report.likelihood).toBe(0);
    expect(report.confidence).toBe(100);
    expect(report.uncertaintyScore).toBe(0);
    expect(report.uncertaintyAdjustment).toBe(0);
    expect(report.stage).toBe('risk_analysis_complete');
    expect(report.highestRiskTargets).toHaveLength(0);
  });

  it('distinguishes unverified empty diff from verified empty diff and penalizes confidence', () => {
    const unverifiedInput: RiskScoringInput = {
      ...baseInput,
      isVerifiedEmptyDiff: false,
    };

    const report = calculateDeterministicRisk(unverifiedInput);

    expect(report.confidence).toBeLessThan(50);
    expect(report.stage).toBe('risk_analysis_partial');
    expect(report.limitations.some((l) => l.includes('Unverified empty diff'))).toBe(true);
  });

  it('2. evaluates low risk for one small isolated change without dependents', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/utils/math.ts', changeType: 'modified' }],
      changedSymbols: [
        {
          symbolKey: 'src/utils/math.ts#add:function:1:1',
          name: 'add',
          kind: 'function',
          file: 'src/utils/math.ts',
          isExported: false,
          isReExport: false,
        },
      ],
      impactResults: [
        {
          resultKey: 'res_1',
          targetKey: 'file:src/utils/math.ts',
          targetType: 'file',
          targetFile: 'src/utils/math.ts',
          targetSymbol: null,
          sourceChangeKey: 'file:src/utils/math.ts',
          sourceChangeFile: 'src/utils/math.ts',
          sourceChangeSymbol: null,
          classification: 'changed',
          depth: 0,
          path: ['file:src/utils/math.ts'],
          relationshipTypes: ['changed'],
          edgeKeys: [],
          resolutionStatus: 'resolved',
        },
      ],
    };

    const report = calculateDeterministicRisk(input);

    expect(report.score).toBeGreaterThan(0);
    expect(report.score).toBeLessThanOrEqual(25);
    expect(report.level).toBe('low');
    expect(report.confidence).toBe(100);
    expect(report.confirmedExposure.directDependentsCount).toBe(0);
  });

  it('3. scales score proportionally for multiple changed files', () => {
    const singleChange: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/a.ts', changeType: 'modified' }],
      changedSymbols: [{ symbolKey: 'src/a.ts#a:var:1:1', name: 'a', kind: 'var', file: 'src/a.ts' }],
    };

    const multipleChanges: RiskScoringInput = {
      ...baseInput,
      changedFiles: [
        { path: 'src/a.ts', changeType: 'modified' },
        { path: 'src/b.ts', changeType: 'modified' },
        { path: 'src/c.ts', changeType: 'modified' },
      ],
      changedSymbols: [
        { symbolKey: 'src/a.ts#a:var:1:1', name: 'a', kind: 'var', file: 'src/a.ts' },
        { symbolKey: 'src/b.ts#b:var:1:1', name: 'b', kind: 'var', file: 'src/b.ts' },
        { symbolKey: 'src/c.ts#c:var:1:1', name: 'c', kind: 'var', file: 'src/c.ts' },
      ],
    };

    const reportSingle = calculateDeterministicRisk(singleChange);
    const reportMulti = calculateDeterministicRisk(multipleChanges);

    expect(reportMulti.score).toBeGreaterThan(reportSingle.score);
    expect(reportMulti.factors.find((f) => f.dimension === 'change_magnitude')?.contribution).toBeGreaterThan(
      reportSingle.factors.find((f) => f.dimension === 'change_magnitude')?.contribution ?? 0
    );
  });

  it('4. assigns high severity for large change magnitude with deletions', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [
        { path: 'src/core/deleted1.ts', changeType: 'deleted' },
        { path: 'src/core/deleted2.ts', changeType: 'deleted' },
        { path: 'src/core/deleted3.ts', changeType: 'deleted' },
        { path: 'src/core/renamed.ts', changeType: 'renamed', oldPath: 'src/core/old.ts' },
        { path: 'src/core/modified.ts', changeType: 'modified' },
      ],
      changedSymbols: [
        { symbolKey: 's1', name: 'sym1', kind: 'class', file: 'src/core/modified.ts' },
        { symbolKey: 's2', name: 'sym2', kind: 'func', file: 'src/core/modified.ts' },
        { symbolKey: 's3', name: 'sym3', kind: 'func', file: 'src/core/renamed.ts' },
      ],
    };

    const report = calculateDeterministicRisk(input);

    expect(report.severity).toBeGreaterThan(25);
    expect(report.factors.find((f) => f.dimension === 'change_magnitude')?.contribution).toBeGreaterThanOrEqual(50);
  });

  it('5. increases exposure and likelihood with confirmed direct dependency exposure', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/service.ts', changeType: 'modified' }],
      changedSymbols: [{ symbolKey: 'src/service.ts#Service:class:1:1', name: 'Service', kind: 'class', file: 'src/service.ts' }],
      impactResults: [
        {
          resultKey: 'imp_1',
          targetKey: 'file:src/clientA.ts',
          targetType: 'file',
          targetFile: 'src/clientA.ts',
          targetSymbol: null,
          sourceChangeKey: 'file:src/service.ts',
          sourceChangeFile: 'src/service.ts',
          sourceChangeSymbol: null,
          classification: 'direct',
          depth: 1,
          path: ['file:src/service.ts', 'file:src/clientA.ts'],
          relationshipTypes: ['imports_module'],
          edgeKeys: ['e1'],
          resolutionStatus: 'resolved',
        },
        {
          resultKey: 'imp_2',
          targetKey: 'file:src/clientB.ts',
          targetType: 'file',
          targetFile: 'src/clientB.ts',
          targetSymbol: null,
          sourceChangeKey: 'file:src/service.ts',
          sourceChangeFile: 'src/service.ts',
          sourceChangeSymbol: null,
          classification: 'direct',
          depth: 1,
          path: ['file:src/service.ts', 'file:src/clientB.ts'],
          relationshipTypes: ['imports_module'],
          edgeKeys: ['e2'],
          resolutionStatus: 'resolved',
        },
      ],
    };

    const report = calculateDeterministicRisk(input);

    expect(report.confirmedExposure.directDependentsCount).toBe(2);
    expect(report.factors.find((f) => f.dimension === 'dependency_exposure')?.contribution).toBeGreaterThanOrEqual(30);
    expect(report.likelihood).toBeGreaterThanOrEqual(25);
  });

  it('6. accounts for high transitive dependency exposure across deep traversal', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/base.ts', changeType: 'modified' }],
      changedSymbols: [{ symbolKey: 'src/base.ts#base:var:1:1', name: 'base', kind: 'var', file: 'src/base.ts' }],
      impactResults: [
        {
          resultKey: 'imp_1',
          targetKey: 'file:src/mid.ts',
          targetType: 'file',
          targetFile: 'src/mid.ts',
          targetSymbol: null,
          sourceChangeKey: 'file:src/base.ts',
          sourceChangeFile: 'src/base.ts',
          sourceChangeSymbol: null,
          classification: 'direct',
          depth: 1,
          path: ['file:src/base.ts', 'file:src/mid.ts'],
          relationshipTypes: ['imports_module'],
          edgeKeys: ['e1'],
          resolutionStatus: 'resolved',
        },
        {
          resultKey: 'imp_2',
          targetKey: 'file:src/leaf.ts',
          targetType: 'file',
          targetFile: 'src/leaf.ts',
          targetSymbol: null,
          sourceChangeKey: 'file:src/base.ts',
          sourceChangeFile: 'src/base.ts',
          sourceChangeSymbol: null,
          classification: 'transitive',
          depth: 2,
          path: ['file:src/base.ts', 'file:src/mid.ts', 'file:src/leaf.ts'],
          relationshipTypes: ['imports_module', 'imports_module'],
          edgeKeys: ['e1', 'e2'],
          resolutionStatus: 'resolved',
        },
      ],
    };

    const report = calculateDeterministicRisk(input);

    expect(report.confirmedExposure.maxDepthReached).toBe(2);
    expect(report.confirmedExposure.transitiveDependentsCount).toBe(1);
    expect(report.confirmedExposure.distinctImpactedFiles).toBe(2);
  });

  it('7. reflects elevated structural importance when exported public symbols change', () => {
    const inputUnexported: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/helper.ts', changeType: 'modified' }],
      changedSymbols: [{ symbolKey: 's1', name: 'secret', kind: 'func', file: 'src/helper.ts', isExported: false }],
    };

    const inputExported: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/helper.ts', changeType: 'modified' }],
      changedSymbols: [{ symbolKey: 's1', name: 'publicApi', kind: 'func', file: 'src/helper.ts', isExported: true }],
    };

    const reportUnexp = calculateDeterministicRisk(inputUnexported);
    const reportExp = calculateDeterministicRisk(inputExported);

    expect(reportExp.factors.find((f) => f.dimension === 'structural_importance')?.contribution).toBeGreaterThan(
      reportUnexp.factors.find((f) => f.dimension === 'structural_importance')?.contribution ?? 0
    );
  });

  it('8. elevates structural importance for re-export modifications', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/index.ts', changeType: 'modified' }],
      changedSymbols: [
        { symbolKey: 're1', name: 'Button', kind: 'export_all', file: 'src/index.ts', isExported: true, isReExport: true },
        { symbolKey: 're2', name: 'Card', kind: 'export_all', file: 'src/index.ts', isExported: true, isReExport: true },
      ],
    };

    const report = calculateDeterministicRisk(input);

    expect(report.factors.find((f) => f.dimension === 'structural_importance')?.contribution).toBeGreaterThanOrEqual(50);
  });

  it('9. verifies that adding an unresolved edge does not increase confirmed dependent counts and lowers confidence', () => {
    const baselineInput: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/core.ts', changeType: 'modified' }],
      impactResults: [
        {
          resultKey: 'dir_1',
          targetKey: 'file:src/dep.ts',
          targetType: 'file',
          targetFile: 'src/dep.ts',
          targetSymbol: null,
          sourceChangeKey: 'file:src/core.ts',
          sourceChangeFile: 'src/core.ts',
          sourceChangeSymbol: null,
          classification: 'direct',
          depth: 1,
          path: ['file:src/core.ts', 'file:src/dep.ts'],
          relationshipTypes: ['imports_module'],
          edgeKeys: ['e1'],
          resolutionStatus: 'resolved',
        },
      ],
    };

    const withUnresolvedInput: RiskScoringInput = {
      ...baselineInput,
      impactResults: [
        ...baselineInput.impactResults,
        {
          resultKey: 'unres_1',
          targetKey: 'module:./unknown',
          targetType: 'module',
          targetFile: null,
          targetSymbol: null,
          sourceChangeKey: 'file:src/core.ts',
          sourceChangeFile: 'src/core.ts',
          sourceChangeSymbol: null,
          classification: 'unresolved',
          depth: 1,
          path: ['file:src/core.ts'],
          relationshipTypes: ['imports_module'],
          edgeKeys: ['e_unknown'],
          resolutionStatus: 'unresolved',
        },
      ],
    };

    const baselineReport = calculateDeterministicRisk(baselineInput);
    const unresolvedReport = calculateDeterministicRisk(withUnresolvedInput);

    expect(unresolvedReport.confirmedExposure.directDependentsCount).toBe(
      baselineReport.confirmedExposure.directDependentsCount
    );
    expect(unresolvedReport.confirmedExposure.transitiveDependentsCount).toBe(
      baselineReport.confirmedExposure.transitiveDependentsCount
    );
    expect(unresolvedReport.potentialExposure.unresolvedCount).toBe(1);
    expect(unresolvedReport.confidence).toBeLessThan(baselineReport.confidence);
    expect(unresolvedReport.uncertaintyAdjustment).toBeGreaterThan(0);
    expect(unresolvedReport.stage).toBe('risk_analysis_partial');
  });

  it('10. verifies that adding an ambiguous edge does not create a confirmed affected target', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/lib.ts', changeType: 'modified' }],
      impactResults: [
        {
          resultKey: 'ambig_1',
          targetKey: 'module:./poly',
          targetType: 'module',
          targetFile: null,
          targetSymbol: null,
          sourceChangeKey: 'file:src/lib.ts',
          sourceChangeFile: 'src/lib.ts',
          sourceChangeSymbol: null,
          classification: 'ambiguous',
          depth: 1,
          path: ['file:src/lib.ts'],
          relationshipTypes: ['imports_module'],
          edgeKeys: ['e_ambig'],
          resolutionStatus: 'ambiguous',
        },
      ],
    };

    const report = calculateDeterministicRisk(input);

    expect(report.confirmedExposure.directDependentsCount).toBe(0);
    expect(report.confirmedExposure.transitiveDependentsCount).toBe(0);
    expect(report.potentialExposure.ambiguousCount).toBe(1);
    expect(report.highestRiskTargets.find((t) => t.targetKey === 'module:./poly')?.isConfirmed).toBe(false);
  });

  it('11. adjusts confidence and marks stage partial on partial AST extraction', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/partial.ts', changeType: 'modified' }],
      investigations: [
        { stage: 'git_ingestion_complete', status: 'completed' },
        { stage: 'ast_extraction_partial', status: 'in_progress' },
        { stage: 'dependency_graph_complete', status: 'completed' },
      ],
    };

    const report = calculateDeterministicRisk(input);

    expect(report.confidence).toBeLessThanOrEqual(80);
    expect(report.stage).toBe('risk_analysis_partial');
    expect(report.limitations.some((l) => l.includes('AST extraction completed with partial'))).toBe(true);
  });

  it('12. adjusts confidence and marks stage partial on partial dependency graph', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/partial.ts', changeType: 'modified' }],
      investigations: [
        { stage: 'git_ingestion_complete', status: 'completed' },
        { stage: 'ast_extraction_complete', status: 'completed' },
        { stage: 'dependency_graph_partial', status: 'in_progress' },
      ],
    };

    const report = calculateDeterministicRisk(input);

    expect(report.confidence).toBeLessThanOrEqual(75);
    expect(report.stage).toBe('risk_analysis_partial');
    expect(report.limitations.some((l) => l.includes('Dependency graph completed with unresolved'))).toBe(true);
  });

  it('13. adjusts confidence and marks stage partial on partial impact report', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/partial.ts', changeType: 'modified' }],
      investigations: [
        { stage: 'git_ingestion_complete', status: 'completed' },
        { stage: 'ast_extraction_complete', status: 'completed' },
        { stage: 'dependency_graph_complete', status: 'completed' },
        { stage: 'impact_analysis_partial', status: 'in_progress' },
      ],
    };

    const report = calculateDeterministicRisk(input);

    expect(report.confidence).toBeLessThanOrEqual(75);
    expect(report.stage).toBe('risk_analysis_partial');
    expect(report.limitations.some((l) => l.includes('Change impact analysis completed with partial'))).toBe(true);
  });

  it('16. identifies high potential risk with low confidence when exposure is large but unresolved', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/core.ts', changeType: 'modified' }],
      changedSymbols: [
        { symbolKey: 'src/core.ts#coreFn:func:1:1', name: 'coreFn', kind: 'func', file: 'src/core.ts', isExported: true },
      ],
      impactResults: [
        {
          resultKey: 'u1',
          targetKey: 'module:./unknown1',
          targetType: 'module',
          targetFile: null,
          targetSymbol: null,
          sourceChangeKey: 'file:src/core.ts',
          sourceChangeFile: 'src/core.ts',
          sourceChangeSymbol: null,
          classification: 'unresolved',
          depth: 1,
          path: [],
          relationshipTypes: [],
          edgeKeys: [],
          resolutionStatus: 'unresolved',
        },
        {
          resultKey: 'u2',
          targetKey: 'module:./unknown2',
          targetType: 'module',
          targetFile: null,
          targetSymbol: null,
          sourceChangeKey: 'file:src/core.ts',
          sourceChangeFile: 'src/core.ts',
          sourceChangeSymbol: null,
          classification: 'unresolved',
          depth: 1,
          path: [],
          relationshipTypes: [],
          edgeKeys: [],
          resolutionStatus: 'unresolved',
        },
      ],
      investigations: [
        { stage: 'git_ingestion_complete', status: 'completed' },
        { stage: 'ast_extraction_complete', status: 'completed' },
        { stage: 'dependency_graph_complete', status: 'completed' },
        { stage: 'impact_analysis_partial', status: 'in_progress' },
      ],
    };

    const report = calculateDeterministicRisk(input);

    expect(report.score).toBeGreaterThanOrEqual(35);
    expect(report.severity).toBeGreaterThan(50);
    expect(report.confidence).toBeLessThan(70);
    expect(report.uncertaintyAdjustment).toBeGreaterThan(0);
    expect(report.potentialExposure.unresolvedCount).toBe(2);
    expect(report.confirmedExposure.directDependentsCount).toBe(0);
    expect(report.confirmedExposure.transitiveDependentsCount).toBe(0);
    expect(report.likelihood).toBeLessThanOrEqual(30);
  });

  it('17. warns that low observed risk cannot guarantee safety when evidence is incomplete', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/single.ts', changeType: 'modified' }],
      impactResults: [
        {
          resultKey: 'u1',
          targetKey: 'module:./unknown',
          targetType: 'module',
          targetFile: null,
          targetSymbol: null,
          sourceChangeKey: 'file:src/single.ts',
          sourceChangeFile: 'src/single.ts',
          sourceChangeSymbol: null,
          classification: 'unresolved',
          depth: 1,
          path: [],
          relationshipTypes: [],
          edgeKeys: [],
          resolutionStatus: 'unresolved',
        },
      ],
      investigations: [
        { stage: 'git_ingestion_complete', status: 'completed' },
        { stage: 'ast_extraction_complete', status: 'completed' },
        { stage: 'dependency_graph_partial', status: 'in_progress' },
        { stage: 'impact_analysis_partial', status: 'in_progress' },
      ],
    };

    const report = calculateDeterministicRisk(input);

    expect(report.score).toBeLessThanOrEqual(35);
    expect(report.confidence).toBeLessThan(70);
    expect(report.limitations.some((l) => l.includes('cannot guarantee safety'))).toBe(true);
  });

  it('18. verifies distinct severity, likelihood, and confidence metrics, keeping confirmed exposure and uncertainty separately visible', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [
        { path: 'src/schema.ts', changeType: 'modified' },
        { path: 'src/index.ts', changeType: 'modified' },
      ],
      changedSymbols: [
        { symbolKey: 'src/schema.ts#User:type:1:1', name: 'User', kind: 'type', file: 'src/schema.ts', isExported: true },
      ],
      impactResults: [
        {
          resultKey: 'dir_1',
          targetKey: 'file:src/userRepo.ts',
          targetType: 'file',
          targetFile: 'src/userRepo.ts',
          targetSymbol: null,
          sourceChangeKey: 'file:src/schema.ts',
          sourceChangeFile: 'src/schema.ts',
          sourceChangeSymbol: null,
          classification: 'direct',
          depth: 1,
          path: ['file:src/schema.ts', 'file:src/userRepo.ts'],
          relationshipTypes: ['imports_module'],
          edgeKeys: ['e1'],
          resolutionStatus: 'resolved',
        },
        {
          resultKey: 'unres_1',
          targetKey: 'module:./missing',
          targetType: 'module',
          targetFile: null,
          targetSymbol: null,
          sourceChangeKey: 'file:src/schema.ts',
          sourceChangeFile: 'src/schema.ts',
          sourceChangeSymbol: null,
          classification: 'unresolved',
          depth: 1,
          path: [],
          relationshipTypes: [],
          edgeKeys: [],
          resolutionStatus: 'unresolved',
        },
      ],
      investigations: [
        { stage: 'git_ingestion_complete', status: 'completed' },
        { stage: 'ast_extraction_complete', status: 'completed' },
        { stage: 'dependency_graph_complete', status: 'completed' },
        { stage: 'impact_analysis_complete', status: 'completed' },
      ],
      hasDiffHunks: true,
    };

    const report = calculateDeterministicRisk(input);

    expect(report.severity).toBeDefined();
    expect(report.likelihood).toBeDefined();
    expect(report.confidence).toBeDefined();
    expect(report.confirmedExposure).toBeDefined();
    expect(report.potentialExposure).toBeDefined();
    expect(report.confirmedExposure.directDependentsCount).toBe(1);
    expect(report.potentialExposure.unresolvedCount).toBe(1);
  });

  it('19. produces identical, deterministic results across repeated executions', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/app.ts', changeType: 'modified' }],
      changedSymbols: [{ symbolKey: 'src/app.ts#app:func:1:1', name: 'app', kind: 'func', file: 'src/app.ts', isExported: true }],
      impactResults: [
        {
          resultKey: 'r1',
          targetKey: 'file:src/server.ts',
          targetType: 'file',
          targetFile: 'src/server.ts',
          targetSymbol: null,
          sourceChangeKey: 'file:src/app.ts',
          sourceChangeFile: 'src/app.ts',
          sourceChangeSymbol: null,
          classification: 'direct',
          depth: 1,
          path: ['file:src/app.ts', 'file:src/server.ts'],
          relationshipTypes: ['imports_module'],
          edgeKeys: ['e_server'],
          resolutionStatus: 'resolved',
        },
      ],
    };

    const reportA = calculateDeterministicRisk(input);
    const reportB = calculateDeterministicRisk(input);

    expect(reportA.score).toBe(reportB.score);
    expect(reportA.level).toBe(reportB.level);
    expect(reportA.severity).toBe(reportB.severity);
    expect(reportA.likelihood).toBe(reportB.likelihood);
    expect(reportA.confidence).toBe(reportB.confidence);
    expect(reportA.factors).toEqual(reportB.factors);
    expect(reportA.highestRiskTargets.map((t) => t.score)).toEqual(reportB.highestRiskTargets.map((t) => t.score));
  });

  it('24. penalizes confidence and reports warning when git diff metadata is missing', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/app.ts', changeType: 'modified' }],
      hasDiffHunks: false,
    };

    const report = calculateDeterministicRisk(input);

    expect(report.confidence).toBe(85);
    expect(report.missingEvidence.some((m) => m.includes('diff statistics were unavailable'))).toBe(true);
  });

  it('25. records scoring model version v1.1.0-deterministic', () => {
    const report = calculateDeterministicRisk(baseInput);

    expect(report.modelVersion).toBe('v1.1.0-deterministic');
    expect(RISK_MODEL_VERSION).toBe('v1.1.0-deterministic');
  });

  it('identifies changed symbols with hunk matching: change in one function does not mark another function', () => {
    const symbols = [
      {
        symbolKey: 'file.ts#fnA:function:10:20',
        name: 'fnA',
        kind: 'function',
        file: 'file.ts',
        lineStart: 10,
        lineEnd: 20,
        isExported: true,
        isReExport: false,
      },
      {
        symbolKey: 'file.ts#fnB:function:30:40',
        name: 'fnB',
        kind: 'function',
        file: 'file.ts',
        lineStart: 30,
        lineEnd: 40,
        isExported: false,
        isReExport: false,
      },
    ];

    const changedFiles = [{ path: 'file.ts', changeType: 'modified' }];
    const diffFiles = [
      {
        path: 'file.ts',
        changeType: 'modified',
        hunks: [{ oldStart: 12, oldLines: 3, newStart: 12, newLines: 5 }],
      },
    ];

    const matched = identifyChangedSymbols(symbols, changedFiles, diffFiles);

    expect(matched).toHaveLength(1);
    expect(matched[0].name).toBe('fnA');
    expect(matched[0].symbolKey).toBe('file.ts#fnA:function:10:20');
  });

  it('identifies changed symbols with hunk matching: change between two functions does not mark either function', () => {
    const symbols = [
      {
        symbolKey: 'file.ts#fnA:function:10:20',
        name: 'fnA',
        kind: 'function',
        file: 'file.ts',
        lineStart: 10,
        lineEnd: 20,
        isExported: true,
        isReExport: false,
      },
      {
        symbolKey: 'file.ts#fnB:function:30:40',
        name: 'fnB',
        kind: 'function',
        file: 'file.ts',
        lineStart: 30,
        lineEnd: 40,
        isExported: false,
        isReExport: false,
      },
    ];

    const changedFiles = [{ path: 'file.ts', changeType: 'modified' }];
    const diffFiles = [
      {
        path: 'file.ts',
        changeType: 'modified',
        hunks: [{ oldStart: 24, oldLines: 2, newStart: 24, newLines: 2 }],
      },
    ];

    const matched = identifyChangedSymbols(symbols, changedFiles, diffFiles);

    expect(matched).toHaveLength(0);
  });

  it('identifies changed symbols: deleted file with no surviving AST symbols produces file-level evidence only', () => {
    const symbols = [
      {
        symbolKey: 'surviving.ts#fn:function:5:15',
        name: 'fn',
        kind: 'function',
        file: 'surviving.ts',
        lineStart: 5,
        lineEnd: 15,
        isExported: true,
        isReExport: false,
      },
    ];

    const changedFiles = [{ path: 'deleted.ts', changeType: 'deleted' }];
    const diffFiles = [
      {
        path: 'deleted.ts',
        changeType: 'deleted',
        hunks: [{ oldStart: 1, oldLines: 20, newStart: 0, newLines: 0 }],
      },
    ];

    const matched = identifyChangedSymbols(symbols, changedFiles, diffFiles);

    expect(matched).toHaveLength(0);
  });

  it('classifies directly changed symbols as isConfirmed: true with changed classification', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/calc.ts', changeType: 'modified' }],
      changedSymbols: [
        {
          symbolKey: 'src/calc.ts#add:function:5:10',
          name: 'add',
          kind: 'function',
          file: 'src/calc.ts',
          changeType: 'modified',
          isExported: true,
        },
      ],
      impactResults: [],
    };

    const report = calculateDeterministicRisk(input);
    const target = report.highestRiskTargets.find((t) => t.targetKey === 'src/calc.ts#add:function:5:10');

    expect(target).toBeDefined();
    expect(target?.isConfirmed).toBe(true);
    expect(target?.evidence.classification).toBe('changed');
    expect(target?.reasons.some((r) => r.includes('Directly changed component'))).toBe(true);
  });

  it('validates analysis, repository, and commit provenance, throwing errors on mismatches', () => {
    const validReport = calculateDeterministicRisk(baseInput);

    expect(() =>
      validateRiskProvenance(validReport, {
        id: 'different_anl_id',
        repositoryId: baseInput.repositoryId,
        headSha: baseInput.commitSha,
      })
    ).toThrow('Analysis ID mismatch');

    expect(() =>
      validateRiskProvenance(validReport, {
        id: baseInput.analysisId,
        repositoryId: 'different_repo_id',
        headSha: baseInput.commitSha,
      })
    ).toThrow('Repository ID mismatch');

    expect(() =>
      validateRiskProvenance(validReport, {
        id: baseInput.analysisId,
        repositoryId: baseInput.repositoryId,
        headSha: 'different_head_sha',
      })
    ).toThrow('Commit SHA mismatch');
  });

  it('records limitations when graph edge keys are not in persisted dependency graph records', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/entry.ts', changeType: 'modified' }],
      impactResults: [
        {
          resultKey: 'r1',
          targetKey: 'file:src/target.ts',
          targetType: 'file',
          targetFile: 'src/target.ts',
          targetSymbol: null,
          sourceChangeKey: 'file:src/entry.ts',
          sourceChangeFile: 'src/entry.ts',
          sourceChangeSymbol: null,
          classification: 'direct',
          depth: 1,
          path: ['file:src/entry.ts', 'file:src/target.ts'],
          relationshipTypes: ['imports_module'],
          edgeKeys: ['e_persisted', 'e_unknown_orphaned'],
          resolutionStatus: 'resolved',
        },
      ],
      validEdgeKeys: new Set(['e_persisted']),
    };

    const report = calculateDeterministicRisk(input);

    expect(report.limitations.some((l) => l.includes('e_unknown_orphaned'))).toBe(true);
    const target = report.highestRiskTargets.find((t) => t.targetKey === 'file:src/target.ts');
    expect(target?.unresolvedLimitations.some((l) => l.includes('e_unknown_orphaned'))).toBe(true);
  });

  it('preserves multiple contributing sources reaching the same target component', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [
        { path: 'src/sourceA.ts', changeType: 'modified' },
        { path: 'src/sourceB.ts', changeType: 'modified' },
      ],
      impactResults: [
        {
          resultKey: 'rA',
          targetKey: 'file:src/common.ts',
          targetType: 'file',
          targetFile: 'src/common.ts',
          targetSymbol: null,
          sourceChangeKey: 'file:src/sourceA.ts',
          sourceChangeFile: 'src/sourceA.ts',
          sourceChangeSymbol: null,
          classification: 'direct',
          depth: 1,
          path: ['file:src/sourceA.ts', 'file:src/common.ts'],
          relationshipTypes: ['imports_module'],
          edgeKeys: ['eA'],
          resolutionStatus: 'resolved',
        },
        {
          resultKey: 'rB',
          targetKey: 'file:src/common.ts',
          targetType: 'file',
          targetFile: 'src/common.ts',
          targetSymbol: null,
          sourceChangeKey: 'file:src/sourceB.ts',
          sourceChangeFile: 'src/sourceB.ts',
          sourceChangeSymbol: null,
          classification: 'direct',
          depth: 1,
          path: ['file:src/sourceB.ts', 'file:src/common.ts'],
          relationshipTypes: ['imports_module'],
          edgeKeys: ['eB'],
          resolutionStatus: 'resolved',
        },
      ],
    };

    const report = calculateDeterministicRisk(input);
    const target = report.highestRiskTargets.find((t) => t.targetKey === 'file:src/common.ts');

    expect(target).toBeDefined();
    expect(target?.evidence.contributingSources).toHaveLength(2);
    expect(target?.evidence.contributingSources?.some((cs) => cs.sourceChangeKey === 'file:src/sourceA.ts')).toBe(true);
    expect(target?.evidence.contributingSources?.some((cs) => cs.sourceChangeKey === 'file:src/sourceB.ts')).toBe(true);
  });

  it('penalizes confidence and marks stage partial when AST extraction record is missing or failed', () => {
    const missingAstInput: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/app.ts', changeType: 'modified' }],
      investigations: [
        { stage: 'git_ingestion_complete', status: 'completed' },
        { stage: 'dependency_graph_complete', status: 'completed' },
      ],
    };

    const failedAstInput: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/app.ts', changeType: 'modified' }],
      investigations: [
        { stage: 'git_ingestion_complete', status: 'completed' },
        { stage: 'ast_extraction_failed', status: 'failed' },
        { stage: 'dependency_graph_complete', status: 'completed' },
      ],
    };

    const repMissing = calculateDeterministicRisk(missingAstInput);
    const repFailed = calculateDeterministicRisk(failedAstInput);

    expect(repMissing.confidence).toBeLessThanOrEqual(70);
    expect(repMissing.stage).toBe('risk_analysis_partial');
    expect(repMissing.limitations.some((l) => l.includes('AST extraction records are missing'))).toBe(true);

    expect(repFailed.confidence).toBeLessThanOrEqual(50);
    expect(repFailed.stage).toBe('risk_analysis_partial');
    expect(repFailed.limitations.some((l) => l.includes('AST extraction failed'))).toBe(true);
  });

  it('penalizes confidence and marks stage partial when dependency graph record is missing or failed', () => {
    const missingGraphInput: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/app.ts', changeType: 'modified' }],
      investigations: [
        { stage: 'git_ingestion_complete', status: 'completed' },
        { stage: 'ast_extraction_complete', status: 'completed' },
      ],
    };

    const failedGraphInput: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/app.ts', changeType: 'modified' }],
      investigations: [
        { stage: 'git_ingestion_complete', status: 'completed' },
        { stage: 'ast_extraction_complete', status: 'completed' },
        { stage: 'dependency_graph_failed', status: 'failed' },
      ],
    };

    const repMissing = calculateDeterministicRisk(missingGraphInput);
    const repFailed = calculateDeterministicRisk(failedGraphInput);

    expect(repMissing.confidence).toBeLessThanOrEqual(60);
    expect(repMissing.stage).toBe('risk_analysis_partial');
    expect(repMissing.limitations.some((l) => l.includes('Dependency graph records are missing'))).toBe(true);

    expect(repFailed.confidence).toBeLessThanOrEqual(50);
    expect(repFailed.stage).toBe('risk_analysis_partial');
    expect(repFailed.limitations.some((l) => l.includes('Dependency graph construction failed'))).toBe(true);
  });

  it('penalizes confidence and reports warning when git diff extraction failed', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/app.ts', changeType: 'modified' }],
      gitDiffStatus: 'failed',
      hasDiffHunks: false,
    };

    const report = calculateDeterministicRisk(input);

    expect(report.confidence).toBeLessThanOrEqual(65);
    expect(report.stage).toBe('risk_analysis_partial');
    expect(report.limitations.some((l) => l.includes('Git diff statistics extraction failed'))).toBe(true);
  });

  it('validates graph edges against an empty persisted edge set and does not count impact as confirmed', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/core.ts', changeType: 'modified' }],
      impactResults: [
        {
          resultKey: 'r1',
          targetKey: 'file:src/downstream.ts',
          targetType: 'file',
          targetFile: 'src/downstream.ts',
          targetSymbol: null,
          sourceChangeKey: 'file:src/core.ts',
          sourceChangeFile: 'src/core.ts',
          sourceChangeSymbol: null,
          classification: 'direct',
          depth: 1,
          path: ['file:src/core.ts', 'file:src/downstream.ts'],
          relationshipTypes: ['imports_module'],
          edgeKeys: ['edge_1'],
          resolutionStatus: 'resolved',
        },
      ],
      validEdgeKeys: new Set(),
    };

    const report = calculateDeterministicRisk(input);

    expect(report.confirmedExposure.directDependentsCount).toBe(0);
    expect(report.potentialExposure.unresolvedCount).toBe(1);

    const target = report.highestRiskTargets.find((t) => t.targetKey === 'file:src/downstream.ts');
    expect(target).toBeDefined();
    expect(target?.isConfirmed).toBe(false);
    expect(target?.evidence.edgeKeys).toEqual(['edge_1']);
    expect(target?.evidence.impactPaths).toEqual([['file:src/core.ts', 'file:src/downstream.ts']]);
    expect(target?.unresolvedLimitations.some((l) => l.includes('edge_1'))).toBe(true);
    expect(report.limitations.some((l) => l.includes('edge_1'))).toBe(true);
  });

  it('does not count impact as confirmed when a required edge key is invalid or missing', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/core.ts', changeType: 'modified' }],
      impactResults: [
        {
          resultKey: 'r1',
          targetKey: 'file:src/target.ts',
          targetType: 'file',
          targetFile: 'src/target.ts',
          targetSymbol: null,
          sourceChangeKey: 'file:src/core.ts',
          sourceChangeFile: 'src/core.ts',
          sourceChangeSymbol: null,
          classification: 'direct',
          depth: 1,
          path: ['file:src/core.ts', 'file:src/target.ts'],
          relationshipTypes: ['imports_module'],
          edgeKeys: ['edge_valid', 'edge_invalid'],
          resolutionStatus: 'resolved',
        },
      ],
      validEdgeKeys: new Set(['edge_valid']),
    };

    const report = calculateDeterministicRisk(input);

    expect(report.confirmedExposure.directDependentsCount).toBe(0);
    const target = report.highestRiskTargets.find((t) => t.targetKey === 'file:src/target.ts');
    expect(target?.isConfirmed).toBe(false);
    expect(target?.unresolvedLimitations.some((l) => l.includes('edge_invalid'))).toBe(true);
    expect(report.limitations.some((l) => l.includes('edge_invalid'))).toBe(true);
  });

  it('rejects impact confirmation and records limitations when graph edge has mismatched repository or commit provenance', () => {
    const currentAnalysis = {
      id: 'anl_test_01',
      repositoryId: 'repo_test_01',
      headSha: 'commit_sha_1234',
    };

    const persistedEdges = [
      {
        edgeKey: 'edge_wrong_repo',
        analysisId: currentAnalysis.id,
        repositoryId: 'repo_other',
        commitSha: currentAnalysis.headSha,
      },
      {
        edgeKey: 'edge_wrong_commit',
        analysisId: currentAnalysis.id,
        repositoryId: currentAnalysis.repositoryId,
        commitSha: 'commit_sha_old',
      },
      {
        edgeKey: 'edge_matching',
        analysisId: currentAnalysis.id,
        repositoryId: currentAnalysis.repositoryId,
        commitSha: currentAnalysis.headSha,
      },
    ];

    const validEdgeKeys = new Set<string>();
    const provenanceLimitations: string[] = [];
    for (const edge of persistedEdges) {
      if (
        edge.analysisId === currentAnalysis.id &&
        edge.repositoryId === currentAnalysis.repositoryId &&
        edge.commitSha === currentAnalysis.headSha
      ) {
        validEdgeKeys.add(edge.edgeKey);
      } else {
        provenanceLimitations.push(
          `Dependency edge "${edge.edgeKey}" has mismatched provenance: repository=${edge.repositoryId} (expected ${currentAnalysis.repositoryId}), commit=${edge.commitSha} (expected ${currentAnalysis.headSha})`
        );
      }
    }

    expect(validEdgeKeys.has('edge_matching')).toBe(true);
    expect(validEdgeKeys.has('edge_wrong_repo')).toBe(false);
    expect(validEdgeKeys.has('edge_wrong_commit')).toBe(false);

    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/core.ts', changeType: 'modified' }],
      impactResults: [
        {
          resultKey: 'r1',
          targetKey: 'file:src/repoMismatchTarget.ts',
          targetType: 'file',
          targetFile: 'src/repoMismatchTarget.ts',
          targetSymbol: null,
          sourceChangeKey: 'file:src/core.ts',
          sourceChangeFile: 'src/core.ts',
          sourceChangeSymbol: null,
          classification: 'direct',
          depth: 1,
          path: ['file:src/core.ts', 'file:src/repoMismatchTarget.ts'],
          relationshipTypes: ['imports_module'],
          edgeKeys: ['edge_wrong_repo'],
          resolutionStatus: 'resolved',
        },
      ],
      validEdgeKeys,
      extraLimitations: provenanceLimitations,
    };

    const report = calculateDeterministicRisk(input);

    expect(report.confirmedExposure.directDependentsCount).toBe(0);
    const target = report.highestRiskTargets.find((t) => t.targetKey === 'file:src/repoMismatchTarget.ts');
    expect(target?.isConfirmed).toBe(false);
    expect(report.limitations.some((l) => l.includes('edge_wrong_repo'))).toBe(true);
  });

  it('rejects impact confirmation and records limitation when ImpactResult has mismatched repository provenance', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/core.ts', changeType: 'modified' }],
      impactResults: [
        {
          resultKey: 'r1',
          targetKey: 'file:src/mismatchedRepo.ts',
          targetType: 'file',
          targetFile: 'src/mismatchedRepo.ts',
          targetSymbol: null,
          sourceChangeKey: 'file:src/core.ts',
          sourceChangeFile: 'src/core.ts',
          sourceChangeSymbol: null,
          classification: 'unresolved',
          depth: 1,
          path: ['file:src/core.ts', 'file:src/mismatchedRepo.ts'],
          relationshipTypes: ['imports_module'],
          edgeKeys: ['e1'],
          resolutionStatus: 'unresolved',
          provenanceError: 'Mismatched ImpactResult repositoryId: repo_foreign (expected repo_test_01)',
        },
      ],
      validEdgeKeys: new Set(['e1']),
    };

    const report = calculateDeterministicRisk(input);

    expect(report.confirmedExposure.directDependentsCount).toBe(0);
    const target = report.highestRiskTargets.find((t) => t.targetKey === 'file:src/mismatchedRepo.ts');
    expect(target?.isConfirmed).toBe(false);
    expect(report.limitations.some((l) => l.includes('Mismatched ImpactResult repositoryId'))).toBe(true);
  });

  it('rejects impact confirmation and records limitation when ImpactResult has mismatched commit provenance', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/core.ts', changeType: 'modified' }],
      impactResults: [
        {
          resultKey: 'r1',
          targetKey: 'file:src/mismatchedCommit.ts',
          targetType: 'file',
          targetFile: 'src/mismatchedCommit.ts',
          targetSymbol: null,
          sourceChangeKey: 'file:src/core.ts',
          sourceChangeFile: 'src/core.ts',
          sourceChangeSymbol: null,
          classification: 'unresolved',
          depth: 1,
          path: ['file:src/core.ts', 'file:src/mismatchedCommit.ts'],
          relationshipTypes: ['imports_module'],
          edgeKeys: ['e1'],
          resolutionStatus: 'unresolved',
          provenanceError: 'Mismatched ImpactResult commitSha: commit_stale (expected commit_sha_1234)',
        },
      ],
      validEdgeKeys: new Set(['e1']),
    };

    const report = calculateDeterministicRisk(input);

    expect(report.confirmedExposure.directDependentsCount).toBe(0);
    const target = report.highestRiskTargets.find((t) => t.targetKey === 'file:src/mismatchedCommit.ts');
    expect(target?.isConfirmed).toBe(false);
    expect(report.limitations.some((l) => l.includes('Mismatched ImpactResult commitSha'))).toBe(true);
  });

  it('applies exact documented penalty of 15 and partial lifecycle for unavailable Git diff evidence', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [{ path: 'src/feature.ts', changeType: 'modified' }],
      gitDiffStatus: 'unavailable',
      hasDiffHunks: false,
    };

    const report = calculateDeterministicRisk(input);

    expect(report.confidence).toBe(85);
    expect(report.stage).toBe('risk_analysis_partial');
    expect(report.limitations.some((l) => l.includes('Git diff statistics were unavailable'))).toBe(true);
    expect(report.missingEvidence.some((m) => m.includes('diff statistics were unavailable'))).toBe(true);
  });

  it('produces risk_analysis_complete with 100 confidence for verified empty diff regression', () => {
    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles: [],
      changedSymbols: [],
      impactResults: [],
      isVerifiedEmptyDiff: true,
      gitDiffStatus: 'empty',
    };

    const report = calculateDeterministicRisk(input);

    expect(report.confidence).toBe(100);
    expect(report.score).toBe(0);
    expect(report.level).toBe('low');
    expect(report.severity).toBe(0);
    expect(report.likelihood).toBe(0);
    expect(report.stage).toBe('risk_analysis_complete');
    expect(report.highestRiskTargets).toHaveLength(0);
  });

  it('diffFiles === null does not mark symbols in modified files as changed', () => {
    const symbols = [
      {
        symbolKey: 'file.ts#fnA:function:10:20',
        name: 'fnA',
        kind: 'function',
        file: 'file.ts',
        lineStart: 10,
        lineEnd: 20,
        isExported: true,
        isReExport: false,
      },
      {
        symbolKey: 'file.ts#fnB:function:30:40',
        name: 'fnB',
        kind: 'function',
        file: 'file.ts',
        lineStart: 30,
        lineEnd: 40,
        isExported: false,
        isReExport: false,
      },
    ];

    const changedFiles = [{ path: 'file.ts', changeType: 'modified' }];

    const matched = identifyChangedSymbols(symbols, changedFiles, null);

    expect(matched).toHaveLength(0);
  });

  it('failed Git diff does not create falsely confirmed symbol targets and preserves file-level evidence', () => {
    const symbols = [
      {
        symbolKey: 'src/app.ts#main:function:1:20',
        name: 'main',
        kind: 'function',
        file: 'src/app.ts',
        lineStart: 1,
        lineEnd: 20,
        isExported: true,
        isReExport: false,
      },
    ];
    const changedFiles = [{ path: 'src/app.ts', changeType: 'modified' }];

    const changedSymbols = identifyChangedSymbols(symbols, changedFiles, null);
    expect(changedSymbols).toHaveLength(0);

    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles,
      changedSymbols,
      gitDiffStatus: 'failed',
      hasDiffHunks: false,
    };

    const report = calculateDeterministicRisk(input);

    expect(report.stage).toBe('risk_analysis_partial');
    expect(report.confidence).toBeLessThanOrEqual(65);
    expect(report.highestRiskTargets.some((t) => t.targetType === 'symbol')).toBe(false);
    expect(report.highestRiskTargets.some((t) => t.targetKey === 'file:src/app.ts' && t.isConfirmed)).toBe(true);
  });

  it('unavailable Git diff does not create falsely confirmed symbol targets and preserves file-level evidence', () => {
    const symbols = [
      {
        symbolKey: 'src/app.ts#helper:function:1:10',
        name: 'helper',
        kind: 'function',
        file: 'src/app.ts',
        lineStart: 1,
        lineEnd: 10,
        isExported: false,
        isReExport: false,
      },
    ];
    const changedFiles = [{ path: 'src/app.ts', changeType: 'modified' }];

    const changedSymbols = identifyChangedSymbols(symbols, changedFiles, null);
    expect(changedSymbols).toHaveLength(0);

    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles,
      changedSymbols,
      gitDiffStatus: 'unavailable',
      hasDiffHunks: false,
    };

    const report = calculateDeterministicRisk(input);

    expect(report.stage).toBe('risk_analysis_partial');
    expect(report.confidence).toBe(85);
    expect(report.highestRiskTargets.some((t) => t.targetType === 'symbol')).toBe(false);
    expect(report.highestRiskTargets.some((t) => t.targetKey === 'file:src/app.ts' && t.isConfirmed)).toBe(true);
  });

  it('identifies the correct changed symbol when a valid diff hunk is provided', () => {
    const symbols = [
      {
        symbolKey: 'file.ts#targetFn:function:10:20',
        name: 'targetFn',
        kind: 'function',
        file: 'file.ts',
        lineStart: 10,
        lineEnd: 20,
        isExported: true,
        isReExport: false,
      },
      {
        symbolKey: 'file.ts#untouchedFn:function:30:40',
        name: 'untouchedFn',
        kind: 'function',
        file: 'file.ts',
        lineStart: 30,
        lineEnd: 40,
        isExported: false,
        isReExport: false,
      },
    ];

    const changedFiles = [{ path: 'file.ts', changeType: 'modified' }];
    const diffFiles = [
      {
        path: 'file.ts',
        changeType: 'modified',
        hunks: [{ oldStart: 12, oldLines: 2, newStart: 12, newLines: 3 }],
      },
    ];

    const matched = identifyChangedSymbols(symbols, changedFiles, diffFiles);

    expect(matched).toHaveLength(1);
    expect(matched[0].name).toBe('targetFn');
    expect(matched[0].changeType).toBe('modified');

    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles,
      changedSymbols: matched,
    };

    const report = calculateDeterministicRisk(input);
    const symbolTarget = report.highestRiskTargets.find((t) => t.targetKey === 'file.ts#targetFn:function:10:20');

    expect(symbolTarget).toBeDefined();
    expect(symbolTarget?.isConfirmed).toBe(true);
    expect(symbolTarget?.targetType).toBe('symbol');
    expect(symbolTarget?.evidence.classification).toBe('changed');
  });

  it('correctly classifies symbols in added files as directly changed', () => {
    const symbols = [
      {
        symbolKey: 'src/newModule.ts#newFunc:function:1:15',
        name: 'newFunc',
        kind: 'function',
        file: 'src/newModule.ts',
        lineStart: 1,
        lineEnd: 15,
        isExported: true,
        isReExport: false,
      },
    ];

    const changedFiles = [{ path: 'src/newModule.ts', changeType: 'added' }];

    const matched = identifyChangedSymbols(symbols, changedFiles, null);

    expect(matched).toHaveLength(1);
    expect(matched[0].name).toBe('newFunc');
    expect(matched[0].changeType).toBe('added');

    const input: RiskScoringInput = {
      ...baseInput,
      changedFiles,
      changedSymbols: matched,
    };

    const report = calculateDeterministicRisk(input);
    const target = report.highestRiskTargets.find((t) => t.targetKey === 'src/newModule.ts#newFunc:function:1:15');

    expect(target).toBeDefined();
    expect(target?.isConfirmed).toBe(true);
    expect(target?.targetType).toBe('symbol');
    expect(target?.evidence.classification).toBe('changed');
    expect(target?.reasons.some((r) => r.includes('Directly changed component (added)'))).toBe(true);
  });
});
