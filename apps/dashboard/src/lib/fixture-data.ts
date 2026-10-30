import type {
  DependencyGraphData,
  AnalysisReport,
  Evidence,
  Recommendation,
} from "@/types/api";
import type { GuardEvaluation, GuardHistoricalRun } from "@/types/guard";
import type { ActionDefinition, ActionRecord } from "@/types/actions";

/**
 * Canonical development fixtures directly aligned with Builder 2 specifications
 * in docs/api-contract.md and apps/api/prisma/schema.prisma.
 */
export const FIXTURE_DEPENDENCY_GRAPH: DependencyGraphData = {
  repositoryId: "siddarth1709-Devos",
  analysisId: "job_anl_982347102",
  changedSymbols: ["verifyToken", "buildAuthHeader"],
  impactedSymbols: ["extractBearerToken", "tokenCache", "validateTokenFormat"],
  symbols: [
    {
      id: "sym_verifyToken",
      name: "verifyToken",
      kind: "function",
      file: "apps/api/src/auth/jwt.ts",
      lineStart: 45,
      lineEnd: 72,
      changeStatus: "modified",
      impactStatus: "root_cause",
      collector: "typescript-ast",
    },
    {
      id: "sym_buildAuthHeader",
      name: "buildAuthHeader",
      kind: "function",
      file: "apps/api/src/auth/headers.ts",
      lineStart: 18,
      lineEnd: 36,
      changeStatus: "modified",
      impactStatus: "root_cause",
      collector: "typescript-ast",
    },
    {
      id: "sym_authMiddleware",
      name: "authMiddleware",
      kind: "function",
      file: "apps/api/src/middleware/auth.ts",
      lineStart: 12,
      lineEnd: 48,
      changeStatus: "unchanged",
      impactStatus: "none",
      collector: "typescript-ast",
    },
    {
      id: "sym_extractBearerToken",
      name: "extractBearerToken",
      kind: "function",
      file: "apps/api/src/auth/jwt.ts",
      lineStart: 88,
      lineEnd: 110,
      changeStatus: "unchanged",
      impactStatus: "impacted",
      collector: "typescript-ast",
    },
    {
      id: "sym_validateTokenFormat",
      name: "validateTokenFormat",
      kind: "function",
      file: "apps/api/src/auth/validators.ts",
      lineStart: 30,
      lineEnd: 55,
      changeStatus: "unchanged",
      impactStatus: "impacted",
      collector: "typescript-ast",
    },
    {
      id: "sym_tokenCache",
      name: "tokenCache",
      kind: "variable",
      file: "apps/api/src/cache/tokenCache.ts",
      lineStart: 12,
      lineEnd: 40,
      changeStatus: "unchanged",
      impactStatus: "impacted",
      collector: "typescript-ast",
    },
    {
      id: "sym_handleAuthError",
      name: "handleAuthError",
      kind: "function",
      file: "apps/api/src/errorHandler.ts",
      lineStart: 15,
      lineEnd: 42,
      changeStatus: "unchanged",
      impactStatus: "none",
      collector: "typescript-ast",
    },
    {
      id: "sym_repositoryRepo",
      name: "RepositoryRepo",
      kind: "class",
      file: "apps/api/src/repo/repositoryRepo.ts",
      lineStart: 10,
      lineEnd: 65,
      changeStatus: "unchanged",
      impactStatus: "none",
      collector: "typescript-ast",
    },
  ],
  edges: [
    {
      id: "edge_01",
      from: "sym_authMiddleware",
      to: "sym_verifyToken",
      kind: "calls",
      sourceFile: "apps/api/src/middleware/auth.ts",
      sourceLine: 24,
    },
    {
      id: "edge_02",
      from: "sym_authMiddleware",
      to: "sym_buildAuthHeader",
      kind: "calls",
      sourceFile: "apps/api/src/middleware/auth.ts",
      sourceLine: 30,
    },
    {
      id: "edge_03",
      from: "sym_verifyToken",
      to: "sym_extractBearerToken",
      kind: "calls",
      sourceFile: "apps/api/src/auth/jwt.ts",
      sourceLine: 50,
    },
    {
      id: "edge_04",
      from: "sym_extractBearerToken",
      to: "sym_validateTokenFormat",
      kind: "calls",
      sourceFile: "apps/api/src/auth/jwt.ts",
      sourceLine: 95,
    },
    {
      id: "edge_05",
      from: "sym_verifyToken",
      to: "sym_tokenCache",
      kind: "references",
      sourceFile: "apps/api/src/auth/jwt.ts",
      sourceLine: 62,
    },
    {
      id: "edge_06",
      from: "sym_authMiddleware",
      to: "sym_handleAuthError",
      kind: "calls",
      sourceFile: "apps/api/src/middleware/auth.ts",
      sourceLine: 42,
    },
    {
      id: "edge_07",
      from: "sym_authMiddleware",
      to: "sym_repositoryRepo",
      kind: "references",
      sourceFile: "apps/api/src/middleware/auth.ts",
      sourceLine: 18,
    },
  ],
};

