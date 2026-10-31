import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

describe("Findings and Decision API Routes", () => {
  let app: FastifyInstance;
  let testRepoId: string;
  let testAnalysisId: string;
  let testFindingId: string;
  let testEvidenceId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    const repo = await prisma.repository.create({
      data: {
        name: `findings-test-repo-${Date.now()}`,
        path: `/tmp/findings-test-repo-${Date.now()}`,
        defaultBranch: "main",
      },
    });
    testRepoId = repo.id;

    const analysis = await prisma.analysis.create({
      data: {
        repositoryId: repo.id,
        baseSha: "1".repeat(40),
        headSha: "2".repeat(40),
        status: "completed",
      },
    });
    testAnalysisId = analysis.id;

    const evidence = await prisma.evidence.create({
      data: {
        analysisId: analysis.id,
        type: "diff",
        sourceCommit: "2".repeat(40),
        file: "src/utils.ts",
        collector: "git-diff",
        payload: JSON.stringify({ diff: "+ const x = 1;" }),
      },
    });
    testEvidenceId = evidence.id;

    const finding = await prisma.finding.create({
      data: {
        analysisId: analysis.id,
        title: "Unchecked boundary condition in buffer parsing",
        severity: "high",
        description: "Buffer slice can exceed length under malformed payload",
        origin: "deterministic",
        status: "hypothesis",
        confidence: "High",
        baseSha: "1".repeat(40),
        headSha: "2".repeat(40),
        collector: "ast-analyzer",
        evidences: {
          create: [{ evidenceId: evidence.id }],
        },
      },
    });
    testFindingId = finding.id;
  });

  afterAll(async () => {
    await prisma.repository.deleteMany({
      where: { id: testRepoId },
    });
    await app.close();
    await prisma.$disconnect();
  });

  it("GET /api/findings/:id returns finding with metadata and evidenceIds", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/findings/${testFindingId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.finding.id).toBe(testFindingId);
    expect(body.finding.title).toBe("Unchecked boundary condition in buffer parsing");
    expect(body.finding.severity).toBe("high");
    expect(body.finding.evidenceIds).toContain(testEvidenceId);
  });

  it("GET /api/findings/:id/evidence retrieves associated evidence payload", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/findings/${testFindingId}/evidence`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.findingId).toBe(testFindingId);
    expect(body.evidence).toHaveLength(1);
    expect(body.evidence[0].id).toBe(testEvidenceId);
    expect(body.evidence[0].file).toBe("src/utils.ts");
  });

  it("POST /api/findings/:id/decision updates finding status, actor, and rationale", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/findings/${testFindingId}/decision`,
      payload: {
        decision: "confirmed",
        actor: "lead-security-reviewer",
        rationale: "Verified with reproduced boundary fuzz test; vulnerability is genuine",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.finding.status).toBe("confirmed");
    expect(body.finding.decision).toBe("confirmed");
    expect(body.finding.decisionActor).toBe("lead-security-reviewer");
    expect(body.finding.decisionRationale).toContain("Verified with reproduced boundary fuzz test");
    expect(body.finding.decisionAt).toBeDefined();

    const inDb = await prisma.finding.findUnique({ where: { id: testFindingId } });
    expect(inDb?.status).toBe("confirmed");
    expect(inDb?.decisionActor).toBe("lead-security-reviewer");
  });

  it("returns 404 for nonexistent finding ID", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/findings/nonexistent-finding-id",
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });
});
