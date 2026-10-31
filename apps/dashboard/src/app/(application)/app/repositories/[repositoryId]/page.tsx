"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  GitBranch,
  GitPullRequest,
  Search,
  RefreshCw,
  AlertCircle,
  Globe,
  Lock,
  ChevronDown,
  Play,
  Terminal,
  Folder,
} from "lucide-react";
import {
  useRepository,
  useBranches,
  usePullRequests,
  useCreateAnalysis,
} from "@/hooks/use-devos-api";

export default function RepositoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const repositoryId = (params?.repositoryId as string) || "";

  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [branchSearch, setBranchSearch] = useState("");
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [prSearch, setPrSearch] = useState("");

  const [baseSha, setBaseSha] = useState("HEAD~1");
  const [headSha, setHeadSha] = useState("HEAD");
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const createAnalysis = useCreateAnalysis();

  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalysisError(null);
    try {
      const res = await createAnalysis.mutateAsync({
        repositoryId,
        baseSha,
        headSha,
      });
      const analysisId = (res as { id?: string; job?: { id?: string } })?.id || (res as { id?: string; job?: { id?: string } })?.job?.id;
      if (analysisId) {
        router.push(`/app/graph?repo=${encodeURIComponent(repositoryId)}&analysisId=${encodeURIComponent(analysisId)}`);
      }
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : "Failed to trigger analysis.");
    }
  };

  const {
    data: repository,
    isLoading: repoLoading,
    isError: repoError,
    error: repoErrorObj,
    refetch: refetchRepo,
  } = useRepository(repositoryId);

  const {
    data: branches,
    isLoading: branchesLoading,
  } = useBranches(repositoryId);

  const {
    data: pullRequests,
    isLoading: prsLoading,
    isError: prsError,
    error: prsErrorObj,
    refetch: refetchPrs,
    isFetching: prsFetching,
  } = usePullRequests(repositoryId);

  // Active branch fallback
  const activeBranch =
    selectedBranch ||
    branches?.find((b) => b.isDefault)?.name ||
    repository?.defaultBranch ||
    "";

  const filteredBranches = (branches || []).filter((b) =>
    b.name.toLowerCase().includes(branchSearch.toLowerCase())
  );

  const filteredPrs = (pullRequests || []).filter(
    (pr) =>
      pr.title.toLowerCase().includes(prSearch.toLowerCase()) ||
      pr.author.login.toLowerCase().includes(prSearch.toLowerCase()) ||
      String(pr.number).includes(prSearch)
  );

  return (
    <div className="max-w-[1200px] mx-auto space-y-7">
      {/* 1. Repository Header Card */}
      <div className="p-6 bg-[#101211] border border-[#292E2A] rounded-[6px]">
        {repoLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-32 bg-[#1D221F] rounded" />
            <div className="h-7 w-64 bg-[#1D221F] rounded" />
          </div>
        ) : repoError ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-[#E9B96E]" />
              <div>
                <h1 className="font-display font-semibold text-[20px] text-[#F0F2ED]">
                  Repository: {decodeURIComponent(repositoryId)}
                </h1>
                <p className="font-body text-[12px] text-[#A0A79F]">
                  {repoErrorObj?.message || "Repository metadata pending from backend."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => refetchRepo()}
              className="px-3 py-1.5 border border-[#292E2A] text-[#C7F36B] font-mono text-[10px] uppercase rounded-[3px] hover:bg-[#151816]"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 font-mono text-[9px] tracking-[0.08em] px-2 py-0.5 rounded-[2px] bg-[#151816] border border-[#292E2A] text-[#A0A79F] uppercase">
                  {repository?.visibility === "private" ? (
                    <Lock size={10} className="text-[#E9B96E]" />
                  ) : (
                    <Globe size={10} className="text-[#79D69A]" />
                  )}
                  <span>{repository?.visibility || "public"}</span>
                </span>
                <span className="font-mono text-[10px] text-[#6E776F]">
                  ID: {repository?.id}
                </span>
              </div>

              <h1 className="mt-2 font-display font-semibold text-[24px] sm:text-[28px] text-[#F0F2ED] tracking-[-0.03em]">
                {repository?.name || repository?.fullName || decodeURIComponent(repositoryId)}
              </h1>
              {repository?.path && (
                <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-[#6E776F]">
                  <Folder size={12} className="text-[#6E776F] shrink-0" />
                  <span className="truncate">{repository.path}</span>
                </div>
              )}
            </div>

            {/* Branch Selector Combobox */}
            <div className="relative shrink-0">
              <span className="block font-mono text-[9px] tracking-[0.1em] text-[#6E776F] uppercase mb-1.5">
                ACTIVE BRANCH
              </span>
              <button
                type="button"
                onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
                className="flex items-center justify-between gap-3 min-w-[180px] h-[38px] px-3 bg-[#151816] border border-[#292E2A] rounded-[4px] text-[12px] font-mono text-[#F0F2ED] hover:border-[#44553D] transition-colors"
              >
                <div className="flex items-center gap-2 truncate">
                  <GitBranch size={13} className="text-[#C7F36B] shrink-0" />
                  <span className="truncate">{activeBranch || "Select branch"}</span>
                </div>
                <ChevronDown size={14} className="text-[#6E776F] shrink-0" />
              </button>

              {/* Branch Dropdown Panel */}
              {branchDropdownOpen && (
                <div className="absolute right-0 top-[64px] z-50 w-[260px] bg-[#101211] border border-[#292E2A] rounded-[4px] shadow-2xl p-2 animate-entrance">
                  <div className="p-1 mb-2 border-b border-[#1D221F]">
                    <div className="relative">
                      <Search
                        size={12}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6E776F]"
                      />
                      <input
                        type="text"
                        value={branchSearch}
                        onChange={(e) => setBranchSearch(e.target.value)}
                        placeholder="Filter branches..."
                        className="w-full h-[30px] pl-7 pr-2 bg-[#151816] border border-[#222724] rounded-[3px] text-[11px] font-mono text-[#F0F2ED] placeholder:text-[#6E776F] focus:outline-none focus:border-[#C7F36B]"
                      />
                    </div>
                  </div>

                  <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                    {branchesLoading ? (
                      <div className="p-3 text-center text-[11px] font-mono text-[#6E776F]">
                        Loading branches...
                      </div>
                    ) : filteredBranches.length > 0 ? (
                      filteredBranches.map((b) => (
                        <button
                          key={b.name}
                          type="button"
                          onClick={() => {
                            setSelectedBranch(b.name);
                            setBranchDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[3px] text-[11px] font-mono text-left transition-colors ${
                            activeBranch === b.name
                              ? "bg-[#181D19] text-[#C7F36B]"
                              : "text-[#A0A79F] hover:bg-[#151816] hover:text-[#F0F2ED]"
                          }`}
                        >
                          <span className="truncate">{b.name}</span>
                          {b.isDefault && (
                            <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-[#151816] border border-[#292E2A] text-[#A0A79F]">
                              DEFAULT
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="p-3 text-center text-[11px] font-mono text-[#6E776F]">
                        No branches found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Commit Range Analysis Execution Card */}
      <div className="p-5 bg-[#101211] border border-[#292E2A] rounded-[6px] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={15} className="text-[#C7F36B]" />
            <h2 className="font-display font-medium text-[15px] text-[#F0F2ED]">
              Execute Commit Analysis
            </h2>
          </div>
          <span className="font-mono text-[10px] text-[#6E776F] uppercase tracking-wider">
            Engine Analysis Lifecycle
          </span>
        </div>
        <p className="font-body text-[12px] text-[#A0A79F]">
          Trigger deterministic AST extraction, impact graph traversal, and pre-ship health validation for a commit range.
        </p>

        <form onSubmit={handleRunAnalysis} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pt-1">
          <div className="flex-1">
            <label className="block font-mono text-[10px] uppercase text-[#6E776F] mb-1">
              Base Ref / SHA
            </label>
            <input
              type="text"
              value={baseSha}
              onChange={(e) => setBaseSha(e.target.value)}
              placeholder="HEAD~1"
              className="w-full h-[36px] px-3 bg-[#151816] border border-[#292E2A] rounded-[3px] font-mono text-[12px] text-[#F0F2ED] focus:outline-none focus:border-[#C7F36B]"
            />
          </div>

          <div className="flex-1">
            <label className="block font-mono text-[10px] uppercase text-[#6E776F] mb-1">
              Head Ref / SHA
            </label>
            <input
              type="text"
              value={headSha}
              onChange={(e) => setHeadSha(e.target.value)}
              placeholder="HEAD"
              className="w-full h-[36px] px-3 bg-[#151816] border border-[#292E2A] rounded-[3px] font-mono text-[12px] text-[#F0F2ED] focus:outline-none focus:border-[#C7F36B]"
            />
          </div>

          <button
            type="submit"
            disabled={createAnalysis.isPending || !baseSha || !headSha}
            className="h-[36px] px-5 bg-[#C7F36B] hover:bg-[#D7FF86] text-[#090A0A] font-mono text-[11px] font-semibold uppercase tracking-wider rounded-[3px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shrink-0"
          >
            {createAnalysis.isPending ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play size={13} fill="currentColor" />
                <span>Run Analysis</span>
              </>
            )}
          </button>
        </form>

        {analysisError && (
          <div className="p-3 bg-[#1F1414] border border-[#522525] rounded-[3px] text-[11px] font-mono text-[#F87171]">
            {analysisError}
          </div>
        )}
      </div>

      {/* 3. Pull Requests Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1D221F]">
          <div className="flex items-center gap-2">
            <GitPullRequest size={16} className="text-[#C7F36B]" />
            <h2 className="font-display font-semibold text-[18px] text-[#F0F2ED]">
              Pull Requests
            </h2>
            <span className="font-mono text-[11px] text-[#6E776F]">
              ({filteredPrs.length})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-[260px]">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6E776F]"
              />
              <input
                type="text"
                value={prSearch}
                onChange={(e) => setPrSearch(e.target.value)}
                placeholder="Search PRs..."
                className="w-full h-[34px] pl-8 pr-3 bg-[#101211] border border-[#292E2A] rounded-[3px] text-[12px] font-body text-[#F0F2ED] placeholder:text-[#6E776F] focus:outline-none focus:border-[#C7F36B]"
              />
            </div>

            <button
              type="button"
              onClick={() => refetchPrs()}
              disabled={prsFetching}
              className="p-2 border border-[#292E2A] rounded-[3px] text-[#A0A79F] hover:text-[#F0F2ED] hover:bg-[#101211]"
              title="Refresh pull requests"
            >
              <RefreshCw size={13} className={prsFetching ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* PR Error state */}
        {prsError && (
          <div className="p-4 rounded-[4px] bg-[#151816] border border-[#3A4338] text-[12px] font-body text-[#A0A79F] flex items-center justify-between">
            <span>
              {prsErrorObj?.message ||
                "Unable to load pull requests from backend. Ensure DEVOS API is listening on port 3001 or 4000."}
            </span>
            <button
              type="button"
              onClick={() => refetchPrs()}
              className="text-[#C7F36B] font-mono text-[10px] uppercase hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* PR Listing Items */}
        {prsLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-5 bg-[#101211] border border-[#292E2A] rounded-[4px] h-[80px]"
              />
            ))}
          </div>
        ) : filteredPrs.length > 0 ? (
          <div className="space-y-2.5">
            {filteredPrs.map((pr) => (
              <Link
                key={pr.id}
                href={`/app/repositories/${encodeURIComponent(repositoryId)}/pulls/${pr.number}`}
                className="group p-4 sm:p-5 bg-[#101211] border border-[#292E2A] hover:border-[#44553D] rounded-[4px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-200"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-8 h-8 rounded-[3px] bg-[#151816] border border-[#292E2A] flex items-center justify-center text-[#79D69A] shrink-0 mt-0.5">
                    <GitPullRequest size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-[#A0A79F]">
                        #{pr.number}
                      </span>
                      <h3 className="font-display font-medium text-[15px] text-[#F0F2ED] group-hover:text-white transition-colors truncate">
                        {pr.title}
                      </h3>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] font-mono text-[#6E776F]">
                      <span>by @{pr.author.login}</span>
                      <span>•</span>
                      <span>
                        {pr.sourceBranch} &rarr; {pr.targetBranch}
                      </span>
                      {pr.changedFilesCount !== undefined && (
                        <>
                          <span>•</span>
                          <span>{pr.changedFilesCount} files changed</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 self-start sm:self-center">
                  <span
                    className={`font-mono text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-[2px] border ${
                      pr.state === "open"
                        ? "text-[#79D69A] border-[#34523C] bg-[#79D69A]/10"
                        : pr.state === "merged"
                        ? "text-[#C7F36B] border-[#44553D] bg-[#C7F36B]/10"
                        : "text-[#A0A79F] border-[#292E2A] bg-[#151816]"
                    }`}
                  >
                    {pr.state}
                  </span>

                  <span className="text-[#C7F36B] font-mono text-[11px] group-hover:translate-x-1 transition-transform">
                    View Diff &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-10 border border-[#292E2A] rounded-[4px] bg-[#101211] text-center flex flex-col items-center">
            <GitPullRequest size={28} className="text-[#6E776F] mb-3" />
            <h3 className="font-display font-semibold text-[17px] text-[#F0F2ED]">
              No Pull Requests Found
            </h3>
            <p className="mt-1 font-body text-[13px] text-[#A0A79F] max-w-[380px]">
              {prSearch
                ? `No pull requests matching "${prSearch}".`
                : "No open pull requests detected for this repository. Create a pull request in GitHub to inspect changed files and blast radius."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
