import type {
  DependencyGraphData,
  AnalysisReport,
  Evidence,
  Recommendation,
} from "@/types/api";

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

