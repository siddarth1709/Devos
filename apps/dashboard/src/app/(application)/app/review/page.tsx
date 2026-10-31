"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ContextSelectorHeader } from "@/components/app-shell/context-selector-header";
import { ReviewOverview } from "@/components/review/review-overview";
import { FindingFilters } from "@/components/review/finding-filters";
import { FindingsList } from "@/components/review/findings-list";
import { FindingDetailPanel } from "@/components/review/finding-detail-panel";
import {
  useAnalysisStatus,
  useChangeReview,
  useCreateAnalysis,
} from "@/hooks/use-devos-api";
import { useAuth } from "@/hooks/use-auth";
import {
  FIXTURE_ANALYSIS_REPORT,
  FIXTURE_EVIDENCES,
} from "@/lib/fixture-data";
import { AlertCircle, Terminal, FileSearch, Play } from "lucide-react";

function ReviewPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const repoParam = searchParams.get("repo") || "siddarth1709-Devos";
  const prParam = searchParams.get("pr") || "2";
  const analysisIdParam = searchParams.get("analysisId") || searchParams.get("jobId") || "";
  const initialFindingId = searchParams.get("findingId") || null;
  const { isDemo } = useAuth();
  const initialUseFixture = (searchParams.get("fixture") === "1" || isDemo) && !analysisIdParam;

  const [useFixtureMode, setUseFixtureMode] = useState<boolean>(initialUseFixture);
  const isEffectiveFixture = (isDemo || useFixtureMode) && !analysisIdParam;
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    initialFindingId
  );

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [originFilter, setOriginFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"severity" | "confidence" | "file">(
    "severity"
  );

  // Live backend analysis queries
  const {
    data: analysisData,
    isLoading: analysisLoading,
    isError: analysisError,
    error: analysisErrorObj,
    refetch: refetchAnalysis,
  } = useAnalysisStatus(analysisIdParam || undefined);

  const { data: _changeReview } = useChangeReview(analysisIdParam || undefined);
  const liveReport = analysisData?.report;

  const createAnalysisMutation = useCreateAnalysis();

  const handleRunAnalysis = async () => {
    try {
      const job = await createAnalysisMutation.mutateAsync({
        repositoryId: repoParam,
        baseSha: "HEAD~1",
        headSha: "HEAD",
      });
      const jobId = job.id || (job as { id?: string; jobId?: string }).jobId || "";
      router.push(`/app/review?repo=${encodeURIComponent(repoParam)}&analysisId=${encodeURIComponent(jobId)}`);
    } catch (err: unknown) {
      console.error("Failed to run analysis:", err);
    }
  };

  // Active report dataset
  const activeReport = useMemo(() => {
    if (liveReport && liveReport.findings && liveReport.findings.length > 0) return liveReport;
    if (isEffectiveFixture) return FIXTURE_ANALYSIS_REPORT;
    return liveReport || null;
  }, [liveReport, isEffectiveFixture]);

  // Filtered & sorted findings
  const filteredFindings = useMemo(() => {
    if (!activeReport) return [];

    return activeReport.findings
      .filter((f) => {
        // Text search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = f.title.toLowerCase().includes(q);
          const matchDesc = f.description.toLowerCase().includes(q);
          const matchFile = (f.file || "").toLowerCase().includes(q);
          const matchSymbol = (f.symbol || "").toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchFile && !matchSymbol) return false;
        }

        // Severity filter
        if (severityFilter !== "all" && f.severity !== severityFilter) {
          return false;
        }

        // Origin filter
        if (originFilter !== "all" && f.origin !== originFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "severity") {
          const severityWeight: Record<string, number> = {
            critical: 5,
            high: 4,
            medium: 3,
            low: 2,
            info: 1,
          };
          return (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
        }
        if (sortBy === "confidence") {
          const confidenceWeight: Record<string, number> = {
            "Very High": 4,
            High: 3,
            Medium: 2,
            Low: 1,
          };
          return (
            (confidenceWeight[b.confidence] || 0) -
            (confidenceWeight[a.confidence] || 0)
          );
        }
        if (sortBy === "file") {
          return (a.file || "").localeCompare(b.file || "");
        }
        return 0;
      });
  }, [activeReport, searchQuery, severityFilter, originFilter, sortBy]);

  const selectedFinding = useMemo(() => {
    if (!selectedFindingId) return null;
    return activeReport?.findings.find((f) => f.id === selectedFindingId) || null;
  }, [activeReport, selectedFindingId]);

  return (
    <div className="max-w-[1440px] mx-auto space-y-5">
      {/* 1. Header Context Controls */}
      <ContextSelectorHeader
        currentRepoId={repoParam}
        currentPrId={prParam}
      />

      {/* 2. No Active Analysis Prompt */}
      {!analysisIdParam && !isEffectiveFixture && (
        <div className="p-5 bg-[#101211] border border-[#292E2A] rounded-[6px] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-[4px] bg-[#151816] border border-[#292E2A] flex items-center justify-center text-[#C7F36B] shrink-0">
              <FileSearch size={16} />
            </div>
            <div>
              <h3 className="font-display font-semibold text-[15px] text-[#F0F2ED]">
                AI Code Review & Forensic Evidence
              </h3>
              <p className="font-body text-[12px] text-[#A0A79F] mt-0.5">
                Run a DEVOS analysis to generate contextual code review findings verified against extracted AST symbols.
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
      {analysisError && !useFixtureMode && (
        <div className="p-4 bg-[#151816] border border-[#E9B96E]/40 rounded-[6px] flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-[11px]">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-[#E9B96E] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#F0F2ED] uppercase tracking-wider block">
                Analysis Report Status
              </span>
              <p className="text-[#A0A79F] text-[12px] font-body mt-0.5">
                {analysisErrorObj?.message || "Failed to retrieve analysis report from backend."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => refetchAnalysis()}
            className="px-3 py-1.5 border border-[#292E2A] hover:bg-[#1D221F] text-[#F0F2ED] rounded-[3px] transition-colors shrink-0"
          >
            Retry Live API
          </button>
        </div>
      )}

      {/* 4. Fixture Mode Notice */}
      {useFixtureMode && !liveReport && (
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

      {/* 5. Review Overview Summary Panel */}
      {activeReport ? (
        <ReviewOverview
          report={activeReport}
          repositoryId={repoParam}
          pullRequestId={prParam}
        />
      ) : analysisLoading ? (
        <div className="p-8 bg-[#101211] border border-[#292E2A] rounded-[6px] animate-pulse">
          <div className="h-6 w-48 bg-[#1D221F] rounded mb-3" />
          <div className="h-4 w-full bg-[#151816] rounded" />
        </div>
      ) : null}

      {/* 6. Filter Controls */}
      <FindingFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        severityFilter={severityFilter}
        onSeverityFilterChange={setSeverityFilter}
        originFilter={originFilter}
        onOriginFilterChange={setOriginFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        totalCount={activeReport?.findings.length || 0}
        matchingCount={filteredFindings.length}
        onClearFilters={() => {
          setSearchQuery("");
          setSeverityFilter("all");
          setOriginFilter("all");
        }}
      />

      {/* 7. Findings List & Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className={selectedFinding ? "lg:col-span-7" : "lg:col-span-12"}>
          <FindingsList
            findings={filteredFindings}
            selectedFindingId={selectedFindingId}
            onSelectFinding={(id) =>
              setSelectedFindingId(id === selectedFindingId ? null : id)
            }
          />
        </div>

        {selectedFinding && (
          <div className="lg:col-span-5 sticky top-4">
            <FindingDetailPanel
              finding={selectedFinding}
              onClose={() => setSelectedFindingId(null)}
              repositoryId={repoParam}
              evidences={FIXTURE_EVIDENCES}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1440px] mx-auto p-8 text-center font-mono text-[12px] text-[#A0A79F]">
          Loading AI Code Review...
        </div>
      }
    >
      <ReviewPageContent />
    </Suspense>
  );
}
