import { prisma } from '../db.js';
import { DbClient } from '../repo/types.js';
import { getDiff } from '../git/ops.js';
import { calculateDeterministicRisk } from './scoring.js';
import { persistRiskAssessment } from './persistence.js';
import { ChangedSymbolInfo, RiskAssessmentReport, RiskScoringInput } from './types.js';
import { createInvestigation } from '../repo/artifactRepo.js';

export interface HunkInfo {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
}

export interface DiffFileInfo {
  path: string;
  oldPath?: string | null;
  changeType: string;
  binary?: boolean;
  hunks?: HunkInfo[];
}

export function matchSymbolWithHunks(
  symbol: { lineStart: number; lineEnd: number },
  hunks: HunkInfo[]
): boolean {
  return hunks.some((h) => {
    if (h.newLines === 0) {
      return symbol.lineStart <= h.newStart && symbol.lineEnd >= h.newStart;
    }
    const hunkEnd = h.newStart + Math.max(h.newLines - 1, 0);
    return !(symbol.lineEnd < h.newStart || symbol.lineStart > hunkEnd);
  });
}

export function identifyChangedSymbols(
  symbols: Array<{
    symbolKey: string;
    name: string;
    kind: string;
    file: string;
    lineStart: number;
    lineEnd: number;
    isExported: boolean;
    isReExport: boolean;
  }>,
  changedFiles: Array<{
    path: string;
    changeType: string;
    oldPath?: string | null;
  }>,
  diffFiles: DiffFileInfo[] | null
): ChangedSymbolInfo[] {
  const diffFileMap = new Map<string, DiffFileInfo>();
  if (diffFiles) {
    for (const df of diffFiles) {
      diffFileMap.set(df.path, df);
      if (df.oldPath) {
        diffFileMap.set(df.oldPath, df);
      }
    }
  }

  const result: ChangedSymbolInfo[] = [];

  const symbolsByFile = new Map<string, typeof symbols>();
  for (const s of symbols) {
    let list = symbolsByFile.get(s.file);
    if (!list) {
      list = [];
      symbolsByFile.set(s.file, list);
    }
    list.push(s);
  }

  for (const cf of changedFiles) {
    if (cf.changeType === 'deleted') {
      continue;
    }

    const fileSymbols = symbolsByFile.get(cf.path) ?? [];
    if (fileSymbols.length === 0) {
      continue;
    }

    const df = diffFileMap.get(cf.path) ?? (cf.oldPath ? diffFileMap.get(cf.oldPath) : undefined);

    if (cf.changeType === 'renamed') {
      if (!df || !df.hunks || df.hunks.length === 0) {
        continue;
      }
      for (const s of fileSymbols) {
        if (matchSymbolWithHunks(s, df.hunks)) {
          result.push({
            ...s,
            changeType: 'modified',
          });
        }
      }
      continue;
    }

    if (cf.changeType === 'added') {
      for (const s of fileSymbols) {
        result.push({
          ...s,
          changeType: 'added',
        });
      }
      continue;
    }

    if (df && df.hunks && df.hunks.length > 0) {
      for (const s of fileSymbols) {
        if (matchSymbolWithHunks(s, df.hunks)) {
          result.push({
            ...s,
            changeType: 'modified',
          });
        }
      }
    }
  }

  return result;
}

export interface ExecuteRiskAnalysisOptions {
  analysisId: string;
  repoPath?: string | null;
  diffFiles?: DiffFileInfo[] | null;
}

export interface ExecuteRiskAnalysisResult {
  success: boolean;
  stage: string;
  report?: RiskAssessmentReport | null;
  error?: string | null;
}

