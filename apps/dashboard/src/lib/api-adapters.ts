import type {
  Repository,
  DependencyGraphData,
  SymbolEntity,
  DependencyEdgeEntity,
} from "@/types/api";
import type {
  GuardEvaluation,
  GuardCheck,
  GuardBlocker,
  GuardWarning,
  CheckStatus,
  GuardCategoryKey,
} from "@/types/guard";

// ============================================================================
// 1. Repository Adapter
// ============================================================================

export interface BackendRepository {
  id: string;
  name: string;
  path: string;
  defaultBranch: string;
  createdAt: string;
}

export interface GetRepositoriesBackendResponse {
  repositories: BackendRepository[];
}

export function adaptRepository(raw: BackendRepository): Repository {
  return {
    id: raw.id,
    name: raw.name,
    path: raw.path,
    defaultBranch: raw.defaultBranch || "main",
    createdAt: raw.createdAt,
    owner: "local",
    fullName: raw.name,
    visibility: "internal",
  };
}

export function adaptRepositoriesResponse(raw: unknown): Repository[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((r) => adaptRepository(r as BackendRepository));
  }
  if (typeof raw === "object" && "repositories" in (raw as Record<string, unknown>)) {
    const repos = (raw as { repositories: BackendRepository[] }).repositories;
    if (Array.isArray(repos)) {
      return repos.map(adaptRepository);
    }
  }
  return [];
}

// ============================================================================
// 2. Engineering Graph Adapter (from real Impact & Analysis reports)
// ============================================================================

export interface BackendImpactResultItem {
  id?: string;
  resultKey: string;
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  targetKey: string;
  targetType: "file" | "symbol" | "module";
  targetFile: string | null;
  targetSymbol: string | null;
  sourceChangeKey: string;
  sourceChangeFile: string;
  sourceChangeSymbol: string | null;
  classification: "changed" | "direct" | "transitive" | "unresolved" | "ambiguous";
  depth: number;
  path: string[];
  relationshipTypes: string[];
  edgeKeys: string[];
  resolutionStatus: "resolved" | "unresolved" | "ambiguous" | "external";
  collector: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
}

export interface BackendImpactSummary {
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  changedFilesCount: number;
  changedSymbolsCount: number;
  directImpactCount: number;
  transitiveImpactCount: number;
  unresolvedImpactCount: number;
  ambiguousImpactCount: number;
  maxDepthReached: number;
  isPartial: boolean;
  limitations?: string[];
}

export interface BackendImpactReport {
  summary: BackendImpactSummary;
  results: BackendImpactResultItem[];
  stage: string;
  error?: string | null;
  limitations?: string[];
}

export function adaptImpactToGraph(
  repositoryId: string,
  analysisId: string,
  impactReport: BackendImpactReport | null,
  changedSymbols: string[] = []
): DependencyGraphData {
  if (!impactReport || !impactReport.results || impactReport.results.length === 0) {
    return {
      repositoryId,
      analysisId,
      symbols: [],
      edges: [],
      changedSymbols,
      impactedSymbols: [],
    };
  }

  const symbolMap = new Map<string, SymbolEntity>();
  const edgeList: DependencyEdgeEntity[] = [];
  const impactedKeys = new Set<string>();
  const changedKeys = new Set<string>(changedSymbols);

  // 1. Process each impact result node
  for (const item of impactReport.results) {
    const isRoot = item.classification === "changed" || item.depth === 0;
    const isImpacted = !isRoot && item.classification !== "unresolved";

    if (isImpacted) {
      impactedKeys.add(item.targetKey);
    }
    if (isRoot) {
      changedKeys.add(item.targetKey);
    }

    // Register Target Node
    if (!symbolMap.has(item.targetKey)) {
      const displayName =
        item.targetSymbol ||
        (item.targetFile ? item.targetFile.split("/").pop() || item.targetFile : item.targetKey);

      symbolMap.set(item.targetKey, {
        id: item.targetKey,
        name: displayName,
        kind: item.targetType === "file" ? "file" : "function",
        file: item.targetFile || "repository-source",
        lineStart: 1,
        lineEnd: 1,
        commitSha: item.commitSha,
        collector: item.collector,
        changeStatus: isRoot ? "modified" : "unchanged",
        impactStatus: isRoot ? "root_cause" : isImpacted ? "impacted" : "none",
      });
    }

    // Register Source Change Node if different
    if (item.sourceChangeKey && !symbolMap.has(item.sourceChangeKey)) {
      const sourceName =
        item.sourceChangeSymbol ||
        (item.sourceChangeFile ? item.sourceChangeFile.split("/").pop() || item.sourceChangeFile : item.sourceChangeKey);

      symbolMap.set(item.sourceChangeKey, {
        id: item.sourceChangeKey,
        name: sourceName,
        kind: "function",
        file: item.sourceChangeFile,
        lineStart: 1,
        lineEnd: 1,
        commitSha: item.commitSha,
        collector: item.collector,
        changeStatus: "modified",
        impactStatus: "root_cause",
      });
      changedKeys.add(item.sourceChangeKey);
    }

    // Register Dependency Edges
    if (item.sourceChangeKey && item.targetKey && item.sourceChangeKey !== item.targetKey) {
      const edgeKind = (item.relationshipTypes?.[0] as DependencyEdgeEntity["kind"]) || "calls";
      const edgeId = `edge_${item.sourceChangeKey}_to_${item.targetKey}`;

      if (!edgeList.some((e) => e.id === edgeId)) {
        edgeList.push({
          id: edgeId,
          from: item.sourceChangeKey,
          to: item.targetKey,
          kind: ["imports", "calls", "references", "extends", "implements", "mutates"].includes(edgeKind)
            ? edgeKind
            : "references",
          sourceFile: item.sourceChangeFile || "source",
          sourceLine: 1,
          commitSha: item.commitSha,
          collector: item.collector,
        });
      }
    }
  }

  return {
    repositoryId,
    analysisId,
    symbols: Array.from(symbolMap.values()),
    edges: edgeList,
    changedSymbols: Array.from(changedKeys),
    impactedSymbols: Array.from(impactedKeys),
  };
}

