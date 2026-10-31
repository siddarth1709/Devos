import { prisma } from '../db.js';
import { DbClient } from '../repo/types.js';
import { createInvestigation } from '../repo/artifactRepo.js';
import { RiskAssessmentReport, RiskTargetComponent } from './types.js';

export function validateRiskProvenance(
  report: RiskAssessmentReport,
  expectedAnalysis?: { id: string; repositoryId: string; headSha: string } | null,
  validEdgeKeys?: Set<string> | null
): void {
  if (!report.analysisId || typeof report.analysisId !== 'string' || report.analysisId.trim() === '') {
    throw new Error('Risk assessment report is missing valid analysisId provenance');
  }
  if (!report.repositoryId || typeof report.repositoryId !== 'string' || report.repositoryId.trim() === '') {
    throw new Error('Risk assessment report is missing valid repositoryId provenance');
  }
  if (!report.commitSha || typeof report.commitSha !== 'string' || report.commitSha.trim() === '') {
    throw new Error('Risk assessment report is missing valid commitSha provenance');
  }

  if (expectedAnalysis) {
    if (report.analysisId !== expectedAnalysis.id) {
      throw new Error(`Analysis ID mismatch: expected ${expectedAnalysis.id}, got ${report.analysisId}`);
    }
    if (report.repositoryId !== expectedAnalysis.repositoryId) {
      throw new Error(`Repository ID mismatch: expected ${expectedAnalysis.repositoryId}, got ${report.repositoryId}`);
    }
    if (report.commitSha !== expectedAnalysis.headSha) {
      throw new Error(`Commit SHA mismatch: expected ${expectedAnalysis.headSha}, got ${report.commitSha}`);
    }
  }

  for (const target of report.highestRiskTargets) {
    if (!target.targetKey || typeof target.targetKey !== 'string' || target.targetKey.trim() === '') {
      throw new Error('Risk target component has empty targetKey');
    }
    if (typeof target.score !== 'number' || isNaN(target.score)) {
      throw new Error(`Risk target "${target.targetKey}" has invalid score`);
    }
    if (validEdgeKeys !== undefined && validEdgeKeys !== null && target.evidence.edgeKeys) {
      for (const edgeKey of target.evidence.edgeKeys) {
        if (!validEdgeKeys.has(edgeKey)) {
          const limitationMsg = `Graph edge key "${edgeKey}" not found in persisted graph records`;
          if (!target.unresolvedLimitations.includes(limitationMsg)) {
            target.unresolvedLimitations.push(limitationMsg);
          }
        }
      }
    }
  }
}

export async function persistRiskAssessment(
  report: RiskAssessmentReport,
  baseSha: string,
  startedAt: Date = new Date(),
  client: any = prisma,
  expectedAnalysis?: { id: string; repositoryId: string; headSha: string } | null,
  validEdgeKeys?: Set<string> | null
): Promise<void> {
  validateRiskProvenance(report, expectedAnalysis, validEdgeKeys);

  const finishedAt = new Date();
  let investigationStatus = 'in_progress';
  let errorPayload: string | null = null;

  if (report.stage === 'risk_analysis_failed') {
    investigationStatus = 'failed';
    errorPayload = JSON.stringify({
      message: 'Risk analysis failed',
      limitations: report.limitations,
    });
  } else if (report.stage === 'risk_analysis_partial') {
    investigationStatus = 'in_progress';
    errorPayload = JSON.stringify({
      message: 'Risk analysis completed with unresolved dependencies or partial evidence',
      limitations: report.limitations,
    });
  }

  const extendedMetadata = {
    ...report.metadata,
    uncertaintyScore: report.uncertaintyScore,
    uncertaintyAdjustment: report.uncertaintyAdjustment,
    confirmedExposure: report.confirmedExposure,
    potentialExposure: report.potentialExposure,
    supportingEvidence: report.supportingEvidence,
  };

  const assessmentData = {
    analysisId: report.analysisId,
    repositoryId: report.repositoryId,
    commitSha: report.commitSha,
    score: report.score,
    level: report.level,
    severity: report.severity,
    likelihood: report.likelihood,
    confidence: report.confidence,
    modelVersion: report.modelVersion,
    factors: JSON.stringify(report.factors),
    highestRiskTargets: JSON.stringify(report.highestRiskTargets),
    limitations: JSON.stringify(report.limitations),
    missingEvidence: JSON.stringify(report.missingEvidence),
    metadata: JSON.stringify(extendedMetadata),
    collector: 'deterministic-risk-engine',
  };

  const targetRows = report.highestRiskTargets.map((t) => ({
    analysisId: report.analysisId,
    repositoryId: report.repositoryId,
    commitSha: report.commitSha,
    targetKey: t.targetKey,
    targetType: t.targetType,
    targetFile: t.targetFile,
    targetSymbol: t.targetSymbol,
    score: t.score,
    level: t.level,
    severity: t.severity,
    likelihood: t.likelihood,
    confidence: t.confidence,
    reasons: JSON.stringify(t.reasons),
    evidence: JSON.stringify({
      ...t.evidence,
      isConfirmed: t.isConfirmed,
    }),
    unresolvedLimitations: JSON.stringify(t.unresolvedLimitations),
    collector: 'deterministic-risk-engine',
  }));

  await (client as any).$transaction(async (tx: any) => {
    await tx.riskTargetResult.deleteMany({
      where: { analysisId: report.analysisId },
    });

    await tx.riskAssessment.deleteMany({
      where: { analysisId: report.analysisId },
    });

    await tx.riskAssessment.create({
      data: assessmentData,
    });

    if (targetRows.length > 0) {
      await tx.riskTargetResult.createMany({
        data: targetRows,
      });
    }

    await createInvestigation(
      {
        analysisId: report.analysisId,
        status: investigationStatus,
        stage: report.stage,
        startedAt,
        finishedAt,
        error: errorPayload,
        baseSha,
        headSha: report.commitSha,
        collector: 'deterministic-risk-engine',
      },
      tx as any
    );
  });
}

