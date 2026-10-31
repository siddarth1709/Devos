import { prisma } from '../db.js';
import { DbClient } from '../repo/types.js';
import { getDiff } from '../git/ops.js';
import { ChangedFileInput, ImpactReport } from './types.js';
import { traverseImpact } from './traversal.js';
import { persistImpactReport } from './persistence.js';
import { createInvestigation } from '../repo/artifactRepo.js';

export interface ExecuteImpactAnalysisOptions {
  analysisId: string;
  repoPath?: string | null;
  maxDepth?: number;
}

export interface ExecuteImpactAnalysisResult {
  success: boolean;
  stage: string;
  report?: ImpactReport | null;
  error?: string | null;
}

export async function executeImpactAnalysisForAnalysis(
  options: ExecuteImpactAnalysisOptions,
  client: DbClient = prisma
): Promise<ExecuteImpactAnalysisResult> {
  const { analysisId, repoPath, maxDepth = 10 } = options;
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
        stage: 'impact_analysis_failed',
        error: `Analysis "${analysisId}" not found`,
      };
    }

    const failedGraphInv = await client.investigation.findFirst({
      where: { analysisId, stage: 'dependency_graph_failed' },
    });
    if (failedGraphInv) {
      const finishedAt = new Date();
      await createInvestigation(
        {
          analysisId,
          status: 'failed',
          stage: 'impact_analysis_failed',
          startedAt,
          finishedAt,
          error: JSON.stringify({ message: 'Dependency graph failed for this analysis; cannot perform impact analysis' }),
          baseSha: analysis.baseSha,
          headSha: analysis.headSha,
          collector: 'change-impact-analyzer',
        },
        client as any
      );
      return {
        success: false,
        stage: 'impact_analysis_failed',
        error: 'Dependency graph failed for this analysis',
      };
    }

    const [nodes, edges, symbols] = await Promise.all([
      client.dependencyNode.findMany({ where: { analysisId } }),
      client.dependencyEdge.findMany({ where: { analysisId } }),
      client.symbol.findMany({ where: { analysisId } }),
    ]);

    if (nodes.length === 0 && edges.length === 0) {
      const finishedAt = new Date();
      await createInvestigation(
        {
          analysisId,
          status: 'failed',
          stage: 'impact_analysis_failed',
          startedAt,
          finishedAt,
          error: JSON.stringify({ message: 'Dependency graph is missing for this analysis; run dependency graph builder first' }),
          baseSha: analysis.baseSha,
          headSha: analysis.headSha,
          collector: 'change-impact-analyzer',
        },
        client as any
      );
      return {
        success: false,
        stage: 'impact_analysis_failed',
        error: 'Dependency graph is missing for this analysis',
      };
    }

    let diffHunksMap = new Map<string, Array<{ oldStart: number; oldLines: number; newStart: number; newLines: number }>>();
    if (repoPath) {
      try {
        const diffFiles = await getDiff(repoPath, analysis.baseSha, analysis.headSha);
        for (const df of diffFiles) {
          diffHunksMap.set(df.path, df.hunks);
        }
      } catch {
        diffHunksMap = new Map();
      }
    }

    const changedFilesInput: ChangedFileInput[] = analysis.changedFiles.map((cf) => ({
      path: cf.path,
      changeType: cf.changeType,
      oldPath: cf.oldPath,
      hunks: diffHunksMap.get(cf.path),
    }));

    const report = traverseImpact({
      changedFiles: changedFilesInput,
      symbols,
      nodes,
      edges,
      analysisId: analysis.id,
      repositoryId: analysis.repositoryId,
      commitSha: analysis.headSha,
      maxDepth,
    });

    const graphPartialInv = await client.investigation.findFirst({
      where: { analysisId, stage: 'dependency_graph_partial' },
    });
    if (graphPartialInv) {
      report.stage = 'impact_analysis_partial';
      report.summary.isPartial = true;
    }

    await persistImpactReport(report, analysis.baseSha, startedAt, client);

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
          stage: 'impact_analysis_failed',
          startedAt,
          finishedAt: new Date(),
          error: JSON.stringify({ message: errorMsg }),
          baseSha: '',
          headSha: '',
          collector: 'change-impact-analyzer',
        },
        client as any
      );
    } catch {
    }

    return {
      success: false,
      stage: 'impact_analysis_failed',
      error: errorMsg,
    };
  }
}
