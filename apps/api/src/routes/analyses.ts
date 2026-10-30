import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  CreateAnalysisRequestSchema,
  CreateAnalysisResponse,
  GetAnalysisParamsSchema,
  GetAnalysisResponse,
} from '@devos/contracts';
import { assertRepoPath, getDiff, resolveRef, listTrackedFilesAtCommit } from '../git/index.js';
import {
  createAnalysis,
  createChangedFile,
  createInvestigation,
  createSymbols,
  deleteSymbolsByAnalysis,
  getAnalysisById,
  getRepositoryById,
} from '../repo/index.js';
import { collectAndExtractSymbols, ExtractionMetrics } from '../ast/index.js';
import { buildAndPersistDependencyGraph } from '../graph/index.js';
import { prisma } from '../db.js';

export interface ExecuteAstExtractionOptions {
  analysisId: string;
  repositoryId: string;
  repoPath: string;
  baseSha: string;
  headSha: string;
  files?: Array<{ path: string; changeType: string }>;
}

export async function executeAstExtractionForAnalysis(
  options: ExecuteAstExtractionOptions,
  client = prisma
): Promise<{
  success: boolean;
  stage: string;
  status: string;
  metrics: ExtractionMetrics;
  error?: string | null;
}> {
  const { analysisId, repositoryId, repoPath, baseSha, headSha, files } = options;
  const startedAt = new Date();

  try {
    // Step B: Extract AST symbols outside the DB transaction to avoid holding locks
    const extractionReport = await collectAndExtractSymbols({
      repoPath,
      headSha,
      scope: 'all',
      files,
    });
    const { metrics, results } = extractionReport;

    const symbolsToPersist = results.flatMap((res) =>
      res.symbols.map((s) => ({
        repositoryId,
        analysisId,
        symbolKey: s.symbolKey,
        name: s.name,
        kind: s.kind,
        file: s.file,
        lineStart: s.lineStart,
        lineEnd: s.lineEnd,
        colStart: s.colStart ?? null,
        colEnd: s.colEnd ?? null,
        isExported: s.isExported,
        containerName: s.containerName ?? null,
        signature: s.signature ?? null,
        importKind: s.importKind ?? null,
        importedName: s.importedName ?? null,
        localName: s.localName ?? null,
        moduleSpecifier: s.moduleSpecifier ?? null,
        exportKind: s.exportKind ?? null,
        exportAlias: s.exportAlias ?? null,
        isReExport: s.isReExport ?? false,
        reExportModule: s.reExportModule ?? null,
        metadata: s.metadata ?? null,
        commitSha: headSha,
        collector: 'ast-collector',
      }))
    );

    // Step C: Persist symbols and investigation stage in a separate, isolated transaction
    const astFinishedAt = new Date();
    let stage = 'ast_extraction_complete';
    let investigationStatus = 'in_progress';
    let errorPayload: string | null = null;

    if (metrics.extractionErrors > 0 && metrics.filesProcessed === 0) {
      stage = 'ast_extraction_failed';
      investigationStatus = 'failed';
      errorPayload = JSON.stringify({
        message: 'AST extraction failed for all discoverable TypeScript files',
        metrics,
      });
    } else if (metrics.extractionErrors > 0 || metrics.parseErrors > 0) {
      stage = 'ast_extraction_partial';
      investigationStatus = 'in_progress';
      errorPayload = JSON.stringify({
        message: 'AST extraction completed with parse diagnostics or file errors',
        metrics,
      });
    }

    await client.$transaction(async (tx) => {
      // Clean up previous symbols for this analysis on retries (idempotency)
      await deleteSymbolsByAnalysis(analysisId, tx as any);
      await createSymbols(symbolsToPersist, tx as any);

      // Record AST extraction investigation stage with metrics
      await createInvestigation(
        {
          analysisId,
          status: investigationStatus,
          stage,
          startedAt,
          finishedAt: astFinishedAt,
          error: errorPayload,
          baseSha,
          headSha,
          collector: 'ast-collector',
        },
        tx as any
      );
    });

    return {
      success: stage !== 'ast_extraction_failed',
      stage,
      status: investigationStatus,
      metrics,
      error: errorPayload,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const failurePayload = JSON.stringify({
      message: 'Fatal error during AST extraction or persistence',
      error: errorMsg,
    });

    // Record failure in Investigation and mark Analysis as failed using the primary prisma client
    try {
      await prisma.$transaction(async (tx) => {
        await createInvestigation(
          {
            analysisId,
            status: 'failed',
            stage: 'ast_extraction_failed',
            startedAt,
            finishedAt: new Date(),
            error: failurePayload,
            baseSha,
            headSha,
            collector: 'ast-collector',
          },
          tx as any
        );

        await tx.analysis.update({
          where: { id: analysisId },
          data: {
            status: 'failed',
            error: `AST extraction failed: ${errorMsg}`,
            finishedAt: new Date(),
          },
        });
      });
    } catch (dbErr) {
      // Primary DB failure recording attempt completed
    }

    return {
      success: false,
      stage: 'ast_extraction_failed',
      status: 'failed',
      metrics: {
        filesDiscovered: 0,
        filesProcessed: 0,
        filesSkipped: 0,
        parseErrors: 0,
        extractionErrors: 1,
        totalSymbols: 0,
      },
      error: failurePayload,
    };
  }
}

export const analysisRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/analyses
  app.post('/analyses', async (request, reply) => {
    const body = CreateAnalysisRequestSchema.parse(request.body);

    const repo = await getRepositoryById(body.repositoryId);
    if (!repo) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Repository with ID "${body.repositoryId}" not found`,
        },
      });
      return;
    }

    const allowedRoot = app.appConfig?.ALLOWED_REPO_ROOT;
    let repoPath: string;
    try {
      repoPath = await assertRepoPath(repo.path, allowedRoot);
    } catch (err: any) {
      reply.status(400).send({
        error: {
          code: 'INVALID_REPO_PATH',
          message: `Repository storage path is inaccessible: ${err.message}`,
        },
      });
      return;
    }

    let resolvedBaseSha: string;
    try {
      resolvedBaseSha = await resolveRef(repoPath, body.baseSha);
    } catch (err: any) {
      reply.status(400).send({
        error: {
          code: 'INVALID_REF',
          message: `Invalid base ref "${body.baseSha}": ${err.message}`,
        },
      });
      return;
    }

    let resolvedHeadSha: string;
    try {
      resolvedHeadSha = await resolveRef(repoPath, body.headSha);
    } catch (err: any) {
      reply.status(400).send({
        error: {
          code: 'INVALID_REF',
          message: `Invalid head ref "${body.headSha}": ${err.message}`,
        },
      });
      return;
    }

    // Collect actual Git diff
    const diffFiles = await getDiff(repoPath, resolvedBaseSha, resolvedHeadSha);

    const startedAt = new Date();

    // Step A: Persist analysis, git ingestion stage, and changed-file records in initial transaction
    const analysis = await prisma.$transaction(async (tx) => {
      const created = await createAnalysis(
        {
          repositoryId: repo.id,
          baseSha: resolvedBaseSha,
          headSha: resolvedHeadSha,
          status: 'running', // Explicitly 'running': Git ingestion complete; full DEVOS report pending
          startedAt,
          finishedAt: null,
          error: null,
        },
        tx
      );

      // Record investigation stage indicating git ingestion has completed
      await createInvestigation(
        {
          analysisId: created.id,
          status: 'in_progress',
          stage: 'git_ingestion_complete',
          startedAt,
          finishedAt: new Date(),
          error: null,
          baseSha: resolvedBaseSha,
          headSha: resolvedHeadSha,
          collector: 'git-diff-collector',
        },
        tx
      );

      for (const file of diffFiles) {
        await createChangedFile(
          {
            analysisId: created.id,
            path: file.path,
            changeType: file.changeType,
            oldPath: file.oldPath,
            baseSha: resolvedBaseSha,
            headSha: resolvedHeadSha,
            collector: 'git-diff-collector',
          },
          tx
        );
      }

      return created;
    });

    // Step B & C: Extract AST symbols and persist them with robust error handling
    const extractionResult = await executeAstExtractionForAnalysis({
      analysisId: analysis.id,
      repositoryId: repo.id,
      repoPath,
      baseSha: resolvedBaseSha,
      headSha: resolvedHeadSha,
      files: diffFiles,
    });

    if (!extractionResult.success) {
      reply.status(500).send({
        error: {
          code: 'AST_EXTRACTION_FAILED',
          message: `AST extraction failed: ${extractionResult.error ?? 'Unknown error'}`,
        },
      });
      return;
    }

    const symbolsForGraph = await prisma.symbol.findMany({
      where: { analysisId: analysis.id },
    });

    const trackedFiles = await listTrackedFilesAtCommit(repoPath, resolvedHeadSha);

    const graphResult = await buildAndPersistDependencyGraph({
      analysisId: analysis.id,
      repositoryId: repo.id,
      repoPath,
      headSha: resolvedHeadSha,
      baseSha: resolvedBaseSha,
      trackedFiles,
      symbols: symbolsForGraph,
    });

    if (!graphResult.success) {
      reply.status(500).send({
        error: {
          code: 'DEPENDENCY_GRAPH_FAILED',
          message: `Dependency graph construction failed: ${graphResult.error ?? 'Unknown error'}`,
        },
      });
      return;
    }

    const response: CreateAnalysisResponse = {
      id: analysis.id,
      repositoryId: analysis.repositoryId,
      baseSha: analysis.baseSha,
      headSha: analysis.headSha,
      status: 'running',
      startedAt: analysis.startedAt ? analysis.startedAt.toISOString() : null,
      finishedAt: null,
      error: analysis.error,
    };

    reply.status(201).send(response);
  });

  // GET /api/analyses/:id
  app.get('/analyses/:id', async (request, reply) => {
    const params = GetAnalysisParamsSchema.parse(request.params);
    const analysis = await getAnalysisById(params.id);

    if (!analysis) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Analysis with ID "${params.id}" not found`,
        },
      });
      return;
    }

    const response: GetAnalysisResponse = {
      job: {
        id: analysis.id,
        repositoryId: analysis.repositoryId,
        baseSha: analysis.baseSha,
        headSha: analysis.headSha,
        status: analysis.status as any,
        startedAt: analysis.startedAt ? analysis.startedAt.toISOString() : null,
        finishedAt: analysis.finishedAt ? analysis.finishedAt.toISOString() : null,
        error: analysis.error,
      },
      report: null, // Report generation is staged for subsequent AI / AST milestones
    };

    return response;
  });
};
