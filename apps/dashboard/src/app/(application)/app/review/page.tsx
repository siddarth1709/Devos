"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ContextSelectorHeader } from "@/components/app-shell/context-selector-header";
import { ReviewOverview } from "@/components/review/review-overview";
import { FindingFilters } from "@/components/review/finding-filters";
import { FindingsList } from "@/components/review/findings-list";
import { FindingDetailPanel } from "@/components/review/finding-detail-panel";
import { useAnalysisReport } from "@/hooks/use-devos-api";
import {
  FIXTURE_ANALYSIS_REPORT,
  FIXTURE_EVIDENCES,
} from "@/lib/fixture-data";
import { AlertCircle, Sparkles, Terminal, FileSearch } from "lucide-react";

function ReviewPageContent() {
  const searchParams = useSearchParams();

  const repoParam = searchParams.get("repo") || "siddarth1709-Devos";
  const prParam = searchParams.get("pr") || "2";
  const initialFindingId = searchParams.get("findingId") || null;
  const initialUseFixture = searchParams.get("fixture") === "1";

  const [useFixtureMode, setUseFixtureMode] = useState<boolean>(initialUseFixture);
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

  // Live backend analysis report query
  const {
    data: liveReport,
    isLoading,
    isError,
    error: errorObj,
    refetch,
  } = useAnalysisReport("job_anl_982347102");

  // Active report dataset
  const activeReport = useMemo(() => {
    if (liveReport && liveReport.findings.length > 0) return liveReport;
    if (useFixtureMode) return FIXTURE_ANALYSIS_REPORT;
    return null;
  }, [liveReport, useFixtureMode]);

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
          return (confidenceWeight[b.confidence] || 0) - (confidenceWeight[a.confidence] || 0);
        }
        if (sortBy === "file") {
          return (a.file || "").localeCompare(b.file || "");
        }
        return 0;
      });
  }, [activeReport, searchQuery, severityFilter, originFilter, sortBy]);

  // Default selected finding
  const effectiveSelectedFindingId =
    selectedFindingId || filteredFindings[0]?.id || null;

  const selectedFinding = useMemo(() => {
    if (!activeReport || !effectiveSelectedFindingId) return null;
    return (
      activeReport.findings.find((f) => f.id === effectiveSelectedFindingId) || null
    );
  }, [activeReport, effectiveSelectedFindingId]);

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      {/* 1. Context Navigation Header */}
      <ContextSelectorHeader
        currentRepoId={repoParam}
        currentPrId={prParam}
      />

      {/* 2. Backend Contract Status Banner when live backend is offline */}
      {isError && !useFixtureMode && (
        <div className="p-4 bg-[#151816] border border-[#E9B96E]/40 rounded-[6px] flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-[11px]">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-[#E9B96E] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#F0F2ED] uppercase tracking-wider block">
                Backend Contract Status: Analysis Report Awaiting Builder 2
              </span>
              <p className="text-[#A0A79F] text-[12px] font-body mt-0.5">
                {errorObj?.message ||
                  "GET /api/analyses/:id is scheduled in docs/api-contract.md."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => refetch()}
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

      {/* 4. Review Executive Overview */}
      {activeReport ? (
        <ReviewOverview
          report={activeReport}
          repositoryId={repoParam}
          pullRequestId={prParam}
        />
      ) : isLoading ? (
        <div className="h-[220px] bg-[#101211] border border-[#292E2A] rounded-[6px] animate-pulse p-6 space-y-4" />
      ) : (
        <div className="p-8 bg-[#101211] border border-[#292E2A] rounded-[6px] text-center space-y-3">
          <FileSearch size={28} className="text-[#6E776F] mx-auto" />
          <h2 className="font-display font-semibold text-[20px] text-[#F0F2ED]">
            No Analysis Report Available
          </h2>
          <p className="font-body text-[13px] text-[#A0A79F] max-w-[480px] mx-auto">
            Analysis has not been executed yet for repository {repoParam} PR #{prParam}.
            Trigger impact analysis from the Pull Request review interface or preview the contract fixture above.
          </p>
        </div>
      )}

      {/* 5. Findings Interface: Filters & Dual-Pane Split */}
      {activeReport && (
        <div className="space-y-4">
          <FindingFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            severityFilter={severityFilter}
            onSeverityFilterChange={setSeverityFilter}
            originFilter={originFilter}
            onOriginFilterChange={setOriginFilter}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            matchingCount={filteredFindings.length}
            totalCount={activeReport.findings.length}
            onClearFilters={() => {
              setSearchQuery("");
              setSeverityFilter("all");
              setOriginFilter("all");
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Findings List (Cols 1-5) */}
            <div className="lg:col-span-5 max-h-[820px] overflow-y-auto pr-1">
              <FindingsList
                findings={filteredFindings}
                selectedFindingId={effectiveSelectedFindingId}
                onSelectFinding={(id) => setSelectedFindingId(id)}
              />
            </div>

            {/* Right Column: Finding Detail Panel (Cols 6-12) */}
            <div className="lg:col-span-7 sticky top-4">
              <FindingDetailPanel
                finding={selectedFinding}
                onClose={() => setSelectedFindingId(null)}
                evidences={FIXTURE_EVIDENCES}
                repositoryId={repoParam}
                pullRequestId={prParam}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CodeReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1440px] mx-auto p-12 text-center font-mono text-[12px] text-[#6E776F]">
          Loading Code Review...
        </div>
      }
    >
      <ReviewPageContent />
    </Suspense>
  );
}
