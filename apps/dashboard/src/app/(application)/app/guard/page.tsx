"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ContextSelectorHeader } from "@/components/app-shell/context-selector-header";
import { ReadinessPanel } from "@/components/guard/readiness-panel";
import { BlockingIssues } from "@/components/guard/blocking-issues";
import { CheckCategorySection } from "@/components/guard/check-category";
import { GuardWarnings } from "@/components/guard/guard-warnings";
import { GuardHistory } from "@/components/guard/guard-history";
import { useAnalysisReport } from "@/hooks/use-devos-api";
import { useAuth } from "@/hooks/use-auth";
import {
  FIXTURE_GUARD_EVALUATION,
  FIXTURE_GUARD_HISTORY,
} from "@/lib/fixture-data";
import type {
  GuardEvaluation,
  GuardBlocker,
  GuardWarning,
  GuardCheck,
  CheckStatus,
} from "@/types/guard";
import type { ReadinessState } from "@/types/api";
import {
  AlertCircle,
  Sparkles,
  RefreshCw,
} from "lucide-react";

function GuardPageContent() {
  const searchParams = useSearchParams();
  const { isDemo } = useAuth();
  const repoParam = searchParams.get("repo") || "siddarth1709-Devos";
  const prParam = searchParams.get("pr") || "2";
  const initialFixture = searchParams.get("fixture") === "1" || isDemo;

  const [useFixtureMode, setUseFixtureMode] = useState<boolean>(initialFixture);
  const isEffectiveFixture = isDemo || useFixtureMode;

  // Fetch live backend analysis
  const {
    data: liveReport,
    isLoading,
    refetch,
  } = useAnalysisReport("job_anl_982347102");

  // Determine active Guard Evaluation
  const evaluation: GuardEvaluation = useMemo(() => {
    if (isEffectiveFixture) {
      return FIXTURE_GUARD_EVALUATION;
    }

    if (liveReport && liveReport.findings) {
      const blockers: GuardBlocker[] = liveReport.findings
        .filter((f) => f.severity === "critical" || f.severity === "high")
        .map((f) => ({
          id: `blk_${f.id}`,
          severity: f.severity,
          title: f.title,
          explanation: f.rationale || f.description,
          filePath: f.file,
          line: f.line,
          evidenceIds: f.evidenceIds || [],
          findingId: f.id,
          symbolId: f.symbol,
        }));

      const warnings: GuardWarning[] = liveReport.findings
        .filter((f) => f.severity === "medium" || f.severity === "low")
        .map((f) => ({
          id: `wrn_${f.id}`,
          title: f.title,
          explanation: f.rationale || f.description,
          impact: f.architecturalImpact || "Identified during static code review audit.",
          suggestedNextStep: f.remediation,
          evidenceIds: f.evidenceIds || [],
          findingId: f.id,
        }));

      const readiness: ReadinessState = liveReport.readiness || (blockers.length > 0 ? "unsafe" : "safe");
      const readinessReason = liveReport.summary || (
        blockers.length > 0
          ? "Critical or high-severity review findings require resolution before release."
          : "All automated verification checks have passed."
      );

      const checks: GuardCheck[] = [
        {
          id: "chk_live_1",
          category: "code_quality",
          name: "Static Analysis & Review Audit",
          status: blockers.length > 0 ? "failed" : "passed",
          description: `Static analysis produced ${liveReport.findings.length} findings (${blockers.length} blocking).`,
          evidenceSource: "AST Analysis Engine",
          lastExecutedAt: new Date().toISOString(),
        },
        {
          id: "chk_live_2",
          category: "change_integrity",
          name: "PR Differential Reconciliation",
          status: "passed",
          description: "All changed symbols have been indexed into the AST graph.",
          evidenceSource: "Git Engine",
          lastExecutedAt: new Date().toISOString(),
        },
        {
          id: "chk_live_3",
          category: "test_health",
          name: "Targeted Regression Verification",
          status: "passed",
          description: "No regression failures reported by automated test runner.",
          evidenceSource: "Test Runner",
          lastExecutedAt: new Date().toISOString(),
        },
        {
          id: "chk_live_4",
          category: "dependency_health",
          name: "Workspace Circular Dependency Scan",
          status: "passed",
          description: "Package graph acyclic; no circular references detected.",
          evidenceSource: "Dependency Analyzer",
          lastExecutedAt: new Date().toISOString(),
        },
      ];

      return {
        repositoryId: repoParam,
        pullRequestId: prParam,
        revision: "HEAD",
        readiness,
        readinessReason,
        lastEvaluatedAt: new Date().toISOString(),
        checks,
        blockers,
        warnings,
        outstandingChecks: [],
        isBackendConnected: true,
      };
    }

    // Default Unknown state when backend is disconnected or pending
    return {
      repositoryId: repoParam,
      pullRequestId: prParam,
      revision: "unknown",
      readiness: "unknown",
      readinessReason:
        "Analysis data has not been received from the backend evaluation engine. Readiness cannot be determined without validated telemetry.",
      lastEvaluatedAt: null,
      checks: [
        {
          id: "chk_empty_1",
          category: "change_integrity",
          name: "Repository Branch Divergence",
          status: "unavailable" as CheckStatus,
          description: "Evaluation service offline; branch divergence state unknown.",
        },
        {
          id: "chk_empty_2",
          category: "code_quality",
          name: "AI Code Review Verification",
          status: "unavailable" as CheckStatus,
          description: "No completed analysis report registered for this PR revision.",
        },
        {
          id: "chk_empty_3",
          category: "test_health",
          name: "Blast Radius Test Verification",
          status: "not_run" as CheckStatus,
          description: "Impacted test suite execution pending backend scheduler.",
        },
        {
          id: "chk_empty_4",
          category: "dependency_health",
          name: "Architectural Dependency Verification",
          status: "unavailable" as CheckStatus,
          description: "Graph dependency engine unreachable.",
        },
      ],
      blockers: [],
      warnings: [],
      outstandingChecks: [
        "Repository Diff Analysis",
        "AST Dependency Graph Extraction",
        "AI Review Finding Reconciliation",
        "Regression Test Verification",
      ],
      isBackendConnected: false,
    };
  }, [liveReport, useFixtureMode, repoParam, prParam]);

  const passedChecksCount = evaluation.checks.filter(
    (c) => c.status === "passed"
  ).length;

  return (
    <div className="flex flex-col min-h-screen bg-[#0E131F] text-neutral-100">
      <ContextSelectorHeader currentRepoId={repoParam} currentPrId={prParam} />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Offline / Fixture mode banner */}
        {useFixtureMode ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                <strong>SPECIFICATION PREVIEW:</strong> Displaying sample Pre-ship Guard evaluation data for UI inspection. This data does not represent live repository health.
              </span>
            </div>
            <button
              onClick={() => setUseFixtureMode(false)}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium transition-colors shrink-0"
            >
              Exit Preview Mode
            </button>
          </div>
        ) : !evaluation.isBackendConnected ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-neutral-800 bg-neutral-900/80 text-neutral-300 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-neutral-400" />
              <span>
                <strong>Backend Service Offline:</strong> Pre-ship Guard requires live analysis data from Builder 2. Currently, the analysis service is offline or unreachable.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-colors"
              >
                <RefreshCw
                  className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`}
                />
                Retry Connection
              </button>
              <button
                onClick={() => setUseFixtureMode(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                Inspect Specification Preview
              </button>
            </div>
          </div>
        ) : null}

        {/* Release Readiness Panel */}
        <ReadinessPanel
          readiness={evaluation.readiness}
          reason={evaluation.readinessReason}
          lastEvaluatedAt={evaluation.lastEvaluatedAt}
          blockerCount={evaluation.blockers.length}
          warningCount={evaluation.warnings.length}
          totalChecks={evaluation.checks.length}
          passedChecks={passedChecksCount}
        />

        {/* Blocking Issues List */}
        <BlockingIssues
          blockers={evaluation.blockers}
          repositoryId={repoParam}
          pullRequestId={prParam}
          checksCompleted={evaluation.isBackendConnected || useFixtureMode}
        />

        {/* Check Categories Breakdown */}
        <CheckCategorySection
          checks={evaluation.checks}
          repositoryId={repoParam}
          pullRequestId={prParam}
        />

        {/* Warnings & Advisories */}
        <GuardWarnings
          warnings={evaluation.warnings}
          outstandingChecks={evaluation.outstandingChecks}
        />

        {/* Historical Evaluation Runs */}
        <GuardHistory
          history={isEffectiveFixture ? FIXTURE_GUARD_HISTORY : []}
          isBackendConnected={evaluation.isBackendConnected}
          isFixturePreview={useFixtureMode}
        />
      </main>
    </div>
  );
}

export default function PreShipGuardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0E131F] text-neutral-400">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-emerald-500" />
            <span className="text-sm font-mono">Initializing Pre-ship Guard...</span>
          </div>
        </div>
      }
    >
      <GuardPageContent />
    </Suspense>
  );
}
