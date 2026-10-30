"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ContextSelectorHeader } from "@/components/app-shell/context-selector-header";
import { EngineeringGraph } from "@/components/graph/engineering-graph";
import { useDependencyGraph, useAnalysisReport } from "@/hooks/use-devos-api";
import { useAuth } from "@/hooks/use-auth";
import {
  FIXTURE_DEPENDENCY_GRAPH,
  FIXTURE_ANALYSIS_REPORT,
} from "@/lib/fixture-data";
import { AlertCircle, Sparkles, Terminal } from "lucide-react";

function GraphPageContent() {
  const searchParams = useSearchParams();

  const repoParam = searchParams.get("repo") || "siddarth1709-Devos";
  const prParam = searchParams.get("pr") || "2";
  const focusNodeParam = searchParams.get("focusNode") || null;
  const { isDemo } = useAuth();
  const initialUseFixture = searchParams.get("fixture") === "1" || isDemo;

  const [useFixtureMode, setUseFixtureMode] = useState<boolean>(initialUseFixture);
  const isEffectiveFixture = isDemo || useFixtureMode;

  // Live backend queries
  const {
    data: liveGraphData,
    isLoading: graphLoading,
    isError: graphError,
    error: graphErrorObj,
    refetch: refetchGraph,
  } = useDependencyGraph(repoParam, prParam);

  const { data: liveReport } = useAnalysisReport("job_anl_982347102");

  // Determine active dataset: live data if present, otherwise fixture if in demo or user enabled preview mode
  const activeGraphData = useMemo(() => {
    if (liveGraphData && liveGraphData.symbols.length > 0) return liveGraphData;
    if (isEffectiveFixture) return FIXTURE_DEPENDENCY_GRAPH;
    return null;
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

      {/* 2. Backend Contract Status Banner when live backend is offline */}
      {graphError && !useFixtureMode && (
        <div className="p-4 bg-[#151816] border border-[#E9B96E]/40 rounded-[6px] flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-[11px]">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-[#E9B96E] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#F0F2ED] uppercase tracking-wider block">
                Backend Contract Status: Endpoint Awaiting Builder 2 Engine
              </span>
              <p className="text-[#A0A79F] text-[12px] font-body mt-0.5">
                {graphErrorObj?.message ||
                  "GET /api/repositories/:repoId/graph is scheduled in docs/api-contract.md."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => refetchGraph()}
              className="px-3 py-1.5 border border-[#292E2A] hover:bg-[#1D221F] text-[#F0F2ED] rounded-[3px] transition-colors"
            >
              Retry Live API
            </button>
            <button
              type="button"
              onClick={() => setUseFixtureMode(true)}
              className="px-3.5 py-1.5 bg-[#C7F36B] hover:bg-[#D7FF86] text-[#090A0A] font-semibold uppercase tracking-wider rounded-[3px] flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Sparkles size={12} />
              <span>Preview Contract Fixture</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Fixture Mode Notice */}
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

      {/* 4. Interactive Engineering Graph */}
      <EngineeringGraph
        graphData={activeGraphData}
        isLoading={graphLoading && !useFixtureMode}
        isError={graphError && !useFixtureMode}
        error={graphErrorObj}
        onRetry={() => refetchGraph()}
        initialFocusedNodeId={focusNodeParam}
        relatedFindings={activeFindings}
        repositoryId={repoParam}
        pullRequestId={prParam}
      />
    </div>
  );
}

export default function DependencyGraphPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1440px] mx-auto p-12 text-center font-mono text-[12px] text-[#6E776F]">
          Loading Dependency Graph...
        </div>
      }
    >
      <GraphPageContent />
    </Suspense>
  );
}
