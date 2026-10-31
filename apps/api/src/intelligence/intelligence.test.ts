import { describe, it, expect } from 'vitest';
import {
  generateSmartCommitMessage,
  inferCommitScope,
} from './commitAssistant.js';
import { generateChangeReviewReport } from './changeReview.js';
import { generateReleaseNotesReport } from './releaseNotes.js';
import { evaluatePreShipHealth, evaluateReleaseGate } from './healthChecks.js';
import { RiskAssessmentReport } from '../risk/types.js';

describe('Commit Assistant', () => {
  it('infers scope from file paths correctly', () => {
    expect(inferCommitScope(['apps/api/src/routes/analyses.ts'])).toBe('routes');
    expect(inferCommitScope(['packages/cli/src/bin.ts'])).toBe('bin');
    expect(inferCommitScope(['src/utils/math.ts', 'src/utils/format.ts'])).toBe('utils');
    expect(inferCommitScope([])).toBe(null);
  });

  it('generates conventional commit message for new features', () => {
    const result = generateSmartCommitMessage({
      changedFiles: [
        { path: 'apps/api/src/risk/scoring.ts', changeType: 'added' },
      ],
      changedSymbols: [
        { name: 'calculateRiskScore', kind: 'function', file: 'apps/api/src/risk/scoring.ts', isExported: true },
      ],
    });

    expect(result.type).toBe('feat');
    expect(result.scope).toBe('risk');
    expect(result.conventionalMessage).toContain('feat(risk):');
    expect(result.bullets.length).toBeGreaterThan(0);
  });

  it('generates conventional commit message for bug fixes', () => {
    const result = generateSmartCommitMessage({
      changedFiles: [
        { path: 'apps/api/src/routes/fix-bug.ts', changeType: 'modified' },
      ],
    });

    expect(result.type).toBe('fix');
    expect(result.conventionalMessage).toContain('fix(routes):');
  });

  it('generates test for test-only changes', () => {
    const result = generateSmartCommitMessage({
      changedFiles: [
        { path: 'apps/api/src/risk/risk.test.ts', changeType: 'modified' },
      ],
    });

    expect(result.type).toBe('test');
    expect(result.conventionalMessage).toContain('test(risk):');
  });
});

describe('Change Review Generator', () => {
  const sampleRiskReport: RiskAssessmentReport = {
    analysisId: 'ana_1',
    repositoryId: 'repo_1',
    commitSha: 'a'.repeat(40),
    score: 65,
    level: 'medium',
    severity: 50,
    likelihood: 60,
    confidence: 85,
    uncertaintyScore: 10,
    uncertaintyAdjustment: 5,
    evidenceCompleteness: 90,
    factors: [],
    confirmedExposure: {
      directDependentsCount: 2,
      transitiveDependentsCount: 1,
      maxDepthReached: 2,
      distinctImpactedFiles: 2,
      distinctImpactedSymbols: 1,
    },
    potentialExposure: {
      unresolvedCount: 1,
      ambiguousCount: 0,
      unresolvedTargetKeys: ['unresolved_1'],
      ambiguousTargetKeys: [],
    },
    supportingEvidence: {
      totalChangedFiles: 1,
      totalChangedSymbols: 1,
      totalDirectImpacts: 2,
      totalTransitiveImpacts: 1,
      maxImpactDepth: 2,
      unresolvedCount: 1,
      ambiguousCount: 0,
    },
    highestRiskTargets: [
      {
        targetKey: 'apps/api/src/index.ts::startServer',
        targetType: 'symbol',
        targetFile: 'apps/api/src/index.ts',
        targetSymbol: 'startServer',
        score: 70,
        level: 'high',
        severity: 60,
        likelihood: 70,
        confidence: 85,
        isConfirmed: true,
        reasons: ['Directly changed symbol with 2 downstream consumers'],
        evidence: {
          impactPaths: [['apps/api/src/index.ts::startServer', 'apps/api/src/client.ts']],
          edgeKeys: ['edge_1'],
          classification: 'direct',
          depth: 1,
        },
        unresolvedLimitations: [],
      },
    ],
    limitations: [],
    missingEvidence: [],
    metadata: {},
    timestamp: new Date().toISOString(),
    stage: 'completed',
    modelVersion: '1.2.0',
  };

  it('separates verified findings from uncertain observations', () => {
    const review = generateChangeReviewReport({
      analysisId: 'ana_1',
      repositoryId: 'repo_1',
      commitSha: 'a'.repeat(40),
      changedFiles: [{ path: 'apps/api/src/index.ts', changeType: 'modified' }],
      changedSymbols: [{ name: 'startServer', kind: 'function', file: 'apps/api/src/index.ts' }],
      riskReport: sampleRiskReport,
    });

    expect(review.analysisId).toBe('ana_1');
    expect(review.verifiedFindings.changedFilesCount).toBe(1);
    expect(review.verifiedFindings.highestRiskComponents.length).toBe(1);
    expect(review.uncertainObservations.uncertaintyAdjustment).toBe(5);
    expect(review.suggestedReviewAreas.length).toBeGreaterThan(0);
    expect(review.riskEvaluation.score).toBe(65);
  });
});

