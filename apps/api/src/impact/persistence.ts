import { prisma } from '../db.js';
import { DbClient } from '../repo/types.js';
import { createInvestigation } from '../repo/artifactRepo.js';
import { ImpactReport, ImpactResultItem, ImpactSummary } from './types.js';

export function validateImpactProvenance(results: ImpactResultItem[]): void {
  for (const item of results) {
    if (!item.analysisId || typeof item.analysisId !== 'string' || item.analysisId.trim() === '') {
      throw new Error(`Impact result "${item.resultKey}" is missing valid analysisId provenance`);
    }
    if (!item.repositoryId || typeof item.repositoryId !== 'string' || item.repositoryId.trim() === '') {
      throw new Error(`Impact result "${item.resultKey}" is missing valid repositoryId provenance`);
    }
    if (!item.commitSha || typeof item.commitSha !== 'string' || item.commitSha.trim() === '') {
      throw new Error(`Impact result "${item.resultKey}" is missing valid commitSha provenance`);
    }
    if (!item.resultKey || typeof item.resultKey !== 'string' || item.resultKey.trim() === '') {
      throw new Error('Impact result item has empty resultKey');
    }
    if (!item.targetKey || typeof item.targetKey !== 'string' || item.targetKey.trim() === '') {
      throw new Error(`Impact result "${item.resultKey}" is missing targetKey`);
    }
    if (!item.sourceChangeKey || typeof item.sourceChangeKey !== 'string' || item.sourceChangeKey.trim() === '') {
      throw new Error(`Impact result "${item.resultKey}" is missing sourceChangeKey`);
    }
    if (!item.classification || typeof item.classification !== 'string' || item.classification.trim() === '') {
      throw new Error(`Impact result "${item.resultKey}" is missing classification`);
    }
    if (!item.collector || typeof item.collector !== 'string' || item.collector.trim() === '') {
      throw new Error(`Impact result "${item.resultKey}" is missing collector provenance`);
    }
  }
}

export async function persistImpactReport(
  report: ImpactReport,
  baseSha: string,
  startedAt: Date = new Date(),
  client: any = prisma
): Promise<void> {
  const { summary, results, stage, error } = report;
  validateImpactProvenance(results);

  const finishedAt = new Date();
  let investigationStatus = 'in_progress';
  let errorPayload: string | null = null;

  if (stage === 'impact_analysis_failed') {
    investigationStatus = 'failed';
    errorPayload = JSON.stringify({
      message: error ?? 'Impact analysis failed',
      summary,
    });
  } else if (stage === 'impact_analysis_partial') {
    investigationStatus = 'in_progress';
    errorPayload = JSON.stringify({
      message: 'Impact analysis completed with unresolved or ambiguous dependencies',
      summary,
    });
  }

  const createInputs = results.map((r) => ({
    analysisId: r.analysisId,
    repositoryId: r.repositoryId,
    commitSha: r.commitSha,
    resultKey: r.resultKey,
    targetKey: r.targetKey,
    targetType: r.targetType,
    targetFile: r.targetFile,
    targetSymbol: r.targetSymbol,
    sourceChangeKey: r.sourceChangeKey,
    sourceChangeFile: r.sourceChangeFile,
    sourceChangeSymbol: r.sourceChangeSymbol,
    classification: r.classification,
    depth: r.depth,
    path: JSON.stringify(r.path),
    relationshipTypes: JSON.stringify(r.relationshipTypes),
    edgeKeys: JSON.stringify(r.edgeKeys),
    resolutionStatus: r.resolutionStatus,
    collector: r.collector,
    metadata: r.metadata ? JSON.stringify(r.metadata) : null,
  }));

  await (client as any).$transaction(async (tx: any) => {
    await tx.impactResult.deleteMany({
      where: { analysisId: summary.analysisId },
    });

    if (createInputs.length > 0) {
      await tx.impactResult.createMany({
        data: createInputs,
      });
    }

    await createInvestigation(
      {
        analysisId: summary.analysisId,
        status: investigationStatus,
        stage,
        startedAt,
        finishedAt,
        error: errorPayload,
        baseSha,
        headSha: summary.commitSha,
        collector: 'change-impact-analyzer',
      },
      tx as any
    );
  });
}

