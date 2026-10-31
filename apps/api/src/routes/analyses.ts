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
import {
  executeImpactAnalysisForAnalysis,
  getImpactReportByAnalysis,
  listImpactResultsByAnalysis,
} from '../impact/index.js';
import {
  executeRiskAnalysisForAnalysis,
  getRiskAssessmentByAnalysis,
  getRiskTargetResult,
} from '../risk/index.js';
import {
  completeAnalysisLifecycle,
  constructAnalysisReport,
} from '../lifecycle/index.js';
import {
  generateChangeReviewReport,
  generateSmartCommitMessage,
  generateReleaseNotesReport,
  evaluatePreShipHealth,
  evaluateReleaseGate,
  ReleaseGatePolicy,
} from '../intelligence/index.js';
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
      await completeAnalysisLifecycle(analysis.id).catch(() => null);
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
      await completeAnalysisLifecycle(analysis.id).catch(() => null);
      reply.status(500).send({
        error: {
          code: 'DEPENDENCY_GRAPH_FAILED',
          message: `Dependency graph construction failed: ${graphResult.error ?? 'Unknown error'}`,
        },
      });
      return;
    }

    const impactResult = await executeImpactAnalysisForAnalysis({
      analysisId: analysis.id,
      repoPath,
    });

    if (!impactResult.success) {
      await completeAnalysisLifecycle(analysis.id).catch(() => null);
      reply.status(500).send({
        error: {
          code: 'IMPACT_ANALYSIS_FAILED',
          message: `Impact analysis failed: ${impactResult.error ?? 'Unknown error'}`,
        },
      });
      return;
    }

    const riskResult = await executeRiskAnalysisForAnalysis({
      analysisId: analysis.id,
      repoPath,
    });

    if (!riskResult.success) {
      await completeAnalysisLifecycle(analysis.id).catch(() => null);
      reply.status(500).send({
        error: {
          code: 'RISK_ANALYSIS_FAILED',
          message: `Risk analysis failed: ${riskResult.error ?? 'Unknown error'}`,
        },
      });
      return;
    }

    const completion = await completeAnalysisLifecycle(analysis.id);

    const response: CreateAnalysisResponse = {
      id: completion.analysis.id,
      repositoryId: completion.analysis.repositoryId,
      baseSha: completion.analysis.baseSha,
      headSha: completion.analysis.headSha,
      status: completion.status,
      startedAt: completion.analysis.startedAt ? completion.analysis.startedAt.toISOString() : null,
      finishedAt: completion.analysis.finishedAt ? completion.analysis.finishedAt.toISOString() : null,
      error: completion.analysis.error,
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

    let report: any = null;
    if (analysis.status === 'completed' || analysis.status === 'done' || analysis.status === 'partial') {
      const risk = await getRiskAssessmentByAnalysis(params.id);
      if (risk) {
        const symbols = await prisma.symbol.findMany({
          where: { analysisId: params.id },
        });
        report = constructAnalysisReport(analysis.id, risk, symbols);
      }
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
      report,
    };

    return response;
  });

  app.post('/analyses/:id/complete', async (request, reply) => {
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

    try {
      const completion = await completeAnalysisLifecycle(params.id);
      return {
        job: {
          id: completion.analysis.id,
          repositoryId: completion.analysis.repositoryId,
          baseSha: completion.analysis.baseSha,
          headSha: completion.analysis.headSha,
          status: completion.status,
          startedAt: completion.analysis.startedAt ? completion.analysis.startedAt.toISOString() : null,
          finishedAt: completion.analysis.finishedAt ? completion.analysis.finishedAt.toISOString() : null,
          error: completion.analysis.error,
        },
        report: completion.report,
      };
    } catch (err: any) {
      const message = err.message || String(err);
      if (message.startsWith('PREMATURE_COMPLETION:')) {
        reply.status(400).send({
          error: {
            code: 'PREMATURE_COMPLETION',
            message: message.replace('PREMATURE_COMPLETION: ', ''),
          },
        });
        return;
      }
      throw err;
    }
  });

  app.post('/analyses/:id/impact', async (request, reply) => {
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

    const repo = await getRepositoryById(analysis.repositoryId);
    const repoPath = repo?.path ?? null;

    const result = await executeImpactAnalysisForAnalysis({
      analysisId: analysis.id,
      repoPath,
    });

    if (!result.success) {
      reply.status(500).send({
        error: {
          code: 'IMPACT_ANALYSIS_FAILED',
          message: result.error ?? 'Impact analysis failed',
        },
      });
      return;
    }

    return result.report;
  });

  app.get('/analyses/:id/impact', async (request, reply) => {
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

    const report = await getImpactReportByAnalysis(params.id);
    if (!report) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Impact report for analysis "${params.id}" not found`,
        },
      });
      return;
    }

    return report;
  });

  app.get('/analyses/:id/impact/targets/:targetKey', async (request, reply) => {
    const params = request.params as { id: string; targetKey: string };
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

    const decodedTargetKey = decodeURIComponent(params.targetKey);
    const allResults = await listImpactResultsByAnalysis(params.id);
    const matching = allResults.filter((r) => r.targetKey === decodedTargetKey);

    if (matching.length === 0) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Impact target "${decodedTargetKey}" not found for analysis "${params.id}"`,
        },
      });
      return;
    }

    return {
      targetKey: decodedTargetKey,
      impacts: matching,
    };
  });

  app.post('/analyses/:id/risk', async (request, reply) => {
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

    const repo = await getRepositoryById(analysis.repositoryId);
    const repoPath = repo?.path ?? null;

    const result = await executeRiskAnalysisForAnalysis({
      analysisId: analysis.id,
      repoPath,
    });

    if (!result.success) {
      reply.status(500).send({
        error: {
          code: 'RISK_ANALYSIS_FAILED',
          message: result.error ?? 'Risk analysis failed',
        },
      });
      return;
    }

    return result.report;
  });

  app.get('/analyses/:id/risk', async (request, reply) => {
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

    const report = await getRiskAssessmentByAnalysis(params.id);
    if (!report) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Risk assessment report for analysis "${params.id}" not found`,
        },
      });
      return;
    }

    return report;
  });

  app.get('/analyses/:id/risk/targets/:targetKey', async (request, reply) => {
    const params = request.params as { id: string; targetKey: string };
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

    const decodedTargetKey = decodeURIComponent(params.targetKey);
    const targetResult = await getRiskTargetResult(params.id, decodedTargetKey);

    if (!targetResult) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Risk target "${decodedTargetKey}" not found for analysis "${params.id}"`,
        },
      });
      return;
    }

    return targetResult;
  });

  app.get('/analyses/:id/review', async (request, reply) => {
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

    const changedFiles = await prisma.changedFile.findMany({
      where: { analysisId: params.id },
    });
    const symbols = await prisma.symbol.findMany({
      where: { analysisId: params.id },
    });
    const riskReport = await getRiskAssessmentByAnalysis(params.id);

    const report = generateChangeReviewReport({
      analysisId: analysis.id,
      repositoryId: analysis.repositoryId,
      commitSha: analysis.headSha,
      changedFiles: changedFiles.map((f) => ({ path: f.path, changeType: f.changeType })),
      changedSymbols: symbols.map((s) => ({
        name: s.name,
        kind: s.kind,
        file: s.file,
        isExported: s.isExported,
      })),
      riskReport,
    });

    return report;
  });

  app.get('/analyses/:id/commit-message', async (request, reply) => {
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

    const repo = await getRepositoryById(analysis.repositoryId);
    const changedFiles = await prisma.changedFile.findMany({
      where: { analysisId: params.id },
    });
    const symbols = await prisma.symbol.findMany({
      where: { analysisId: params.id },
    });

    const result = generateSmartCommitMessage({
      changedFiles: changedFiles.map((f) => ({
        path: f.path,
        changeType: f.changeType,
        oldPath: f.oldPath,
      })),
      changedSymbols: symbols.map((s) => ({
        name: s.name,
        kind: s.kind,
        file: s.file,
        isExported: s.isExported,
      })),
      repositoryName: repo?.name,
    });

    return result;
  });

  app.get('/analyses/:id/release-notes', async (request, reply) => {
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

    const changedFiles = await prisma.changedFile.findMany({
      where: { analysisId: params.id },
    });
    const symbols = await prisma.symbol.findMany({
      where: { analysisId: params.id },
    });
    const riskReport = await getRiskAssessmentByAnalysis(params.id);

    const report = generateReleaseNotesReport({
      analysisId: analysis.id,
      repositoryId: analysis.repositoryId,
      commitSha: analysis.headSha,
      changedFiles: changedFiles.map((f) => ({
        path: f.path,
        changeType: f.changeType,
        oldPath: f.oldPath,
      })),
      changedSymbols: symbols.map((s) => ({
        name: s.name,
        kind: s.kind,
        file: s.file,
        isExported: s.isExported,
      })),
      riskAssessment: riskReport,
    });

    return report;
  });

  app.get('/analyses/:id/health', async (request, reply) => {
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

    const changedFiles = await prisma.changedFile.findMany({
      where: { analysisId: params.id },
    });
    const symbolsCount = await prisma.symbol.count({
      where: { analysisId: params.id },
    });
    const nodesCount = await prisma.dependencyNode.count({
      where: { analysisId: params.id },
    });
    const edgesCount = await prisma.dependencyEdge.count({
      where: { analysisId: params.id },
    });
    const impactsCount = await prisma.impactResult.count({
      where: { analysisId: params.id },
    });
    const riskReport = await getRiskAssessmentByAnalysis(params.id);

    const testFilesFound = changedFiles.some(
      (f) => f.path.includes('.test.') || f.path.includes('.spec.')
    );

    const report = evaluatePreShipHealth({
      analysisId: analysis.id,
      repositoryId: analysis.repositoryId,
      commitSha: analysis.headSha,
      changedFilesCount: changedFiles.length,
      symbolsCount,
      dependencyNodesCount: nodesCount,
      dependencyEdgesCount: edgesCount,
      impactResultsCount: impactsCount,
      riskAssessment: riskReport,
      testFilesFound,
      databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    });

    return report;
  });

  app.post('/analyses/:id/health/gate', async (request, reply) => {
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

    const body = (request.body as { policy?: ReleaseGatePolicy }) ?? {};
    const changedFiles = await prisma.changedFile.findMany({
      where: { analysisId: params.id },
    });
    const symbolsCount = await prisma.symbol.count({
      where: { analysisId: params.id },
    });
    const nodesCount = await prisma.dependencyNode.count({
      where: { analysisId: params.id },
    });
    const edgesCount = await prisma.dependencyEdge.count({
      where: { analysisId: params.id },
    });
    const impactsCount = await prisma.impactResult.count({
      where: { analysisId: params.id },
    });
    const riskReport = await getRiskAssessmentByAnalysis(params.id);

    const testFilesFound = changedFiles.some(
      (f) => f.path.includes('.test.') || f.path.includes('.spec.')
    );

    const evaluation = evaluateReleaseGate(
      {
        analysisId: analysis.id,
        repositoryId: analysis.repositoryId,
        commitSha: analysis.headSha,
        changedFilesCount: changedFiles.length,
        symbolsCount,
        dependencyNodesCount: nodesCount,
        dependencyEdgesCount: edgesCount,
        impactResultsCount: impactsCount,
        riskAssessment: riskReport,
        testFilesFound,
        databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
      },
      body.policy
    );

    return evaluation;
  });
};