export const FIXTURE_EVIDENCES: Evidence[] = [
  {
    id: "ev_diff_01",
    type: "diff",
    sourceCommit: "2b73459e2a74",
    file: "apps/api/src/auth/jwt.ts",
    lineStart: 45,
    lineEnd: 58,
    symbol: "verifyToken",
    collector: "git-diff-collector",
    collectedAt: "2026-10-31T01:05:10.000Z",
    payload: `@@ -45,6 +45,13 @@ export function verifyToken(token: string) {
-  const raw = token.slice(7);
+  const parts = token.split('.');
+  if (parts.length !== 3) {
+    throw new Error('Malformed JWT structure');
+  }
+  const raw = parts[1];`,
  },
  {
    id: "ev_ast_02",
    type: "dependency",
    sourceCommit: "2b73459e2a74",
    file: "apps/api/src/auth/headers.ts",
    lineStart: 18,
    lineEnd: 36,
    symbol: "buildAuthHeader",
    collector: "ast-symbol-tracer",
    collectedAt: "2026-10-31T01:05:15.000Z",
    payload: `Symbol AST Reference:
- Function: buildAuthHeader(scheme: string, credentials: string)
- Inbound Callers: authMiddleware [apps/api/src/middleware/auth.ts:30]
- Direct downstream callee: verifyToken`,
  },
  {
    id: "ev_test_03",
    type: "test",
    sourceCommit: "2b73459e2a74",
    file: "apps/api/src/app.test.ts",
    lineStart: 88,
    lineEnd: 112,
    symbol: "authMiddleware",
    collector: "vitest-runner",
    collectedAt: "2026-10-31T01:05:22.000Z",
    payload: `Test Suite: Auth Middleware Integration
✓ allows authorized bearer token (42ms)
✗ rejects token missing period separators (expected 401, received 500)
AssertionError: expected status code 401 but got 500 Unhandled Exception`,
  },
];

