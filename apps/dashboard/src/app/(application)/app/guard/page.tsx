"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ContextSelectorHeader } from "@/components/app-shell/context-selector-header";
import { ReadinessPanel } from "@/components/guard/readiness-panel";
import { BlockingIssues } from "@/components/guard/blocking-issues";
import { CheckCategorySection } from "@/components/guard/check-category";
import { GuardWarnings } from "@/components/guard/guard-warnings";
import { GuardHistory } from "@/components/guard/guard-history";
import {
  usePreShipHealth,
  useReleaseGateStatus,
  useEvaluateReleaseGate,
  useCreateAnalysis,
} from "@/hooks/use-devos-api";
import { useAuth } from "@/hooks/use-auth";
import {
  FIXTURE_GUARD_EVALUATION,
  FIXTURE_GUARD_HISTORY,
} from "@/lib/fixture-data";
import { adaptPreShipHealthToGuard } from "@/lib/api-adapters";
import type {
  GuardEvaluation,
} from "@/types/guard";
import {
  AlertCircle,
  ShieldCheck,
  Play,
  Terminal,
} from "lucide-react";

function GuardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDemo } = useAuth();
  const repoParam = searchParams.get("repo") || "siddarth1709-Devos";
  const prParam = searchParams.get("pr") || "2";
  const analysisIdParam = searchParams.get("analysisId") || searchParams.get("jobId") || "";
  const initialFixture = (searchParams.get("fixture") === "1" || isDemo) && !analysisIdParam;

  const [useFixtureMode, setUseFixtureMode] = useState<boolean>(initialFixture);
  const isEffectiveFixture = (isDemo || useFixtureMode) && !analysisIdParam;

  // Fetch real live backend pre-ship health report & gate evaluation
  const {
    data: healthReport,
    isError: healthError,
    error: healthErrorObj,
    refetch: refetchHealth,
  } = usePreShipHealth(analysisIdParam || undefined);

  const { data: gateEvaluation } = useReleaseGateStatus(analysisIdParam || undefined);
  const evaluateGateMutation = useEvaluateReleaseGate(analysisIdParam || undefined);
  const createAnalysisMutation = useCreateAnalysis();

  const handleRunAnalysis = async () => {
    try {
      const job = await createAnalysisMutation.mutateAsync({
        repositoryId: repoParam,
        baseSha: "HEAD~1",
        headSha: "HEAD",
      });
      const jobId = job.id || (job as { id?: string; jobId?: string }).jobId || "";
      router.push(`/app/guard?repo=${encodeURIComponent(repoParam)}&analysisId=${encodeURIComponent(jobId)}`);
    } catch (err: unknown) {
      console.error("Failed to run analysis:", err);
    }
  };

  const handleEvaluateGate = async () => {
    if (!analysisIdParam) return;
    try {
      await evaluateGateMutation.mutateAsync();
    } catch (err) {
      console.error("Failed to evaluate release gate:", err);
    }
  };

  // Determine active Guard Evaluation
  const evaluation: GuardEvaluation = useMemo(() => {
    if (isEffectiveFixture) {
      return FIXTURE_GUARD_EVALUATION;
    }
    return adaptPreShipHealthToGuard(repoParam, healthReport || null, gateEvaluation || null);
  }, [repoParam, healthReport, gateEvaluation, isEffectiveFixture]);

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      {/* 1. Repository & Context Navigation Header */}
      <ContextSelectorHeader
        currentRepoId={repoParam}
        currentPrId={prParam}
      />

      {/* 2. No Active Analysis Prompt */}
      {!analysisIdParam && !isEffectiveFixture && (
        <div className="p-5 bg-[#101211] border border-[#292E2A] rounded-[6px] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-[4px] bg-[#151816] border border-[#292E2A] flex items-center justify-center text-[#C7F36B] shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h3 className="font-display font-semibold text-[15px] text-[#F0F2ED]">
                Pre-Ship Guard Policy Evaluation
              </h3>
              <p className="font-body text-[12px] text-[#A0A79F] mt-0.5">
                Run an analysis or select an active analysis job to evaluate 8 deterministic pre-ship health checks and release gate policies.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleRunAnalysis}
              disabled={createAnalysisMutation.isPending}
              className="inline-flex items-center gap-2 px-4 h-[38px] bg-[#C7F36B] text-[#090A0A] font-mono text-[11px] font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#D7FF86] transition-all shadow-sm disabled:opacity-50"
            >
              <Play size={13} />
              <span>{createAnalysisMutation.isPending ? "Executing Analysis..." : "Run Analysis (HEAD~1 → HEAD)"}</span>
            </button>
            <button
              type="button"
              onClick={() => setUseFixtureMode(true)}
              className="px-3.5 h-[38px] border border-[#292E2A] hover:bg-[#151816] text-[#A0A79F] hover:text-[#F0F2ED] font-mono text-[11px] rounded-[4px] transition-colors"
            >
              Preview Fixture
            </button>
          </div>
        </div>
      )}

      {/* 3. Error Banner */}
      {healthError && !useFixtureMode && (
        <div className="p-4 bg-[#151816] border border-[#E9B96E]/40 rounded-[6px] flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-[11px]">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-[#E9B96E] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#F0F2ED] uppercase tracking-wider block">
                Health Check Extraction Notice
              </span>
              <p className="text-[#A0A79F] text-[12px] font-body mt-0.5">
                {healthErrorObj?.message || "Failed to load pre-ship health evaluation from backend."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => refetchHealth()}
            className="px-3 py-1.5 border border-[#292E2A] hover:bg-[#1D221F] text-[#F0F2ED] rounded-[3px] transition-colors shrink-0"
          >
            Retry Live API
          </button>
        </div>
      )}

      {/* 4. Fixture Mode Notice */}
      {useFixtureMode && !healthReport && (
        <div className="px-3.5 py-2 bg-[#181D19] border border-[#3A4338] rounded-[4px] flex items-center justify-between font-mono text-[11px] text-[#A0A79F]">
          <div className="flex items-center gap-2">
            <Terminal size={13} className="text-[#C7F36B]" />
            <span>
              Previewing canonical development fixture from <code className="text-[#C7F36B]">docs/api-contract.md</code>.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setUseFixtureMode(false)}
            className="text-[#E9B96E] hover:underline"
          >
            Switch to live backend
          </button>
        </div>
      )}

      {/* 5. Readiness Panel */}
      <ReadinessPanel
        readiness={evaluation.readiness}
        reason={evaluation.readinessReason}
        lastEvaluatedAt={evaluation.lastEvaluatedAt}
        blockerCount={evaluation.blockers.length}
        warningCount={evaluation.warnings.length}
        totalChecks={evaluation.checks.length}
        passedChecks={evaluation.checks.filter((c) => c.status === "passed").length}
      />

      {/* 6. Release Gate Action Banner (when real analysis is loaded) */}
      {analysisIdParam && !useFixtureMode && (
        <div className="p-4 bg-[#101211] border border-[#292E2A] rounded-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck size={18} className="text-[#C7F36B]" />
            <div>
              <h4 className="font-display font-semibold text-[14px] text-[#F0F2ED]">
                Release Gate Decision Engine
              </h4>
              <p className="font-body text-[12px] text-[#A0A79F]">
                Evaluate release policies against codified risk thresholds and check outcomes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEvaluateGate}
            disabled={evaluateGateMutation.isPending}
            className="px-4 h-[36px] bg-[#C7F36B] hover:bg-[#D7FF86] text-[#090A0A] font-mono text-[11px] font-semibold uppercase tracking-wider rounded-[4px] transition-all disabled:opacity-50 shrink-0"
          >
            {evaluateGateMutation.isPending ? "Evaluating Gate..." : "Evaluate Release Gate"}
          </button>
        </div>
      )}

      {/* 7. Critical Blockers & Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <BlockingIssues
          blockers={evaluation.blockers}
          repositoryId={repoParam}
          pullRequestId={prParam}
          checksCompleted={evaluation.checks.length > 0}
        />
        <GuardWarnings
          warnings={evaluation.warnings}
          outstandingChecks={evaluation.outstandingChecks}
          repositoryId={repoParam}
          pullRequestId={prParam}
        />
      </div>

      {/* 8. Categorized Health Checks */}
      <CheckCategorySection
        checks={evaluation.checks}
        repositoryId={repoParam}
        pullRequestId={prParam}
      />

      {/* 9. Historical Runs (Audit Trail) */}
      <GuardHistory
        history={FIXTURE_GUARD_HISTORY}
        isBackendConnected={evaluation.isBackendConnected}
        isFixturePreview={useFixtureMode}
      />
    </div>
  );
}

export default function PreShipGuardPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1440px] mx-auto p-8 text-center font-mono text-[12px] text-[#A0A79F]">
          Loading Pre-Ship Guard...
        </div>
      }
    >
      <GuardPageContent />
    </Suspense>
  );
}