export async function deleteImpactResultsByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<number> {
  const res = await client.impactResult.deleteMany({
    where: { analysisId },
  });
  return res.count;
}

export async function listImpactResultsByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<ImpactResultItem[]> {
  const records = await client.impactResult.findMany({
    where: { analysisId },
    orderBy: [{ depth: 'asc' }, { targetKey: 'asc' }],
  });

  return records.map((r) => ({
    id: r.id,
    resultKey: r.resultKey,
    analysisId: r.analysisId,
    repositoryId: r.repositoryId,
    commitSha: r.commitSha,
    targetKey: r.targetKey,
    targetType: r.targetType as any,
    targetFile: r.targetFile,
    targetSymbol: r.targetSymbol,
    sourceChangeKey: r.sourceChangeKey,
    sourceChangeFile: r.sourceChangeFile,
    sourceChangeSymbol: r.sourceChangeSymbol,
    classification: r.classification as any,
    depth: r.depth,
    path: JSON.parse(r.path),
    relationshipTypes: JSON.parse(r.relationshipTypes),
    edgeKeys: JSON.parse(r.edgeKeys),
    resolutionStatus: r.resolutionStatus as any,
    collector: r.collector,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getImpactReportByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<ImpactReport | null> {
  const results = await listImpactResultsByAnalysis(analysisId, client);
  if (results.length === 0) {
    const inv = await client.investigation.findFirst({
      where: { analysisId, stage: { in: ['impact_analysis_complete', 'impact_analysis_partial', 'impact_analysis_failed'] } },
      orderBy: { startedAt: 'desc' },
    });
    if (!inv) return null;
    return {
      summary: {
        analysisId,
        repositoryId: '',
        commitSha: inv.headSha,
        changedFilesCount: 0,
        changedSymbolsCount: 0,
        directImpactCount: 0,
        transitiveImpactCount: 0,
        unresolvedImpactCount: 0,
        ambiguousImpactCount: 0,
        maxDepthReached: 0,
        isPartial: inv.stage === 'impact_analysis_partial',
      },
      results: [],
      stage: inv.stage,
      error: inv.error,
    };
  }

  const sample = results[0]!;
  let directImpactCount = 0;
  let transitiveImpactCount = 0;
  let unresolvedImpactCount = 0;
  let ambiguousImpactCount = 0;
  let maxDepthReached = 0;
  const changedFilesSet = new Set<string>();
  const changedSymbolsSet = new Set<string>();

  for (const r of results) {
    if (r.depth > maxDepthReached) maxDepthReached = r.depth;
    if (r.classification === 'changed') {
      if (r.targetType === 'file' && r.targetFile) changedFilesSet.add(r.targetFile);
      if (r.targetType === 'symbol' && r.targetSymbol) changedSymbolsSet.add(r.targetSymbol);
    } else if (r.classification === 'direct') {
      directImpactCount++;
    } else if (r.classification === 'transitive') {
      transitiveImpactCount++;
    } else if (r.classification === 'unresolved') {
      unresolvedImpactCount++;
    } else if (r.classification === 'ambiguous') {
      ambiguousImpactCount++;
    }
  }

  const isPartial = unresolvedImpactCount > 0 || ambiguousImpactCount > 0;
  const stage = isPartial ? 'impact_analysis_partial' : 'impact_analysis_complete';

  const summary: ImpactSummary = {
    analysisId,
    repositoryId: sample.repositoryId,
    commitSha: sample.commitSha,
    changedFilesCount: changedFilesSet.size,
    changedSymbolsCount: changedSymbolsSet.size,
    directImpactCount,
    transitiveImpactCount,
    unresolvedImpactCount,
    ambiguousImpactCount,
    maxDepthReached,
    isPartial,
  };

  return {
    summary,
    results,
    stage,
  };
}