export const FIXTURE_ANALYSIS_REPORT: AnalysisReport = {
  jobId: "job_anl_982347102",
  summary:
    "AST diff analysis and Gemma reasoning identified 1 high-severity validation defect and 1 medium architectural risk in the authentication pipeline.",
  findings: [
    {
      id: "f_sec_01",
      title: "Unvalidated authorization bearer token format",
      severity: "high",
      description:
        "Bearer token structure is parsed without prior separator bounds checking in verifyToken, causing uncaught exceptions when malformed headers are passed.",
      evidenceIds: ["ev_diff_01", "ev_ast_02"],
      origin: "deterministic",
      status: "confirmed",
      confidence: "High",
      file: "apps/api/src/auth/jwt.ts",
      line: 45,
      symbol: "verifyToken",
      rationale:
        "Deterministic AST collector verified missing array bounds guard in verifyToken before subsegment index access.",
      architecturalImpact:
        "Unauthenticated clients can induce 500 Internal Server Error crashes instead of standard 401 Unauthorized rejections.",
      remediation: `// Recommended patch in apps/api/src/auth/jwt.ts
export function verifyToken(token: string): TokenPayload {
  if (!token || typeof token !== "string") {
    throw new InvalidTokenError("Token string is required");
  }
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new InvalidTokenError("JWT must contain exactly 3 dot-separated segments");
  }
  return decodePayload(parts[1]);
}`,
      relatedSymbolIds: ["sym_verifyToken", "sym_extractBearerToken"],
    },
    {
      id: "f_perf_02",
      title: "Unbounded cache growth in downstream tokenCache",
      severity: "medium",
      description:
        "Downstream tokenCache references the modified verifyToken output without eviction TTL policy, presenting memory exhaustion risk under high token churn.",
      evidenceIds: ["ev_ast_02", "ev_test_03"],
      origin: "gemma",
      status: "hypothesis",
      confidence: "Medium",
      file: "apps/api/src/cache/tokenCache.ts",
      line: 12,
      symbol: "tokenCache",
      rationale:
        "Gemma LLM observed absence of LRU eviction limit in tokenCache class constructor during downstream symbol traversal.",
      architecturalImpact:
        "Long-lived API instances subject to automated load testing may experience linear memory growth.",
      remediation: `// Recommended patch in apps/api/src/cache/tokenCache.ts
import { LRUCache } from 'lru-cache';

export const tokenCache = new LRUCache<string, TokenPayload>({
  max: 10_000,
  ttl: 1000 * 60 * 15, // 15 minutes TTL
});`,
      relatedSymbolIds: ["sym_tokenCache"],
    },
    {
      id: "f_info_03",
      title: "Missing structured error logging on auth failure",
      severity: "info",
      description:
        "handleAuthError logs raw error strings rather than structured JSON log payloads containing requestId and actor metadata.",
      evidenceIds: ["ev_ast_02"],
      origin: "deterministic",
      status: "confirmed",
      confidence: "High",
      file: "apps/api/src/errorHandler.ts",
      line: 15,
      symbol: "handleAuthError",
      rationale: "Static analysis verified console.error call without metadata wrapper.",
      remediation: `// Recommended patch
fastify.log.warn({ err, requestId: req.id }, "Authentication rejection");`,
      relatedSymbolIds: ["sym_handleAuthError"],
    },
  ],
  changedSymbols: ["verifyToken", "buildAuthHeader"],
  impact:
    "Authentication bypass and uncaught 500 error risk if malformed Authorization headers are transmitted by client requests.",
  readiness: "conditional",
  confidence: "High",
  limitations: [
    "No production traffic distribution logs available for bearer token header format.",
  ],
  missingEvidence: [
    "End-to-end integration test coverage for malformed bearer tokens without dots.",
  ],
  trustMeter: 92,
  claimsVerified: 4,
  claimsRejected: 0,
};

export const FIXTURE_RECOMMENDATIONS: Recommendation[] = [
  {
    id: "rec_01",
    title: "Apply 3-segment JWT format guard in verifyToken",
    description: "Guard against malformed token index crashes before parsing payload.",
    findingIds: ["f_sec_01"],
    priority: "high",
    suggestedAction: "apply_patch",
    rationale: "Resolves 500 unhandled exceptions identified by Vitest runner.",
  },
  {
    id: "rec_02",
    title: "Configure 15-minute TTL eviction on tokenCache",
    description: "Prevent unbounded memory growth in downstream token cache.",
    findingIds: ["f_perf_02"],
    priority: "medium",
    suggestedAction: "apply_patch",
    rationale: "Enforces safe operational memory ceiling under traffic spikes.",
  },
];