export async function getRiskAssessmentByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<RiskAssessmentReport | null> {
  const assessment = await client.riskAssessment.findUnique({
    where: { analysisId },
  });

  if (!assessment) return null;

  const inv = await client.investigation.findFirst({
    where: {
      analysisId,
      stage: { in: ['risk_analysis_complete', 'risk_analysis_partial', 'risk_analysis_failed'] },
    },
    orderBy: { startedAt: 'desc' },
  });

  const factors = JSON.parse(assessment.factors);
  const highestRiskTargets = JSON.parse(assessment.highestRiskTargets);
  const limitations = JSON.parse(assessment.limitations);
  const missingEvidence = JSON.parse(assessment.missingEvidence);
  const metadata = assessment.metadata ? JSON.parse(assessment.metadata) : {};

  const confirmedExposure = metadata.confirmedExposure ?? {
    directDependentsCount: 0,
    transitiveDependentsCount: 0,
    maxDepthReached: 0,
    distinctImpactedFiles: 0,
    distinctImpactedSymbols: 0,
  };

  const potentialExposure = metadata.potentialExposure ?? {
    unresolvedCount: 0,
    ambiguousCount: 0,
    unresolvedTargetKeys: [],
    ambiguousTargetKeys: [],
  };

  const supportingEvidence = metadata.supportingEvidence ?? {
    totalChangedFiles: 0,
    totalChangedSymbols: 0,
    totalDirectImpacts: confirmedExposure.directDependentsCount,
    totalTransitiveImpacts: confirmedExposure.transitiveDependentsCount,
    maxImpactDepth: confirmedExposure.maxDepthReached,
    unresolvedCount: potentialExposure.unresolvedCount,
    ambiguousCount: potentialExposure.ambiguousCount,
  };

  return {
    analysisId: assessment.analysisId,
    repositoryId: assessment.repositoryId,
    commitSha: assessment.commitSha,
    modelVersion: assessment.modelVersion,
    score: assessment.score,
    level: assessment.level as any,
    severity: assessment.severity,
    likelihood: assessment.likelihood,
    confidence: assessment.confidence,
    uncertaintyScore: metadata.uncertaintyScore ?? 100 - assessment.confidence,
    uncertaintyAdjustment: metadata.uncertaintyAdjustment ?? 0,
    evidenceCompleteness: assessment.confidence,
    factors,
    highestRiskTargets,
    confirmedExposure,
    potentialExposure,
    supportingEvidence,
    limitations,
    missingEvidence,
    metadata,
    timestamp: assessment.createdAt.toISOString(),
    stage: inv?.stage ?? 'risk_analysis_complete',
  };
}

export async function getRiskTargetResult(
  analysisId: string,
  targetKey: string,
  client: DbClient = prisma
): Promise<RiskTargetComponent | null> {
  const target = await client.riskTargetResult.findUnique({
    where: {
      analysisId_targetKey: {
        analysisId,
        targetKey,
      },
    },
  });

  if (!target) return null;

  const evidence = JSON.parse(target.evidence);
  const reasons = JSON.parse(target.reasons);
  const isConfirmed =
    typeof evidence.isConfirmed === 'boolean'
      ? evidence.isConfirmed
      : !reasons.some((r: string) => r.startsWith('Potential exposure'));

  return {
    targetKey: target.targetKey,
    targetType: target.targetType as any,
    targetFile: target.targetFile,
    targetSymbol: target.targetSymbol,
    score: target.score,
    level: target.level as any,
    severity: target.severity,
    likelihood: target.likelihood,
    confidence: target.confidence,
    isConfirmed,
    reasons,
    evidence,
    unresolvedLimitations: JSON.parse(target.unresolvedLimitations),
  };
}

export async function listRiskTargetResultsByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<RiskTargetComponent[]> {
  const targets = await client.riskTargetResult.findMany({
    where: { analysisId },
    orderBy: [{ score: 'desc' }, { targetKey: 'asc' }],
  });

  return targets.map((target) => {
    const evidence = JSON.parse(target.evidence);
    const reasons = JSON.parse(target.reasons);
    const isConfirmed =
      typeof evidence.isConfirmed === 'boolean'
        ? evidence.isConfirmed
        : !reasons.some((r: string) => r.startsWith('Potential exposure'));

    return {
      targetKey: target.targetKey,
      targetType: target.targetType as any,
      targetFile: target.targetFile,
      targetSymbol: target.targetSymbol,
      score: target.score,
      level: target.level as any,
      severity: target.severity,
      likelihood: target.likelihood,
      confidence: target.confidence,
      isConfirmed,
      reasons,
      evidence,
      unresolvedLimitations: JSON.parse(target.unresolvedLimitations),
    };
  });
}
