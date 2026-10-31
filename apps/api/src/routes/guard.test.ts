import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

describe("Pre-ship Guard API Routes & Persisted History", () => {
  let app: FastifyInstance;
  let testRepoId: string;
  let completedAnalysisId: string;
  let runningAnalysisId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    const repo = await prisma.repository.create({
      data: {
        name: `guard-test-repo-${Date.now()}`,
        path: `/tmp/guard-test-repo-${Date.now()}`,
        defaultBranch: "main",
      },
    });
    testRepoId = repo.id;

    const completedAnalysis = await prisma.analysis.create({
      data: {
        repositoryId: repo.id,
        baseSha: "3".repeat(40),
        headSha: "4".repeat(40),
        status: "completed",
      },
    });
    completedAnalysisId = completedAnalysis.id;

    await prisma.changedFile.create({
      data: {
        analysisId: completedAnalysis.id,
        path: "src/calc.test.ts",
        changeType: "modified",
        baseSha: "3".repeat(40),
        headSha: "4".repeat(40),
        collector: "git-diff",
      },
    });

    await prisma.riskAssessment.create({
      data: {
        analysisId: completedAnalysis.id,
        repositoryId: repo.id,
        commitSha: "4".repeat(40),
        score: 25,
        level: "LOW",
        severity: 1,
        likelihood: 1,
        confidence: 85,
        factors: JSON.stringify([]),
        highestRiskTargets: JSON.stringify([]),
        limitations: JSON.stringify([]),
        missingEvidence: JSON.stringify([]),
      },
    });

    const runningAnalysis = await prisma.analysis.create({
      data: {
        repositoryId: repo.id,
        baseSha: "5".repeat(40),
        headSha: "6".repeat(40),
        status: "running",
      },
    });
    runningAnalysisId = runningAnalysis.id;
  });

  afterAll(async () => {
    await prisma.repository.deleteMany({
      where: { id: testRepoId },
    });
    await app.close();
    await prisma.$disconnect();
  });

  it("GET /api/guard/health returns service health and registered checks", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/guard/health",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("healthy");
    expect(body.registeredChecks).toBeInstanceOf(Array);
    expect(body.registeredChecks.length).toBeGreaterThanOrEqual(5);
  });

  it("GET /api/guard/policies returns default or registered policies", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/guard/policies",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.policies).toBeInstanceOf(Array);
    expect(body.policies.length).toBeGreaterThanOrEqual(1);
  });

  it("PUT /api/guard/policies/:id creates or updates policy", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/guard/policies/strict-policy",
      payload: {
        name: "Strict Enterprise Policy",
        description: "Requires risk score <= 30 and minimum confidence 80",
        rules: {
          maxRiskScore: 30,
          minConfidence: 80,
          blockOnAnyFailedCheck: true,
          allowedRiskLevels: ["LOW"],
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe("strict-policy");
    expect(body.rules.maxRiskScore).toBe(30);
  });

  it("POST /api/analyses/:id/guard evaluates release gate and persists evaluation", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/analyses/${completedAnalysisId}/guard`,
      payload: {
        actor: "ci-pipeline",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.analysisId).toBe(completedAnalysisId);
    expect(body.decision).toBe("passed");
    expect(body.gatePassed).toBe(true);
    expect(body.checks).toBeInstanceOf(Array);
    expect(body.actor).toBe("ci-pipeline");
  });

  it("POST /api/analyses/:id/guard returns unable_to_evaluate for running analysis", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/analyses/${runningAnalysisId}/guard`,
      payload: { actor: "ci-pipeline" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.decision).toBe("unable_to_evaluate");
    expect(body.gatePassed).toBe(false);
  });

  it("GET /api/analyses/:id/guard returns latest evaluation", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/analyses/${completedAnalysisId}/guard`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.evaluation.analysisId).toBe(completedAnalysisId);
    expect(body.evaluation.decision).toBe("passed");
  });

  it("GET /api/analyses/:id/guard/history returns evaluation history without overwriting previous runs", async () => {
    await app.inject({
      method: "POST",
      url: `/api/analyses/${completedAnalysisId}/guard`,
      payload: { actor: "second-evaluation-run" },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/analyses/${completedAnalysisId}/guard/history`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.analysisId).toBe(completedAnalysisId);
    expect(body.evaluations.length).toBeGreaterThanOrEqual(2);
  });
});