// ============================================================================
// Pre-ship Guard Development Specification Fixtures
// Strictly isolated for developer inspection of docs/api-contract.md schemas
// ============================================================================

export const FIXTURE_GUARD_EVALUATION: GuardEvaluation = {
  repositoryId: "siddarth1709-Devos",
  pullRequestId: "2",
  revision: "2b73459e2a74",
  readiness: "conditional",
  readinessReason:
    "1 blocking validation issue and 1 outstanding regression warning must be addressed before deployment. Automated test failure detected on malformed bearer headers.",
  lastEvaluatedAt: "2026-10-31T01:05:42.000Z",
  isBackendConnected: true,
  blockers: [
    {
      id: "blk_01",
      severity: "high",
      title: "Unvalidated authorization bearer token format",
      explanation:
        "Bearer token structure parsed without separator count verification triggers uncaught 500 crashes instead of 401 unauthorized.",
      filePath: "apps/api/src/auth/jwt.ts",
      line: 45,
      evidenceIds: ["ev_diff_01", "ev_ast_02"],
      findingId: "f_sec_01",
      symbolId: "sym_verifyToken",
    },
  ],
  warnings: [
    {
      id: "wrn_01",
      title: "Unbounded cache growth in downstream tokenCache",
      explanation:
        "Downstream tokenCache references modified verifyToken output without eviction TTL policy.",
      impact: "Linear memory growth under continuous traffic bursts.",
      suggestedNextStep:
        "Introduce LRU cache cap of 10,000 entries and 15-minute TTL.",
      evidenceIds: ["ev_ast_02", "ev_test_03"],
      findingId: "f_perf_02",
    },
  ],
  outstandingChecks: [
    "Production traffic telemetry distribution for bearer token format",
    "End-to-end integration test coverage for tokens without dot separators",
  ],
  checks: [
    {
      id: "chk_ci_01",
      category: "change_integrity",
      name: "AST Symbol Consistency",
      status: "passed",
      description: "All exported symbols resolve unambiguously in the compiler AST.",
      evidenceSource: "typescript-ast",
      lastExecutedAt: "2026-10-31T01:05:00.000Z",
    },
    {
      id: "chk_ci_02",
      category: "change_integrity",
      name: "Blast Radius Boundedness",
      status: "warning",
      description:
        "Downstream ripple effect extends to 3 dependent symbols across 2 modules.",
      evidenceSource: "dependency-graph-tracer",
      lastExecutedAt: "2026-10-31T01:05:05.000Z",
    },
    {
      id: "chk_cq_01",
      category: "code_quality",
      name: "TypeScript Strict Compile",
      status: "passed",
      description: "0 typecheck errors with strict mode enabled.",
      evidenceSource: "tsc",
      lastExecutedAt: "2026-10-31T01:05:10.000Z",
    },
    {
      id: "chk_cq_02",
      category: "code_quality",
      name: "Input Bounds Validation",
      status: "failed",
      description: "verifyToken lacks array length guard before index access.",
      evidenceSource: "ast-symbol-tracer",
      lastExecutedAt: "2026-10-31T01:05:12.000Z",
      findingId: "f_sec_01",
      filePath: "apps/api/src/auth/jwt.ts",
      line: 45,
    },
    {
      id: "chk_th_01",
      category: "test_health",
      name: "Auth Middleware Integration Suite",
      status: "failed",
      description: "1 test failed: rejects token missing period separators.",
      evidenceSource: "vitest-runner",
      lastExecutedAt: "2026-10-31T01:05:22.000Z",
      findingId: "f_sec_01",
    },
    {
      id: "chk_th_02",
      category: "test_health",
      name: "Regression Test Coverage",
      status: "warning",
      description: "Line coverage on jwt.ts is 78% (below 85% recommended threshold).",
      evidenceSource: "vitest-coverage",
      lastExecutedAt: "2026-10-31T01:05:25.000Z",
    },
    {
      id: "chk_dh_01",
      category: "dependency_health",
      name: "Known Vulnerability Audit",
      status: "passed",
      description: "0 critical or high CVEs identified in installed packages.",
      evidenceSource: "pnpm-audit",
      lastExecutedAt: "2026-10-31T01:05:30.000Z",
    },
    {
      id: "chk_dh_02",
      category: "dependency_health",
      name: "Dependency Version Compatibility",
      status: "passed",
      description: "All workspace packages adhere to defined semver ranges.",
      evidenceSource: "semver-checker",
      lastExecutedAt: "2026-10-31T01:05:32.000Z",
    },
    {
      id: "chk_rc_01",
      category: "runtime_configuration",
      name: "Environment Variable Schema",
      status: "passed",
      description: "All required runtime keys declared in .env.example with Zod validators.",
      evidenceSource: "zod-config-validator",
      lastExecutedAt: "2026-10-31T01:05:35.000Z",
    },
    {
      id: "chk_rc_02",
      category: "runtime_configuration",
      name: "Production Telemetry Baseline",
      status: "unavailable",
      description:
        "Telemetry ingestion pipeline disconnected. Production error baselines unavailable.",
      evidenceSource: "unscoped",
      lastExecutedAt: null,
    },
    {
      id: "chk_ri_01",
      category: "review_integrity",
      name: "Grounded Evidence Validation",
      status: "passed",
      description: "4 of 4 review findings reference validated AST diff artifacts.",
      evidenceSource: "evidence-reconciler",
      lastExecutedAt: "2026-10-31T01:05:40.000Z",
    },
    {
      id: "chk_ri_02",
      category: "review_integrity",
      name: "Unresolved Review Blockers",
      status: "failed",
      description: "1 High-severity finding (f_sec_01) requires confirmation or patch.",
      evidenceSource: "gemma-review-evaluator",
      lastExecutedAt: "2026-10-31T01:05:42.000Z",
      findingId: "f_sec_01",
    },
  ],
};

