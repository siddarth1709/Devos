import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

describe("Analysis Sub-resources and Repository Endpoints", () => {
  let app: FastifyInstance;
  let testRepoId: string;
  let testAnalysisId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    const repo = await prisma.repository.create({
      data: {
        name: `subres-test-repo-${Date.now()}`,
        path: `/tmp/subres-test-repo-${Date.now()}`,
        defaultBranch: "main",
      },
    });
    testRepoId = repo.id;

    const analysis = await prisma.analysis.create({
      data: {
        repositoryId: repo.id,
        baseSha: "9".repeat(40),
        headSha: "0".repeat(40),
        status: "completed",
      },
    });
    testAnalysisId = analysis.id;

    await prisma.changedFile.create({
      data: {
        analysisId: analysis.id,
        path: "src/parser.ts",
        changeType: "added",
        baseSha: "9".repeat(40),
        headSha: "0".repeat(40),
        collector: "git-diff",
      },
    });

    await prisma.symbol.create({
      data: {
        repositoryId: repo.id,
        analysisId: analysis.id,
        symbolKey: "sym:parser:parseDoc",
        name: "parseDoc",
        kind: "function",
        file: "src/parser.ts",
        lineStart: 10,
        lineEnd: 25,
        commitSha: "0".repeat(40),
        collector: "ast-extractor",
      },
    });

    await prisma.dependencyNode.create({
      data: {
        analysisId: analysis.id,
        repositoryId: repo.id,
        nodeKey: "node:parser",
        nodeType: "file",
        name: "parser.ts",
        path: "src/parser.ts",
        commitSha: "0".repeat(40),
        collector: "dep-graph",
      },
    });

    await prisma.dependencyEdge.create({
      data: {
        analysisId: analysis.id,
        repositoryId: repo.id,
        edgeKey: "edge:parser->ast",
        from: "node:parser",
        to: "node:ast",
        kind: "import",
        sourceFile: "src/parser.ts",
        sourceLine: 1,
        commitSha: "0".repeat(40),
        collector: "dep-graph",
      },
    });

    await prisma.evidence.create({
      data: {
        analysisId: analysis.id,
        type: "source",
        sourceCommit: "0".repeat(40),
        file: "src/parser.ts",
        collector: "ast-extractor",
        payload: JSON.stringify({ parsed: true }),
      },
    });

    await prisma.finding.create({
      data: {
        analysisId: analysis.id,
        title: "Experimental parser added",
        severity: "info",
        description: "New parser added for documents",
        origin: "deterministic",
        status: "confirmed",
        confidence: "High",
        baseSha: "9".repeat(40),
        headSha: "0".repeat(40),
        collector: "ast-analyzer",
      },
    });

    await prisma.riskAssessment.create({
      data: {
        analysisId: analysis.id,
        repositoryId: repo.id,
        commitSha: "0".repeat(40),
        score: 15,
        level: "LOW",
        severity: 1,
        likelihood: 1,
        confidence: 90,
        factors: JSON.stringify([]),
        highestRiskTargets: JSON.stringify([]),
        limitations: JSON.stringify([]),
        missingEvidence: JSON.stringify([]),
      },
    });
  });

  afterAll(async () => {
    await prisma.repository.deleteMany({
      where: { id: testRepoId },
    });
    await app.close();
    await prisma.$disconnect();
  });

  it("GET /api/analyses/:id/files returns changed files", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/analyses/${testAnalysisId}/files`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.analysisId).toBe(testAnalysisId);
    expect(body.files).toHaveLength(1);
    expect(body.files[0].path).toBe("src/parser.ts");
  });

  it("GET /api/analyses/:id/symbols returns AST symbols", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/analyses/${testAnalysisId}/symbols`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.analysisId).toBe(testAnalysisId);
    expect(body.symbols).toHaveLength(1);
    expect(body.symbols[0].name).toBe("parseDoc");
  });

  it("GET /api/analyses/:id/graph returns nodes and edges", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/analyses/${testAnalysisId}/graph`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.analysisId).toBe(testAnalysisId);
    expect(body.nodes).toHaveLength(1);
    expect(body.edges).toHaveLength(1);
    expect(body.edges[0].kind).toBe("import");
  });

  it("GET /api/analyses/:id/evidence returns evidence records", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/analyses/${testAnalysisId}/evidence`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.analysisId).toBe(testAnalysisId);
    expect(body.evidence).toHaveLength(1);
    expect(body.evidence[0].file).toBe("src/parser.ts");
  });

  it("GET /api/analyses/:id/findings returns findings records", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/analyses/${testAnalysisId}/findings`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.analysisId).toBe(testAnalysisId);
    expect(body.findings).toHaveLength(1);
    expect(body.findings[0].title).toBe("Experimental parser added");
  });

  it("GET /api/analyses/:id/report returns comprehensive report and stats", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/analyses/${testAnalysisId}/report`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.analysisId).toBe(testAnalysisId);
    expect(body.readinessState).toBe("safe");
    expect(body.riskScore).toBe(15);
    expect(body.stats.filesChanged).toBe(1);
    expect(body.stats.symbolsExtracted).toBe(1);
    expect(body.stats.nodesCount).toBe(1);
    expect(body.stats.edgesCount).toBe(1);
  });

  it("GET /api/repositories/:id/analyses lists analyses for the repository", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/repositories/${testRepoId}/analyses`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.analyses).toHaveLength(1);
    expect(body.analyses[0].id).toBe(testAnalysisId);
  });

  it("GET /api/repositories/:id/branches returns branch list", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/repositories/${testRepoId}/branches`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.defaultBranch).toBe("main");
    expect(body.branches).toBeInstanceOf(Array);
  });

  it("GET /api/repositories/:id/health returns repository health", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/repositories/${testRepoId}/health`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("healthy");
    expect(body.totalAnalyses).toBe(1);
    expect(body.latestAnalysis.id).toBe(testAnalysisId);
  });
});
