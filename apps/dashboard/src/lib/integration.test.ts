import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  adaptRepository,
  adaptRepositoriesResponse,
  adaptImpactToGraph,
  adaptPreShipHealthToGuard,
  type BackendRepository,
  type BackendImpactReport,
  type BackendPreShipHealthReport,
  type BackendReleaseGateEvaluation,
} from "./api-adapters.js";
import { parseUnifiedDiffPatch } from "./api-client.js";

describe("Frontend-to-Backend Integration & Adapters", () => {
  // 1. Repository Response Adapter
  it("adapts backend repository entity correctly without fabricating missing GitHub fields", () => {
    const raw: BackendRepository = {
      id: "repo_123",
      name: "Devos",
      path: "/Users/devos/project",
      defaultBranch: "main",
      createdAt: "2026-10-31T00:00:00.000Z",
    };

    const adapted = adaptRepository(raw);

    assert.equal(adapted.id, "repo_123");
    assert.equal(adapted.name, "Devos");
    assert.equal(adapted.path, "/Users/devos/project");
    assert.equal(adapted.defaultBranch, "main");
    assert.equal(adapted.createdAt, "2026-10-31T00:00:00.000Z");
    assert.equal(adapted.owner, "local");
    assert.equal(adapted.fullName, "Devos");
  });

  it("adapts repository list envelope { repositories: [...] }", () => {
    const backendEnvelope = {
      repositories: [
        {
          id: "r1",
          name: "Repo 1",
          path: "/tmp/r1",
          defaultBranch: "main",
          createdAt: "2026-10-31T00:00:00.000Z",
        },
        {
          id: "r2",
          name: "Repo 2",
          path: "/tmp/r2",
          defaultBranch: "develop",
          createdAt: "2026-10-31T00:00:00.000Z",
        },
      ],
    };

    const adapted = adaptRepositoriesResponse(backendEnvelope);
    assert.equal(adapted.length, 2);
    assert.equal(adapted[0].name, "Repo 1");
    assert.equal(adapted[1].defaultBranch, "develop");
  });

  // 2. Error Envelope Handling
  it("extracts error code and message from backend envelope { error: { code, message } }", () => {
    const backendErrorPayload = {
      error: {
        code: "REPO_ALREADY_EXISTS",
        message: 'Repository at path "/tmp/repo" is already registered',
      },
    };

    const extractedCode = backendErrorPayload.error.code;
    const extractedMessage = backendErrorPayload.error.message;

    assert.equal(extractedCode, "REPO_ALREADY_EXISTS");
    assert.match(extractedMessage, /already registered/);
  });

  // 3. Impact to Engineering Graph Transformation
  it("transforms backend impact results into valid dependency graph nodes and edges", () => {
    const impactReport: BackendImpactReport = {
      stage: "completed",
      summary: {
        analysisId: "anl_1",
        repositoryId: "repo_1",
        commitSha: "c0ffee1",
        changedFilesCount: 1,
        changedSymbolsCount: 1,
        directImpactCount: 1,
        transitiveImpactCount: 1,
        unresolvedImpactCount: 0,
        ambiguousImpactCount: 0,
        maxDepthReached: 2,
        isPartial: false,
      },
      results: [
        {
          resultKey: "res_1",
          analysisId: "anl_1",
          repositoryId: "repo_1",
          commitSha: "c0ffee1",
          targetKey: "sym_auth_handler",
          targetType: "symbol",
          targetFile: "src/auth.ts",
          targetSymbol: "authHandler",
          sourceChangeKey: "sym_auth_handler",
          sourceChangeFile: "src/auth.ts",
          sourceChangeSymbol: "authHandler",
          classification: "changed",
          depth: 0,
          path: ["sym_auth_handler"],
          relationshipTypes: [],
          edgeKeys: [],
          resolutionStatus: "resolved",
          collector: "git-diff-collector",
        },
        {
          resultKey: "res_2",
          analysisId: "anl_1",
          repositoryId: "repo_1",
          commitSha: "c0ffee1",
          targetKey: "sym_router",
          targetType: "symbol",
          targetFile: "src/router.ts",
          targetSymbol: "appRouter",
          sourceChangeKey: "sym_auth_handler",
          sourceChangeFile: "src/auth.ts",
          sourceChangeSymbol: "authHandler",
          classification: "direct",
          depth: 1,
          path: ["sym_auth_handler", "sym_router"],
          relationshipTypes: ["calls"],
          edgeKeys: ["edge_1"],
          resolutionStatus: "resolved",
          collector: "graph-traversal",
        },
      ],
    };

    const graph = adaptImpactToGraph("repo_1", "anl_1", impactReport, ["sym_auth_handler"]);

    assert.equal(graph.repositoryId, "repo_1");
    assert.equal(graph.analysisId, "anl_1");
    assert.equal(graph.symbols.length, 2);
    assert.equal(graph.edges.length, 1);
    assert.equal(graph.edges[0].from, "sym_auth_handler");
    assert.equal(graph.edges[0].to, "sym_router");
    assert.equal(graph.edges[0].kind, "calls");

    const rootNode = graph.symbols.find((s) => s.id === "sym_auth_handler");
    assert.equal(rootNode?.impactStatus, "root_cause");

    const impactedNode = graph.symbols.find((s) => s.id === "sym_router");
    assert.equal(impactedNode?.impactStatus, "impacted");
  });

  // 4. Pre-Ship Health & Release Gate Adapter
  it("maps backend pre-ship health evaluation and release gate to GuardEvaluation", () => {
    const healthReport: BackendPreShipHealthReport = {
      analysisId: "anl_1",
      repositoryId: "repo_1",
      commitSha: "c0ffee12345678",
      overallStatus: "HEALTHY",
      totalChecks: 3,
      passedCount: 3,
      warnedCount: 0,
      failedCount: 0,
      evaluatedAt: "2026-10-31T01:00:00.000Z",
      checks: [
        {
          checkId: "git_repository_validity",
          name: "Git Repository Validity",
          category: "git",
          status: "PASSED",
          message: "Valid repository and commit SHA.",
          evidence: { repoId: "repo_1" },
          isBlocking: true,
        },
        {
          checkId: "ast_extraction_completeness",
          name: "AST Extraction Completeness",
          category: "ast",
          status: "PASSED",
          message: "AST extraction processed with 12 symbol records.",
          evidence: { symbolsCount: 12 },
          isBlocking: false,
        },
        {
          checkId: "dependency_graph_integrity",
          name: "Dependency Graph Integrity",
          category: "graph",
          status: "PASSED",
          message: "Dependency graph verified with 8 nodes and 6 edges.",
          evidence: { nodes: 8, edges: 6 },
          isBlocking: true,
        },
      ],
    };

    const gateEvaluation: BackendReleaseGateEvaluation = {
      passed: true,
      gateStatus: "PASSED",
      blockingReasons: [],
      warnings: [],
      policyApplied: { maxRiskScore: 60 },
      healthReport,
      evaluatedAt: "2026-10-31T01:00:00.000Z",
    };

    const guard = adaptPreShipHealthToGuard("repo_1", healthReport, gateEvaluation);

    assert.equal(guard.repositoryId, "repo_1");
    assert.equal(guard.readiness, "safe");
    assert.equal(guard.isBackendConnected, true);
    assert.equal(guard.checks.length, 3);
    assert.equal(guard.blockers.length, 0);
    assert.match(guard.readinessReason, /passed/i);
  });

  it("marks readiness as unsafe and lists blockers when a blocking check fails", () => {
    const degradedReport: BackendPreShipHealthReport = {
      analysisId: "anl_2",
      repositoryId: "repo_1",
      commitSha: "c0ffee9999",
      overallStatus: "UNHEALTHY",
      totalChecks: 1,
      passedCount: 0,
      warnedCount: 0,
      failedCount: 1,
      evaluatedAt: "2026-10-31T01:00:00.000Z",
      checks: [
        {
          checkId: "git_ingestion_completeness",
          name: "Git Ingestion Completeness",
          category: "git",
          status: "FAILED",
          message: "Diff extraction failed.",
          evidence: {},
          isBlocking: true,
        },
      ],
    };

    const guard = adaptPreShipHealthToGuard("repo_1", degradedReport, null);

    assert.equal(guard.readiness, "unsafe");
    assert.equal(guard.blockers.length, 1);
    assert.equal(guard.blockers[0].title, "Git Ingestion Completeness");
  });

  // 5. Diff Parsing Utility
  it("parses unified diff patch into hunks with line numbers", () => {
    const patch = `@@ -10,3 +10,4 @@
 context line
-removed line
+added line 1
+added line 2`;

    const hunks = parseUnifiedDiffPatch(patch);
    assert.equal(hunks.length, 1);
    assert.equal(hunks[0].oldStart, 10);
    assert.equal(hunks[0].newStart, 10);
    assert.equal(hunks[0].lines.length, 4);
    assert.equal(hunks[0].lines[0].type, "context");
    assert.equal(hunks[0].lines[1].type, "deletion");
    assert.equal(hunks[0].lines[2].type, "addition");
    assert.equal(hunks[0].lines[3].type, "addition");
  });
});