export const FIXTURE_GUARD_HISTORY: GuardHistoricalRun[] = [
  {
    runId: "run_grd_908123",
    timestamp: "2026-10-31T01:05:42.000Z",
    readiness: "conditional",
    blockerCount: 1,
    warningCount: 1,
    revision: "2b73459e",
  },
  {
    runId: "run_grd_908001",
    timestamp: "2026-10-30T19:22:15.000Z",
    readiness: "unsafe",
    blockerCount: 3,
    warningCount: 2,
    revision: "1b0fc002",
  },
];

// ============================================================================
// Secure Actions Catalogue Specification
// ============================================================================

export const ACTION_CATALOGUE: ActionDefinition[] = [
  {
    id: "act_lint",
    type: "run_lint",
    name: "Run ESLint Checks",
    description: "Executes configured workspace ESLint rules against changed files.",
    category: "code_quality",
    requiredPermissions: ["read:repo"],
    requiresApproval: false,
    modifiesState: false,
    isReversible: true,
    defaultParams: { scope: "changed_files" },
    potentialImpact: "Read-only static verification; zero filesystem mutations.",
  },
  {
    id: "act_typecheck",
    type: "run_typecheck",
    name: "Run TypeScript Compile Verification",
    description: "Validates AST types and compiler constraints with tsc --noEmit.",
    category: "code_quality",
    requiredPermissions: ["read:repo"],
    requiresApproval: false,
    modifiesState: false,
    isReversible: true,
    defaultParams: { noEmit: true },
    potentialImpact: "Read-only type checker pass; zero filesystem mutations.",
  },
  {
    id: "act_test",
    type: "run_tests",
    name: "Execute Unit & Integration Tests",
    description: "Runs targeted Vitest test suites across affected modules.",
    category: "code_quality",
    requiredPermissions: ["read:repo", "execute:tests"],
    requiresApproval: true,
    modifiesState: false,
    isReversible: true,
    defaultParams: { filter: "auth" },
    potentialImpact:
      "Spawns ephemeral test runner processes; consumes CPU resources.",
  },
  {
    id: "act_rel_notes",
    type: "generate_release_notes",
    name: "Generate Release Notes",
    description:
      "Synthesizes change summaries and impact radius into structured changelog format.",
    category: "change_management",
    requiredPermissions: ["read:diff", "read:metadata"],
    requiresApproval: false,
    modifiesState: false,
    isReversible: true,
    defaultParams: { format: "markdown" },
    potentialImpact: "Generates report text draft without committing.",
  },
  {
    id: "act_commit_msg",
    type: "prepare_commit_message",
    name: "Prepare Conventional Commit Message",
    description: "Drafts conventional commit message based on AST diff symbols.",
    category: "change_management",
    requiredPermissions: ["read:diff"],
    requiresApproval: false,
    modifiesState: false,
    isReversible: true,
    defaultParams: { convention: "angular" },
    potentialImpact: "Proposes message string; does not commit.",
  },
  {
    id: "act_pr_summary",
    type: "prepare_pr_summary",
    name: "Draft Pull Request Description",
    description: "Constructs evidence-backed PR overview with blast radius analysis.",
    category: "change_management",
    requiredPermissions: ["read:diff", "read:prs"],
    requiresApproval: false,
    modifiesState: false,
    isReversible: true,
    defaultParams: { includeEvidence: true },
    potentialImpact: "Generates draft markdown body for developer review.",
  },
  {
    id: "act_dep_inspect",
    type: "inspect_dependency_changes",
    name: "Inspect Dependency Manifest Changes",
    description: "Audits package.json and pnpm-lock.yaml for version drift and licenses.",
    category: "repository_maintenance",
    requiredPermissions: ["read:dependencies"],
    requiresApproval: false,
    modifiesState: false,
    isReversible: true,
    defaultParams: { verifyLicenses: true },
    potentialImpact: "Read-only manifest inspection; zero lockfile mutations.",
  },
  {
    id: "act_dep_report",
    type: "generate_dependency_report",
    name: "Generate Dependency Audit Report",
    description:
      "Compiles detailed SBOM artifact and security advisory ledger to disk.",
    category: "repository_maintenance",
    requiredPermissions: ["read:dependencies", "write:report"],
    requiresApproval: true,
    modifiesState: true,
    isReversible: true,
    defaultParams: { outputPath: "docs/dependency-audit.md" },
    potentialImpact:
      "Writes audit artifact file to local repository filesystem at specified path.",
  },
];