// ============================================================================
// 3. Pre-Ship Health & Release Gate Adapter
// ============================================================================

export interface BackendHealthCheckResult {
  checkId: string;
  name: string;
  category: "git" | "ast" | "graph" | "impact" | "risk" | "provenance" | "quality" | "environment";
  status: "PASSED" | "FAILED" | "WARNED";
  message: string;
  evidence: Record<string, unknown>;
  isBlocking: boolean;
}

export interface BackendPreShipHealthReport {
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  overallStatus: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  totalChecks: number;
  passedCount: number;
  warnedCount: number;
  failedCount: number;
  checks: BackendHealthCheckResult[];
  evaluatedAt: string;
}

export interface BackendReleaseGateEvaluation {
  passed: boolean;
  gateStatus: "PASSED" | "FAILED" | "WARNED";
  blockingReasons: string[];
  warnings: string[];
  policyApplied: Record<string, unknown>;
  healthReport: BackendPreShipHealthReport;
  evaluatedAt: string;
}

const CATEGORY_MAP: Record<BackendHealthCheckResult["category"], GuardCategoryKey> = {
  git: "change_integrity",
  ast: "code_quality",
  graph: "dependency_health",
  impact: "dependency_health",
  risk: "code_quality",
  provenance: "review_integrity",
  quality: "code_quality",
  environment: "runtime_configuration",
};

export function adaptPreShipHealthToGuard(
  repositoryId: string,
  healthReport: BackendPreShipHealthReport | null,
  gateEvaluation: BackendReleaseGateEvaluation | null = null
): GuardEvaluation {
  if (!healthReport) {
    return {
      repositoryId,
      readiness: "unknown",
      readinessReason: "No automated verification checks executed yet.",
      lastEvaluatedAt: null,
      checks: [],
      blockers: [],
      warnings: [],
      outstandingChecks: ["Run DEVOS Analysis pipeline to evaluate pre-ship readiness."],
      isBackendConnected: false,
    };
  }

  const checks: GuardCheck[] = healthReport.checks.map((chk) => {
    const status: CheckStatus =
      chk.status === "PASSED"
        ? "passed"
        : chk.status === "WARNED"
        ? "warning"
        : "failed";

    return {
      id: chk.checkId,
      category: CATEGORY_MAP[chk.category] || "code_quality",
      name: chk.name,
      status,
      description: chk.message,
      evidenceSource: `${chk.category.toUpperCase()} Evaluator`,
      lastExecutedAt: healthReport.evaluatedAt,
      details: Object.keys(chk.evidence || {}).length > 0 ? JSON.stringify(chk.evidence) : undefined,
    };
  });

  const blockers: GuardBlocker[] = healthReport.checks
    .filter((c) => c.status === "FAILED")
    .map((c) => ({
      id: `blk_${c.checkId}`,
      severity: c.isBlocking ? "critical" : "high",
      title: c.name,
      explanation: c.message,
      evidenceIds: [],
    }));

  const warnings: GuardWarning[] = healthReport.checks
    .filter((c) => c.status === "WARNED")
    .map((c) => ({
      id: `wrn_${c.checkId}`,
      title: c.name,
      explanation: c.message,
      impact: "Identified during pre-ship health evaluation.",
      suggestedNextStep: "Review warning conditions and evaluate release impact.",
      evidenceIds: [],
    }));

  let readiness: "safe" | "conditional" | "unsafe" | "unknown" = "unknown";
  if (healthReport.overallStatus === "HEALTHY") {
    readiness = "safe";
  } else if (healthReport.overallStatus === "DEGRADED") {
    readiness = "conditional";
  } else if (healthReport.overallStatus === "UNHEALTHY") {
    readiness = "unsafe";
  }

  const readinessReason =
    gateEvaluation && !gateEvaluation.passed
      ? `Release gate failed: ${gateEvaluation.blockingReasons.join("; ")}`
      : healthReport.overallStatus === "HEALTHY"
      ? "All automated pre-ship health checks passed. Deterministic clearance granted."
      : healthReport.overallStatus === "DEGRADED"
      ? `Pre-ship health degraded with ${healthReport.warnedCount} warning(s).`
      : `Pre-ship health failed with ${healthReport.failedCount} blocking issue(s).`;

  return {
    repositoryId,
    revision: healthReport.commitSha,
    readiness,
    readinessReason,
    lastEvaluatedAt: healthReport.evaluatedAt,
    checks,
    blockers,
    warnings,
    outstandingChecks: [],
    isBackendConnected: true,
  };
}
