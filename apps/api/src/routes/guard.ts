import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { getAnalysisById } from "../repo/index.js";
import { getRiskAssessmentByAnalysis } from "../risk/index.js";
import { evaluateReleaseGate, ReleaseGatePolicy } from "../intelligence/healthChecks.js";

const GuardPolicySchema = z.object({
  id: z.string().min(1).default("default").optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  rules: z.object({
    maxRiskScore: z.number().int().min(0).max(100).optional(),
    minConfidence: z.number().int().min(0).max(100).optional(),
    blockOnAnyFailedCheck: z.boolean().optional(),
    allowedRiskLevels: z.array(z.string()).optional(),
  }),
});

const EvaluateGuardBodySchema = z.object({
  policy: z.object({
    maxRiskScore: z.number().int().min(0).max(100).optional(),
    minConfidence: z.number().int().min(0).max(100).optional(),
    blockOnAnyFailedCheck: z.boolean().optional(),
    allowedRiskLevels: z.array(z.string()).optional(),
  }).optional(),
  actor: z.string().optional(),
});

export const guardRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/guard/health", async () => {
    return {
      status: "healthy",
      version: "1.0.0",
      registeredChecks: [
        "Repository AST & Syntax Completeness",
        "Deterministic Risk Threshold",
        "Dependency Graph Resolution",
        "Test Evidence & Coverage Presence",
        "Impact Resolution Verification",
        "Infrastructure & Database Integrity",
      ],
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/guard/policies", async () => {
    const policies = await prisma.guardPolicy.findMany({
      orderBy: { updatedAt: "desc" },
    });

    if (policies.length === 0) {
      return {
        policies: [
          {
            id: "default",
            name: "Default Release Gate Policy",
            description: "Standard policy enforcing risk score <= 75 and confidence >= 40",
            rules: {
              maxRiskScore: 75,
              minConfidence: 40,
              blockOnAnyFailedCheck: true,
              allowedRiskLevels: ["LOW", "MEDIUM"],
            },
          },
        ],
      };
    }

    return {
      policies: policies.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        rules: JSON.parse(p.rules),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    };
  });

  app.put<{ Params: { id: string } }>("/guard/policies/:id", async (request, reply) => {
    const { id } = request.params;
    const body = GuardPolicySchema.parse(request.body);

    const saved = await prisma.guardPolicy.upsert({
      where: { id },
      update: {
        name: body.name,
        description: body.description ?? null,
        rules: JSON.stringify(body.rules),
        updatedAt: new Date(),
      },
      create: {
        id,
        name: body.name,
        description: body.description ?? null,
        rules: JSON.stringify(body.rules),
      },
    });

    return {
      id: saved.id,
      name: saved.name,
      description: saved.description,
      rules: JSON.parse(saved.rules),
      updatedAt: saved.updatedAt.toISOString(),
    };
  });

  app.post<{ Params: { id: string } }>("/analyses/:id/guard", async (request, reply) => {
    const { id } = request.params;
    const body = EvaluateGuardBodySchema.parse(request.body || {});

    const analysis = await getAnalysisById(id);
    if (!analysis) {
      reply.status(404).send({
        error: { code: "NOT_FOUND", message: `Analysis "${id}" not found` },
      });
      return;
    }

    const changedFiles = await prisma.changedFile.findMany({
      where: { analysisId: id },
    });
    const symbolsCount = await prisma.symbol.count({
      where: { analysisId: id },
    });
    const nodesCount = await prisma.dependencyNode.count({
      where: { analysisId: id },
    });
    const edgesCount = await prisma.dependencyEdge.count({
      where: { analysisId: id },
    });
    const impactsCount = await prisma.impactResult.count({
      where: { analysisId: id },
    });
    const riskReport = await getRiskAssessmentByAnalysis(id);

    const testFilesFound = changedFiles.some(
      (f) => f.path.includes(".test.") || f.path.includes(".spec.")
    );

    let effectivePolicy: ReleaseGatePolicy | undefined = body.policy;
    let policyId = "default";

    if (!effectivePolicy) {
      const storedPolicy = await prisma.guardPolicy.findUnique({
        where: { id: "default" },
      });
      if (storedPolicy) {
        try {
          effectivePolicy = JSON.parse(storedPolicy.rules);
          policyId = storedPolicy.id;
        } catch {
        }
      }
    }

    const rawEval = evaluateReleaseGate(
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
      effectivePolicy
    );

    let decision: "passed" | "passed_with_warnings" | "blocked" | "unable_to_evaluate";
    if (analysis.status === "failed") {
      decision = "blocked";
    } else if (analysis.status !== "completed" && analysis.status !== "done") {
      decision = "unable_to_evaluate";
    } else if (rawEval.gateStatus === "PASSED") {
      decision = "passed";
    } else if (rawEval.gateStatus === "WARNED") {
      decision = "passed_with_warnings";
    } else {
      decision = "blocked";
    }

    const evidenceList = await prisma.evidence.findMany({
      where: { analysisId: id },
      select: { id: true },
    });
    const evidenceRefs = evidenceList.map((e) => e.id);

    const persisted = await prisma.guardEvaluation.create({
      data: {
        analysisId: id,
        policyId,
        policyVersion: "1.0.0",
        evaluatedThresholds: JSON.stringify(rawEval.policyApplied),
        checks: JSON.stringify(rawEval.healthReport.checks),
        decision,
        warnings: JSON.stringify(rawEval.warnings),
        blockingReasons: JSON.stringify(rawEval.blockingReasons),
        evidenceRefs: JSON.stringify(evidenceRefs),
        actor: body.actor || "system",
      },
    });

    return {
      id: persisted.id,
      analysisId: persisted.analysisId,
      policyId: persisted.policyId,
      policyVersion: persisted.policyVersion,
      decision: persisted.decision,
      gatePassed: decision === "passed" || decision === "passed_with_warnings",
      warnings: JSON.parse(persisted.warnings),
      blockingReasons: JSON.parse(persisted.blockingReasons),
      checks: JSON.parse(persisted.checks),
      evaluatedThresholds: JSON.parse(persisted.evaluatedThresholds),
      evidenceRefs: JSON.parse(persisted.evidenceRefs),
      actor: persisted.actor,
      createdAt: persisted.createdAt.toISOString(),
    };
  });

  app.get<{ Params: { id: string } }>("/analyses/:id/guard", async (request, reply) => {
    const { id } = request.params;
    const latest = await prisma.guardEvaluation.findFirst({
      where: { analysisId: id },
      orderBy: { createdAt: "desc" },
    });

    if (!latest) {
      reply.status(404).send({
        error: { code: "NOT_FOUND", message: `No guard evaluation found for analysis "${id}"` },
      });
      return;
    }

    return {
      evaluation: {
        id: latest.id,
        analysisId: latest.analysisId,
        policyId: latest.policyId,
        policyVersion: latest.policyVersion,
        decision: latest.decision,
        gatePassed: latest.decision === "passed" || latest.decision === "passed_with_warnings",
        warnings: JSON.parse(latest.warnings),
        blockingReasons: JSON.parse(latest.blockingReasons),
        checks: JSON.parse(latest.checks),
        evaluatedThresholds: JSON.parse(latest.evaluatedThresholds),
        evidenceRefs: JSON.parse(latest.evidenceRefs),
        actor: latest.actor,
        createdAt: latest.createdAt.toISOString(),
      },
    };
  });

  app.get<{ Params: { id: string } }>("/analyses/:id/guard/history", async (request, reply) => {
    const { id } = request.params;
    const history = await prisma.guardEvaluation.findMany({
      where: { analysisId: id },
      orderBy: { createdAt: "desc" },
    });

    return {
      analysisId: id,
      evaluations: history.map((e) => ({
        id: e.id,
        analysisId: e.analysisId,
        policyId: e.policyId,
        policyVersion: e.policyVersion,
        decision: e.decision,
        gatePassed: e.decision === "passed" || e.decision === "passed_with_warnings",
        warnings: JSON.parse(e.warnings),
        blockingReasons: JSON.parse(e.blockingReasons),
        checks: JSON.parse(e.checks),
        evaluatedThresholds: JSON.parse(e.evaluatedThresholds),
        evidenceRefs: JSON.parse(e.evidenceRefs),
        actor: e.actor,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  });
};
