import { prisma } from '../db.js';
import { DbClient } from '../repo/types.js';
import { getRiskAssessmentByAnalysis } from '../risk/index.js';

export const REQUIRED_LIFECYCLE_STAGES = [
  'git_ingestion_complete',
  'ast_extraction_complete',
  'dependency_graph_complete',
  'impact_analysis_complete',
  'risk_analysis_complete',
] as const;

export interface LifecycleCompletionResult {
  analysis: any;
  status: 'completed' | 'partial' | 'failed';
  report: any | null;
}

export function constructAnalysisReport(
  analysisId: string,
  risk: any,
  symbols: any[]
): any {
  if (!risk) return null;
  const findings = (risk.highestRiskTargets || []).map((t: any, idx: number) => ({
    id: `f_${idx + 1}`,
    title: `Risk evaluation on ${t.targetKey}`,
    severity: (t.level === 'critical' ? 'critical' : t.level === 'high' ? 'high' : t.level === 'medium' ? 'medium' : 'low') as any,
    description: t.reasons?.join('; ') || 'Identified by deterministic risk analysis engine',
    evidenceIds: t.evidence?.edgeKeys || [],
    origin: 'deterministic' as const,
    status: t.isConfirmed ? ('confirmed' as const) : ('hypothesis' as const),
    confidence: (t.confidence >= 80 ? 'High' : t.confidence >= 50 ? 'Medium' : 'Low') as any,
  }));

  let readiness: 'safe' | 'conditional' | 'unsafe' | 'unknown' = 'safe';
  if (risk.score > 50) readiness = 'unsafe';
  else if (risk.score > 25) readiness = 'conditional';
  else if (risk.confidence < 50) readiness = 'unknown';

  let conf: 'Low' | 'Medium' | 'High' | 'Very High' = 'Medium';
  if (risk.confidence >= 90) conf = 'Very High';
  else if (risk.confidence >= 75) conf = 'High';
  else if (risk.confidence < 50) conf = 'Low';

  const confirmedDir = risk.confirmedExposure?.directDependentsCount ?? 0;
  const confirmedTrans = risk.confirmedExposure?.transitiveDependentsCount ?? 0;
  const unresCount = risk.potentialExposure?.unresolvedCount ?? 0;
  const ambigCount = risk.potentialExposure?.ambiguousCount ?? 0;

  return {
    jobId: analysisId,
    summary: `Deterministic risk score ${risk.score}/100 (${risk.level.toUpperCase()}), confidence ${risk.confidence}%.`,
    findings,
    changedSymbols: symbols.map((s: any) => `${s.file}#${s.name}`),
    impact: `Confirmed exposure: ${confirmedDir} direct, ${confirmedTrans} transitive. Uncertainty penalty: ${risk.uncertaintyAdjustment ?? 0}.`,
    readiness,
    confidence: conf,
    limitations: risk.limitations || [],
    missingEvidence: risk.missingEvidence || [],
    trustMeter: risk.confidence,
    claimsVerified: confirmedDir + confirmedTrans,
    claimsRejected: unresCount + ambigCount,
  };
}

export async function completeAnalysisLifecycle(
  analysisId: string,
  client: DbClient = prisma
): Promise<LifecycleCompletionResult> {
  const analysis = await client.analysis.findUnique({
    where: { id: analysisId },
  });

  if (!analysis) {
    throw new Error(`Analysis with ID "${analysisId}" not found`);
  }

  if (analysis.status === 'failed' || analysis.status === 'partial') {
    const risk = await getRiskAssessmentByAnalysis(analysisId, client);
    const symbols = await client.symbol.findMany({ where: { analysisId } });
    const report = constructAnalysisReport(analysisId, risk, symbols);
    return {
      analysis,
      status: analysis.status as any,
      report,
    };
  }

  if (analysis.status === 'completed' || analysis.status === 'done') {
    const risk = await getRiskAssessmentByAnalysis(analysisId, client);
    const symbols = await client.symbol.findMany({ where: { analysisId } });
    const report = constructAnalysisReport(analysisId, risk, symbols);
    return {
      analysis,
      status: 'completed',
      report,
    };
  }

  const investigations = await client.investigation.findMany({
    where: { analysisId },
  });

  if (investigations.length === 0) {
    throw new Error(`PREMATURE_COMPLETION: Cannot complete analysis "${analysisId}": No pipeline stage records found`);
  }

  const hasFailure =
    investigations.some(
      (inv) => inv.status === 'failed' || inv.stage.endsWith('_failed')
    ) || Boolean(analysis.error);

  if (hasFailure) {
    const finishedAt = new Date();
    const updated = await client.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'failed',
        finishedAt,
      },
    });
    return {
      analysis: updated,
      status: 'failed',
      report: null,
    };
  }

  const hasPartial = investigations.some((inv) =>
    inv.stage.endsWith('_partial')
  );

  if (hasPartial) {
    const finishedAt = new Date();
    const updated = await client.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'partial',
        finishedAt,
      },
    });
    const risk = await getRiskAssessmentByAnalysis(analysisId, client);
    const symbols = await client.symbol.findMany({ where: { analysisId } });
    const report = constructAnalysisReport(analysisId, risk, symbols);
    return {
      analysis: updated,
      status: 'partial',
      report,
    };
  }

  const stageNames = new Set(investigations.map((inv) => inv.stage));
  const hasGit = stageNames.has('git_ingestion_complete');
  const hasAst = stageNames.has('ast_extraction_complete');
  const hasGraph = stageNames.has('dependency_graph_complete');
  const hasImpact = stageNames.has('impact_analysis_complete');
  const hasRisk =
    stageNames.has('risk_analysis_complete') ||
    stageNames.has('risk_assessment_complete');

  const missingStages: string[] = [];
  if (!hasGit) missingStages.push('git_ingestion');
  if (!hasAst) missingStages.push('ast_extraction');
  if (!hasGraph) missingStages.push('dependency_graph');
  if (!hasImpact) missingStages.push('impact_analysis');
  if (!hasRisk) missingStages.push('risk_analysis');

  if (missingStages.length > 0) {
    throw new Error(
      `PREMATURE_COMPLETION: Cannot complete analysis "${analysisId}": Missing required pipeline stages: ${missingStages.join(', ')}`
    );
  }

  const finishedAt = new Date();
  const updated = await client.analysis.update({
    where: { id: analysisId },
    data: {
      status: 'completed',
      finishedAt,
    },
  });

  const risk = await getRiskAssessmentByAnalysis(analysisId, client);
  const symbols = await client.symbol.findMany({ where: { analysisId } });
  const report = constructAnalysisReport(analysisId, risk, symbols);

  return {
    analysis: updated,
    status: 'completed',
    report,
  };
}
