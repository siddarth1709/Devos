"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ContextSelectorHeader } from "@/components/app-shell/context-selector-header";
import { EngineeringGraph } from "@/components/graph/engineering-graph";
import {
  useDependencyGraph,
  useAnalysisStatus,
  useCreateAnalysis,
} from "@/hooks/use-devos-api";
import { useAuth } from "@/hooks/use-auth";
import {
  FIXTURE_DEPENDENCY_GRAPH,
  FIXTURE_ANALYSIS_REPORT,
} from "@/lib/fixture-data";
import { AlertCircle, Terminal, Play, Network } from "lucide-react";

function GraphPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const repoParam = searchParams.get("repo") || "siddarth1709-Devos";
  const prParam = searchParams.get("pr") || "2";
  const analysisIdParam = searchParams.get("analysisId") || searchParams.get("jobId") || "";
  const focusNodeParam = searchParams.get("focusNode") || null;
  const { isDemo } = useAuth();
  const initialUseFixture = (searchParams.get("fixture") === "1" || isDemo) && !analysisIdParam;

  const [useFixtureMode, setUseFixtureMode] = useState<boolean>(initialUseFixture);
  const isEffectiveFixture = (isDemo || useFixtureMode) && !analysisIdParam;

  // Live backend queries
  const {
    data: liveGraphData,
    isLoading: graphLoading,
    isError: graphError,
    error: graphErrorObj,
    refetch: refetchGraph,
  } = useDependencyGraph(repoParam, analysisIdParam || undefined);

  const { data: analysisStatus } = useAnalysisStatus(analysisIdParam || undefined);
  const liveReport = analysisStatus?.report;

  const createAnalysisMutation = useCreateAnalysis();

  const handleRunAnalysis = async () => {
    try {
      const job = await createAnalysisMutation.mutateAsync({
        repositoryId: repoParam,
        baseSha: "HEAD~1",
        headSha: "HEAD",
      });
      const jobId = job.id || (job as { id?: string; jobId?: string }).jobId || "";
      router.push(`/app/graph?repo=${encodeURIComponent(repoParam)}&analysisId=${encodeURIComponent(jobId)}`);
    } catch (err: unknown) {
      console.error("Failed to run analysis:", err);
    }
  };

  // Determine active dataset: live data if present, otherwise fixture if in demo or explicitly requested
  const activeGraphData = useMemo(() => {
    if (liveGraphData && liveGraphData.symbols.length > 0) return liveGraphData;
    if (isEffectiveFixture) return FIXTURE_DEPENDENCY_GRAPH;
    return liveGraphData || null;
  }, [liveGraphData, isEffectiveFixture]);

  const activeFindings = useMemo(() => {
    if (liveReport?.findings && liveReport.findings.length > 0) {
      return liveReport.findings;
    }
    if (isEffectiveFixture) return FIXTURE_ANALYSIS_REPORT.findings;
    return [];
  }, [liveReport, isEffectiveFixture]);

  return (
    <div className="max-w-[1440px] mx-auto space-y-4">
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
              <Network size={16} />
            </div>
            <div>
              <h3 className="font-display font-semibold text-[15px] text-[#F0F2ED]">
                Real-Time Impact & Dependency Graph
              </h3>
              <p className="font-body text-[12px] text-[#A0A79F] mt-0.5">
                Execute a DEVOS analysis to extract commit-aware AST symbols, compute transitive blast radius, and view verified dependency edges.
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
      {graphError && !useFixtureMode && (
        <div className="p-4 bg-[#151816] border border-[#E9B96E]/40 rounded-[6px] flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-[11px]">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-[#E9B96E] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#F0F2ED] uppercase tracking-wider block">
                Analysis Impact Extraction Notice
              </span>
              <p className="text-[#A0A79F] text-[12px] font-body mt-0.5">
                {graphErrorObj?.message || "Failed to load impact report for the active analysis."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => refetchGraph()}
            className="px-3 py-1.5 border border-[#292E2A] hover:bg-[#1D221F] text-[#F0F2ED] rounded-[3px] transition-colors shrink-0"
          >
            Retry Live API
          </button>
        </div>
      )}

      {/* 4. Fixture Mode Notice */}
      {useFixtureMode && !liveGraphData && (
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

      {/* 5. Interactive Engineering Graph */}
      <EngineeringGraph
        graphData={activeGraphData}
        isLoading={graphLoading && !useFixtureMode}
        isError={graphError && !useFixtureMode}
        error={graphErrorObj}
        onRetry={refetchGraph}
        initialFocusedNodeId={focusNodeParam}
        relatedFindings={activeFindings}
        repositoryId={repoParam}
        pullRequestId={prParam}
      />
    </div>
  );
}

export default function EngineeringGraphPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1440px] mx-auto p-8 text-center font-mono text-[12px] text-[#A0A79F]">
          Loading Engineering Graph...
        </div>
      }
    >
      <GraphPageContent />
    </Suspense>
  );
}