export async function executeRiskAnalysisForAnalysis(
  options: ExecuteRiskAnalysisOptions,
  client: DbClient = prisma
): Promise<ExecuteRiskAnalysisResult> {
  const { analysisId, repoPath } = options;
  const startedAt = new Date();

  try {
    const analysis = await client.analysis.findUnique({
      where: { id: analysisId },
      include: {
        changedFiles: true,
      },
    });

    if (!analysis) {
      return {
        success: false,
        stage: 'risk_analysis_failed',
        error: `Analysis "${analysisId}" not found`,
      };
    }

    const failedGitInv = await client.investigation.findFirst({
      where: { analysisId, stage: 'git_ingestion_failed' },
    });
    if (failedGitInv) {
      const finishedAt = new Date();
      await createInvestigation(
        {
          analysisId,
          status: 'failed',
          stage: 'risk_analysis_failed',
          startedAt,
          finishedAt,
          error: JSON.stringify({ message: 'Git ingestion failed for this analysis; cannot evaluate risk' }),
          baseSha: analysis.baseSha,
          headSha: analysis.headSha,
          collector: 'deterministic-risk-engine',
        },
        client as any
      );
      return {
        success: false,
        stage: 'risk_analysis_failed',
        error: 'Git ingestion failed for this analysis; cannot evaluate risk',
      };
    }

    const failedImpactInv = await client.investigation.findFirst({
      where: { analysisId, stage: 'impact_analysis_failed' },
    });
    if (failedImpactInv) {
      const finishedAt = new Date();
      await createInvestigation(
        {
          analysisId,
          status: 'failed',
          stage: 'risk_analysis_failed',
          startedAt,
          finishedAt,
          error: JSON.stringify({ message: 'Impact analysis failed for this analysis; cannot evaluate risk' }),
          baseSha: analysis.baseSha,
          headSha: analysis.headSha,
          collector: 'deterministic-risk-engine',
        },
        client as any
      );
      return {
        success: false,
        stage: 'risk_analysis_failed',
        error: 'Impact analysis failed for this analysis',
      };
    }

    const impactResults = await client.impactResult.findMany({
      where: { analysisId },
    });

    const impactInv = await client.investigation.findFirst({
      where: {
        analysisId,
        stage: { in: ['impact_analysis_complete', 'impact_analysis_partial'] },
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!impactInv && impactResults.length === 0) {
      const finishedAt = new Date();
      await createInvestigation(
        {
          analysisId,
          status: 'failed',
          stage: 'risk_analysis_failed',
          startedAt,
          finishedAt,
          error: JSON.stringify({ message: 'Impact analysis has not been run for this analysis' }),
          baseSha: analysis.baseSha,
          headSha: analysis.headSha,
          collector: 'deterministic-risk-engine',
        },
        client as any
      );
      return {
        success: false,
        stage: 'risk_analysis_failed',
        error: 'Impact analysis has not been run for this analysis',
      };
    }

    const investigations = await client.investigation.findMany({
      where: { analysisId },
    });

    const hasGitIngestionComplete = investigations.some(
      (inv) => inv.stage === 'git_ingestion_complete'
    );
    const isVerifiedEmptyDiff = analysis.changedFiles.length === 0 && hasGitIngestionComplete;

    const changedFiles = analysis.changedFiles.map((cf) => ({
      path: cf.path,
      changeType: cf.changeType,
      oldPath: cf.oldPath,
    }));

    const dependencyEdges = await client.dependencyEdge.findMany({
      where: { analysisId },
      select: {
        edgeKey: true,
        analysisId: true,
        repositoryId: true,
        commitSha: true,
      },
    });

    const validEdgeKeys = new Set<string>();
    const edgeProvenanceLimitations: string[] = [];

    for (const edge of dependencyEdges) {
      if (
        edge.analysisId === analysis.id &&
        edge.repositoryId === analysis.repositoryId &&
        edge.commitSha === analysis.headSha
      ) {
        validEdgeKeys.add(edge.edgeKey);
      } else {
        edgeProvenanceLimitations.push(
          `Dependency edge "${edge.edgeKey}" has mismatched provenance: repository=${edge.repositoryId ?? 'null'} (expected ${analysis.repositoryId}), commit=${edge.commitSha} (expected ${analysis.headSha})`
        );
      }
    }

    let diffFiles: DiffFileInfo[] | null = null;
    let gitDiffStatus: 'complete' | 'empty' | 'partial' | 'failed' | 'unavailable' = 'complete';
    let hasDiffHunks = false;

    if (options.diffFiles) {
      diffFiles = options.diffFiles;
      hasDiffHunks = diffFiles.some((df) => df.hunks && df.hunks.length > 0);
      gitDiffStatus = 'complete';
    } else if (repoPath) {
      try {
        const diffs = await getDiff(repoPath, analysis.baseSha, analysis.headSha);
        diffFiles = diffs;
        if (diffs.length > 0 && diffs.some((df) => df.hunks && df.hunks.length > 0)) {
          hasDiffHunks = true;
        }
        gitDiffStatus = 'complete';
      } catch {
        gitDiffStatus = 'failed';
        hasDiffHunks = false;
      }
    } else {
      gitDiffStatus = 'unavailable';
      hasDiffHunks = false;
    }

    const symbols = await client.symbol.findMany({
      where: { analysisId },
      select: {
        symbolKey: true,
        name: true,
        kind: true,
        file: true,
        lineStart: true,
        lineEnd: true,
        isExported: true,
        isReExport: true,
      },
    });

    const changedSymbols = identifyChangedSymbols(symbols, changedFiles, diffFiles);

    const parsedImpacts = impactResults.map((r) => {
      let isProvenanceValid = true;
      let provenanceError = '';

      if (r.analysisId !== analysis.id) {
        isProvenanceValid = false;
        provenanceError = `Mismatched ImpactResult analysisId: ${r.analysisId} (expected ${analysis.id})`;
      } else if (r.repositoryId !== analysis.repositoryId) {
        isProvenanceValid = false;
        provenanceError = `Mismatched ImpactResult repositoryId: ${r.repositoryId} (expected ${analysis.repositoryId})`;
      } else if (r.commitSha !== analysis.headSha) {
        isProvenanceValid = false;
        provenanceError = `Mismatched ImpactResult commitSha: ${r.commitSha} (expected ${analysis.headSha})`;
      }

      const edgeKeys: string[] = JSON.parse(r.edgeKeys);
      const resolutionStatus = !isProvenanceValid ? 'unresolved' : r.resolutionStatus;
      const classification = !isProvenanceValid ? 'unresolved' : r.classification;

      return {
        resultKey: r.resultKey,
        targetKey: r.targetKey,
        targetType: r.targetType,
        targetFile: r.targetFile,
        targetSymbol: r.targetSymbol,
        sourceChangeKey: r.sourceChangeKey,
        sourceChangeFile: r.sourceChangeFile,
        sourceChangeSymbol: r.sourceChangeSymbol,
        classification,
        depth: r.depth,
        path: JSON.parse(r.path),
        relationshipTypes: JSON.parse(r.relationshipTypes),
        edgeKeys,
        resolutionStatus,
        provenanceError: isProvenanceValid ? undefined : provenanceError,
      };
    });

    const scoringInput: RiskScoringInput = {
      analysisId: analysis.id,
      repositoryId: analysis.repositoryId,
      commitSha: analysis.headSha,
      changedFiles,
      changedSymbols,
      impactResults: parsedImpacts,
      investigations,
      hasDiffHunks,
      isVerifiedEmptyDiff,
      gitDiffStatus,
      validEdgeKeys,
      extraLimitations: edgeProvenanceLimitations,
    };

    const report = calculateDeterministicRisk(scoringInput);

    await persistRiskAssessment(
      report,
      analysis.baseSha,
      startedAt,
      client,
      {
        id: analysis.id,
        repositoryId: analysis.repositoryId,
        headSha: analysis.headSha,
      },
      validEdgeKeys
    );

    return {
      success: true,
      stage: report.stage,
      report,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    try {
      await createInvestigation(
        {
          analysisId,
          status: 'failed',
          stage: 'risk_analysis_failed',
          startedAt,
          finishedAt: new Date(),
          error: JSON.stringify({ message: errorMsg }),
          baseSha: '',
          headSha: '',
          collector: 'deterministic-risk-engine',
        },
        client as any
      );
    } catch {
    }

    return {
      success: false,
      stage: 'risk_analysis_failed',
      error: errorMsg,
    };
  }
}