describe('Release Notes Generator', () => {
  it('generates structured and markdown release notes', () => {
    const report = generateReleaseNotesReport({
      analysisId: 'ana_1',
      repositoryId: 'repo_1',
      commitSha: 'a'.repeat(40),
      version: 'v1.0.0',
      commitMessage: 'feat(auth): add OAuth2 provider',
      changedFiles: [
        { path: 'apps/api/src/auth/oauth.ts', changeType: 'added' },
      ],
    });

    expect(report.structured.features.length).toBe(1);
    expect(report.structured.blastRadius.totalChangedFiles).toBe(1);
    expect(report.markdown).toContain('# Release Notes - v1.0.0');
    expect(report.markdown).toContain('## Features');
  });

  it('identifies breaking changes when files are deleted', () => {
    const report = generateReleaseNotesReport({
      analysisId: 'ana_1',
      repositoryId: 'repo_1',
      commitSha: 'a'.repeat(40),
      commitMessage: 'chore: cleanup deprecated modules',
      changedFiles: [
        { path: 'apps/api/src/legacy/oldService.ts', changeType: 'deleted' },
      ],
    });

    expect(report.structured.breakingChanges.length).toBe(1);
    expect(report.markdown).toContain('## Breaking Changes');
  });
});

describe('Pre-Ship Health Checks and Release Gate', () => {
  it('passes all health checks in ideal scenario', () => {
    const report = evaluatePreShipHealth({
      analysisId: 'ana_1',
      repositoryId: 'repo_1',
      commitSha: 'a'.repeat(40),
      changedFilesCount: 2,
      symbolsCount: 10,
      dependencyNodesCount: 5,
      dependencyEdgesCount: 4,
      impactResultsCount: 3,
      testFilesFound: true,
      databaseUrlConfigured: true,
      riskAssessment: {
        analysisId: 'ana_1',
        repositoryId: 'repo_1',
        commitSha: 'a'.repeat(40),
        score: 25,
        level: 'low',
        severity: 20,
        likelihood: 30,
        confidence: 90,
        uncertaintyScore: 0,
        uncertaintyAdjustment: 0,
        evidenceCompleteness: 100,
        factors: [],
        confirmedExposure: {
          directDependentsCount: 2,
          transitiveDependentsCount: 0,
          maxDepthReached: 1,
          distinctImpactedFiles: 2,
          distinctImpactedSymbols: 0,
        },
        potentialExposure: {
          unresolvedCount: 0,
          ambiguousCount: 0,
          unresolvedTargetKeys: [],
          ambiguousTargetKeys: [],
        },
        supportingEvidence: {
          totalChangedFiles: 2,
          totalChangedSymbols: 0,
          totalDirectImpacts: 2,
          totalTransitiveImpacts: 0,
          maxImpactDepth: 1,
          unresolvedCount: 0,
          ambiguousCount: 0,
        },
        highestRiskTargets: [],
        limitations: [],
        missingEvidence: [],
        metadata: {},
        timestamp: '',
        stage: '',
        modelVersion: '1.2.0',
      },
    });

    expect(report.overallStatus).toBe('HEALTHY');
    expect(report.totalChecks).toBe(10);
    expect(report.failedCount).toBe(0);
  });

  it('fails release gate when risk score exceeds threshold', () => {
    const gate = evaluateReleaseGate(
      {
        analysisId: 'ana_1',
        repositoryId: 'repo_1',
        commitSha: 'a'.repeat(40),
        riskAssessment: {
          analysisId: 'ana_1',
          repositoryId: 'repo_1',
          commitSha: 'a'.repeat(40),
          score: 85,
          level: 'high',
          severity: 80,
          likelihood: 90,
          confidence: 80,
          uncertaintyScore: 0,
          uncertaintyAdjustment: 0,
          evidenceCompleteness: 90,
          factors: [],
          confirmedExposure: {
            directDependentsCount: 5,
            transitiveDependentsCount: 0,
            maxDepthReached: 1,
            distinctImpactedFiles: 5,
            distinctImpactedSymbols: 0,
          },
          potentialExposure: {
            unresolvedCount: 0,
            ambiguousCount: 0,
            unresolvedTargetKeys: [],
            ambiguousTargetKeys: [],
          },
          supportingEvidence: {
            totalChangedFiles: 5,
            totalChangedSymbols: 0,
            totalDirectImpacts: 5,
            totalTransitiveImpacts: 0,
            maxImpactDepth: 1,
            unresolvedCount: 0,
            ambiguousCount: 0,
          },
          highestRiskTargets: [],
          limitations: [],
          missingEvidence: [],
          metadata: {},
          timestamp: '',
          stage: '',
          modelVersion: '1.2.0',
        },
      },
      { maxRiskScore: 70 }
    );

    expect(gate.passed).toBe(false);
    expect(gate.gateStatus).toBe('FAILED');
    expect(gate.blockingReasons.some((r) => r.includes('exceeds configured maximum allowable threshold'))).toBe(true);
  });

  it('fails release gate when provenance is violated', () => {
    const gate = evaluateReleaseGate({
      analysisId: 'ana_1',
      repositoryId: 'repo_1',
      commitSha: 'a'.repeat(40),
      hasInvalidEdges: true,
    });

    expect(gate.passed).toBe(false);
    expect(gate.blockingReasons.some((r) => r.includes('Provenance Integrity'))).toBe(true);
  });
});
