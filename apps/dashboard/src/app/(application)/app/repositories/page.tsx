"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  FolderGit2,
  Search,
  RefreshCw,
  Plus,
  GitBranch,
  Calendar,
  AlertCircle,
  Lock,
  Globe,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRepositories } from "@/hooks/use-devos-api";
import { ConnectGitHubModal } from "@/components/app-shell/connect-github-modal";
import { DEMO_REPOSITORY } from "@/lib/demo-fixtures";

export default function RepositoriesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const { isDemo } = useAuth();
  const {
    data: liveRepositories,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useRepositories(searchQuery);

  const repositories = useMemo(() => {
    if (liveRepositories && liveRepositories.length > 0) return liveRepositories;
    if (isDemo) return [DEMO_REPOSITORY];
    return [];
  }, [liveRepositories, isDemo]);

  const filteredRepos = repositories || [];

  return (
    <div className="max-w-[1200px] mx-auto space-y-7">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1D221F]">
        <div>
          <div className="flex items-center gap-2 text-[#C7F36B] font-mono text-[10px] tracking-[0.14em] uppercase font-semibold">
            <FolderGit2 size={13} />
            <span>WORKSPACE MANAGEMENT</span>
          </div>
          <h1 className="mt-2 font-display font-semibold text-[26px] sm:text-[30px] text-[#F0F2ED] tracking-[-0.03em]">
            Connected Repositories
          </h1>
          <p className="mt-1 font-body text-[14px] text-[#A0A79F]">
            Select a repository to inspect pull requests, branch topologies, and dependency impact maps.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 border border-[#292E2A] rounded-[4px] text-[#A0A79F] hover:text-[#F0F2ED] hover:bg-[#151816] transition-colors"
            title="Refresh repository list"
          >
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </button>

          <button
            type="button"
            onClick={() => setConnectModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 h-[40px] bg-[#C7F36B] text-[#090A0A] font-mono text-[11px] font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#D7FF86] active:scale-[0.98] transition-all shadow-sm"
          >
            <Plus size={14} />
            <span>Connect Repository</span>
          </button>
        </div>
      </div>

      {/* Real-time Search and Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-[420px]">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6E776F]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by repository name, owner..."
            className="w-full h-[40px] pl-10 pr-4 bg-[#101211] border border-[#292E2A] rounded-[4px] text-[13px] font-body text-[#F0F2ED] placeholder:text-[#6E776F] focus:outline-none focus:border-[#C7F36B] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-[#A0A79F]">
          <span>
            Showing {filteredRepos.length}{" "}
            {filteredRepos.length === 1 ? "repository" : "repositories"}
          </span>
        </div>
      </div>

      {/* Backend API Offline State */}
      {isError && (
        <div className="p-4 rounded-[4px] bg-[#151816] border border-[#3A4338] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-[#E9B96E] shrink-0 mt-0.5" />
            <div>
              <span className="font-display font-medium text-[13px] text-[#F0F2ED]">
                Backend Connection Pending
              </span>
              <p className="font-body text-[12px] text-[#A0A79F] leading-[1.6]">
                {error?.message ||
                  "Unable to load repositories. Please check if DEVOS backend service is running on port 3001 or 4000."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="self-start sm:self-center px-3 py-1.5 border border-[#292E2A] rounded-[3px] font-mono text-[10px] text-[#C7F36B] hover:bg-[#181D19] uppercase tracking-wider shrink-0 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Repository Listing Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-5 bg-[#101211] border border-[#292E2A] rounded-[4px] space-y-3 animate-pulse"
            >
              <div className="h-4 w-24 bg-[#1D221F] rounded" />
              <div className="h-6 w-40 bg-[#1D221F] rounded" />
              <div className="h-4 w-full bg-[#151816] rounded" />
            </div>
          ))}
        </div>
      ) : filteredRepos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRepos.map((repo) => (
            <Link
              key={repo.id}
              href={
                repo.id === DEMO_REPOSITORY.id
                  ? "/app/graph?fixture=1"
                  : `/app/repositories/${encodeURIComponent(repo.id)}`
              }
              className="group p-5 bg-[#101211] border border-[#292E2A] hover:border-[#44553D] rounded-[4px] transition-all duration-200 flex flex-col justify-between relative overflow-hidden"
            >
              {repo.id === DEMO_REPOSITORY.id && (
                <div className="absolute top-0 right-0 bg-[#E9B96E]/15 border-b border-l border-[#E9B96E]/30 px-2 py-0.5 rounded-bl font-mono text-[8px] font-bold tracking-wider text-[#E9B96E] uppercase">
                  DEMO PROJECT
                </div>
              )}
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#1D221F]">
                  <span className="inline-flex items-center gap-1 font-mono text-[9px] tracking-[0.08em] px-2 py-0.5 rounded-[2px] bg-[#151816] border border-[#292E2A] text-[#A0A79F] uppercase">
                    {repo.visibility === "private" ? (
                      <Lock size={10} className="text-[#E9B96E]" />
                    ) : (
                      <Globe size={10} className="text-[#79D69A]" />
                    )}
                    <span>{repo.visibility}</span>
                  </span>
                  <FolderGit2
                    size={16}
                    className="text-[#6E776F] group-hover:text-[#C7F36B] transition-colors"
                  />
                </div>

                <h3 className="mt-3.5 font-display font-semibold text-[17px] text-[#F0F2ED] group-hover:text-white transition-colors">
                  {repo.name}
                </h3>
                <span className="font-mono text-[11px] text-[#6E776F] block mt-0.5">
                  {repo.fullName}
                </span>

                <div className="mt-4 flex items-center gap-4 text-[11px] font-mono text-[#A0A79F]">
                  <div className="flex items-center gap-1.5">
                    <GitBranch size={12} className="text-[#6E776F]" />
                    <span>{repo.defaultBranch}</span>
                  </div>
                  {repo.updatedAt && (
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-[#6E776F]" />
                      <span>{new Date(repo.updatedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 mt-5 border-t border-[#1D221F] flex items-center justify-between font-mono text-[10px] text-[#C7F36B] uppercase font-semibold">
                <span>View Details & PRs</span>
                <span className="group-hover:translate-x-1 transition-transform">
                  &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 border border-[#292E2A] rounded-[6px] bg-[#101211] flex flex-col items-center text-center">
          <FolderGit2 size={32} className="text-[#6E776F] mb-4" />
          <h2 className="font-display font-semibold text-[20px] text-[#F0F2ED]">
            {searchQuery
              ? `No repositories matching "${searchQuery}"`
              : "No Repositories Available"}
          </h2>
          <p className="mt-2 font-body text-[13px] text-[#A0A79F] max-w-[420px] leading-[1.6]">
            {searchQuery
              ? "Try clearing the search query or verifying repository spelling."
              : "Connect your GitHub account or organization to populate real repositories for change impact inspection."}
          </p>

          <div className="mt-6 flex items-center gap-3">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="px-4 h-[38px] border border-[#292E2A] text-[#F0F2ED] font-mono text-[11px] uppercase tracking-wider rounded-[4px] hover:bg-[#151816] transition-colors"
              >
                Clear Search Filter
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConnectModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 h-[40px] bg-[#C7F36B] text-[#090A0A] font-mono text-[11px] font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#D7FF86] transition-all"
              >
                <Plus size={14} />
                <span>Connect First Repository</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* GitHub Connect Modal */}
      <ConnectGitHubModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
      />
    </div>
  );
}