export const FIXTURE_ACTION_HISTORY: ActionRecord[] = [
  {
    id: "act_rec_01",
    definitionId: "act_test",
    name: "Execute Unit & Integration Tests",
    type: "run_tests",
    target: "apps/api",
    category: "code_quality",
    params: { filter: "auth" },
    status: "failed",
    requestedBy: "developer",
    requestedAt: "2026-10-31T01:15:00.000Z",
    approvedAt: "2026-10-31T01:15:01.000Z",
    executedAt: "2026-10-31T01:15:05.000Z",
    durationMs: 4120,
    output: {
      testsTotal: 6,
      testsPassed: 5,
      testsFailed: 1,
      failureMessage: "AssertionError: expected status 401 but got 500",
    },
    error: "Test suite failed: rejects token missing period separators",
  },
  {
    id: "act_rec_02",
    definitionId: "act_lint",
    name: "Run ESLint Checks",
    type: "run_lint",
    target: "apps/dashboard",
    category: "code_quality",
    params: { scope: "changed_files" },
    status: "completed",
    requestedBy: "developer",
    requestedAt: "2026-10-31T01:10:00.000Z",
    approvedAt: null,
    executedAt: "2026-10-31T01:10:04.000Z",
    durationMs: 3800,
    output: { problems: 0, errors: 0, warnings: 0 },
    error: null,
  },
];


