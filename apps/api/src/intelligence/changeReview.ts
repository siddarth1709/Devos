import { RiskAssessmentReport, RiskTargetComponent } from '../risk/types.js';

export interface SuggestedReviewArea {
  targetKey: string;
  reason: string;
  riskScore: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface ChangeReviewReport {
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  summary: string;
  verifiedFindings: {
    changedFilesCount: number;
    changedSymbolsCount: number;
    confirmedDirectImpacts: number;
    confirmedTransitiveImpacts: number;
    maxConfirmedDepth: number;
    distinctImpactedFiles: number;
    highestRiskComponents: Array<{
      targetKey: string;
      targetType: string;
      score: number;
      level: string;
      reasons: string[];
    }>;
  };
  uncertainObservations: {
    unresolvedDependenciesCount: number;
    ambiguousDependenciesCount: number;
    unconfirmedTargets: string[];
    uncertaintyAdjustment: number;
  };
  criticalDependencyPaths: Array<{
    targetKey: string;
    path: string[];
    depth: number;
  }>;
  riskEvaluation: {
    score: number;
    level: string;
    severity: number;
    likelihood: number;
    confidence: number;
    uncertaintyScore: number;
  };
  suggestedReviewAreas: SuggestedReviewArea[];
  missingEvidenceAndLimitations: {
    limitations: string[];
    missingEvidence: string[];
    notice: string;
  };
  timestamp: string;
}

export interface GenerateChangeReviewInput {
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  changedFiles: Array<{
    path: string;
    changeType: string;
  }>;
  changedSymbols?: Array<{
    name: string;
    kind: string;
    file: string;
    isExported?: boolean;
  }>;
  riskReport?: RiskAssessmentReport | null;
  riskAssessment?: RiskAssessmentReport | null;
}

export function generateChangeReviewReport(input: GenerateChangeReviewInput): ChangeReviewReport {
  const {
    analysisId,
    repositoryId,
    commitSha,
    changedFiles,
    changedSymbols = [],
  } = input;
  const riskReport = input.riskReport ?? input.riskAssessment ?? null;

  const totalFiles = changedFiles.length;
  const totalSymbols = changedSymbols.length;

  const confirmedDirect = riskReport?.confirmedExposure.directDependentsCount ?? 0;
  const confirmedTransitive = riskReport?.confirmedExposure.transitiveDependentsCount ?? 0;
  const maxDepth = riskReport?.confirmedExposure.maxDepthReached ?? 0;
  const distinctFiles = riskReport?.confirmedExposure.distinctImpactedFiles ?? 0;

  const unresolvedCount = riskReport?.potentialExposure.unresolvedCount ?? 0;
  const ambiguousCount = riskReport?.potentialExposure.ambiguousCount ?? 0;

  const allTargets = riskReport?.highestRiskTargets ?? [];
  const confirmedTargets = allTargets.filter((t) => t.isConfirmed);
  const unconfirmedTargets = allTargets.filter((t) => !t.isConfirmed).map((t) => t.targetKey);

  const highestRiskComponents = confirmedTargets.slice(0, 5).map((t) => ({
    targetKey: t.targetKey,
    targetType: t.targetType,
    score: t.score,
    level: t.level,
    reasons: t.reasons,
  }));

  const criticalDependencyPaths: Array<{ targetKey: string; path: string[]; depth: number }> = [];
  for (const t of confirmedTargets) {
    if (t.evidence.impactPaths && t.evidence.impactPaths.length > 0) {
      for (const p of t.evidence.impactPaths) {
        if (p.length > 1) {
          criticalDependencyPaths.push({
            targetKey: t.targetKey,
            path: p,
            depth: t.evidence.depth,
          });
        }
      }
    }
  }

  const suggestedReviewAreas: SuggestedReviewArea[] = [];

  for (const t of confirmedTargets) {
    if (t.score >= 50) {
      suggestedReviewAreas.push({
        targetKey: t.targetKey,
        reason: `Elevated risk component (${t.score}/100) with direct or transitive downstream exposure`,
        riskScore: t.score,
        priority: t.score >= 75 ? 'critical' : 'high',
      });
    }
  }

  for (const s of changedSymbols) {
    if (s.isExported) {
      const symKey = `${s.file}#${s.name}`;
      if (!suggestedReviewAreas.some((a) => a.targetKey === symKey)) {
        suggestedReviewAreas.push({
          targetKey: symKey,
          reason: 'Public exported API modified; verify backward compatibility with downstream callers',
          riskScore: 40,
          priority: 'medium',
        });
      }
    }
  }

  if (unresolvedCount > 0) {
    suggestedReviewAreas.push({
      targetKey: 'unresolved-dependencies',
      reason: `${unresolvedCount} unresolved references detected; requires manual import path verification`,
      riskScore: 35,
      priority: 'medium',
    });
  }

  suggestedReviewAreas.sort((a, b) => b.riskScore - a.riskScore);

  const summary =
    totalFiles === 0
      ? 'Clean verified commit with zero detected file modifications.'
      : `Change modifies ${totalFiles} file${totalFiles === 1 ? '' : 's'} and ${totalSymbols} symbol${totalSymbols === 1 ? '' : 's'}, with ${confirmedDirect} direct and ${confirmedTransitive} transitive confirmed dependents.`;

  return {
    analysisId,
    repositoryId,
    commitSha,
    summary,
    verifiedFindings: {
      changedFilesCount: totalFiles,
      changedSymbolsCount: totalSymbols,
      confirmedDirectImpacts: confirmedDirect,
      confirmedTransitiveImpacts: confirmedTransitive,
      maxConfirmedDepth: maxDepth,
      distinctImpactedFiles: distinctFiles,
      highestRiskComponents,
    },
    uncertainObservations: {
      unresolvedDependenciesCount: unresolvedCount,
      ambiguousDependenciesCount: ambiguousCount,
      unconfirmedTargets,
      uncertaintyAdjustment: riskReport?.uncertaintyAdjustment ?? 0,
    },
    criticalDependencyPaths: criticalDependencyPaths.slice(0, 5),
    riskEvaluation: {
      score: riskReport?.score ?? 0,
      level: riskReport?.level ?? 'low',
      severity: riskReport?.severity ?? 0,
      likelihood: riskReport?.likelihood ?? 0,
      confidence: riskReport?.confidence ?? 100,
      uncertaintyScore: riskReport?.uncertaintyScore ?? 0,
    },
    suggestedReviewAreas: suggestedReviewAreas.slice(0, 10),
    missingEvidenceAndLimitations: {
      limitations: riskReport?.limitations ?? [],
      missingEvidence: riskReport?.missingEvidence ?? [],
      notice: 'This static review report is grounded exclusively in verified AST, Git diff, and dependency graph evidence. Static analysis does not guarantee runtime defect absence.',
    },
    timestamp: new Date().toISOString(),
  };
}
