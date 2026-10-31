"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FolderGit2,
  GitPullRequest,
  Network,
  FileSearch,
} from "lucide-react";
import { useRepositories, usePullRequests } from "@/hooks/use-devos-api";

interface ContextSelectorHeaderProps {
  currentRepoId: string;
  currentPrId: string;
  onRepoChange?: (repoId: string) => void;
  onPrChange?: (prId: string) => void;
}

export const ContextSelectorHeader = memo(function ContextSelectorHeader({
  currentRepoId,
  currentPrId,
  onRepoChange,
  onPrChange,
}: ContextSelectorHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: repositories = [], isLoading: reposLoading } = useRepositories();
  const { data: pullRequests = [], isLoading: prsLoading } = usePullRequests(currentRepoId);

  const activeTab = pathname.includes("/graph") ? "graph" : "review";

  const handleSelectRepo = (repoId: string) => {
    if (onRepoChange) {
      onRepoChange(repoId);
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.set("repo", repoId);
      params.delete("pr");
      params.delete("focusNode");
      params.delete("findingId");
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  const handleSelectPr = (prId: string) => {
    if (onPrChange) {
      onPrChange(prId);
    } else {
      const params = new URLSearchParams(searchParams.toString());
      params.set("pr", prId);
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  const getTabUrl = (targetTab: "graph" | "review") => {
    const params = new URLSearchParams(searchParams.toString());
    if (currentRepoId) params.set("repo", currentRepoId);
    if (currentPrId) params.set("pr", currentPrId);
    return `/app/${targetTab}?${params.toString()}`;
  };

  return (
    <div className="p-4 bg-[#101211] border border-[#292E2A] rounded-[6px] flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Left: Repository & Pull Request Pickers */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Repository Picker */}
        <div className="flex items-center gap-2 bg-[#151816] border border-[#292E2A] rounded-[4px] px-2.5 h-[36px]">
          <FolderGit2 size={14} className="text-[#A0A79F]" />
          <select
            value={currentRepoId}
            onChange={(e) => handleSelectRepo(e.target.value)}
            disabled={reposLoading}
            className="bg-transparent text-[#F0F2ED] font-mono text-[11px] focus:outline-none cursor-pointer"
          >
            {reposLoading ? (
              <option value="">Loading repositories...</option>
            ) : repositories.length > 0 ? (
              repositories.map((repo) => (
                <option key={repo.id} value={repo.id} className="bg-[#101211] text-[#F0F2ED]">
                  {repo.name} {repo.owner ? `(${repo.owner})` : `[${repo.defaultBranch || "main"}]`}
                </option>
              ))
            ) : (
              <option value="" className="bg-[#101211] text-[#F0F2ED]">
                No connected repositories
              </option>
            )}
          </select>
        </div>

        {/* Pull Request / Analysis Context Picker */}
        <div className="flex items-center gap-2 bg-[#151816] border border-[#292E2A] rounded-[4px] px-2.5 h-[36px]">
          <GitPullRequest size={14} className="text-[#C7F36B]" />
          <select
            value={currentPrId}
            onChange={(e) => handleSelectPr(e.target.value)}
            disabled={prsLoading || pullRequests.length === 0}
            className="bg-transparent text-[#F0F2ED] font-mono text-[11px] focus:outline-none cursor-pointer disabled:opacity-60"
          >
            {prsLoading ? (
              <option value="">Loading PRs...</option>
            ) : pullRequests.length > 0 ? (
              pullRequests.map((pr) => (
                <option key={pr.id} value={pr.number.toString()} className="bg-[#101211] text-[#F0F2ED]">
                  PR #{pr.number}: {pr.title.slice(0, 36)}...
                </option>
              ))
            ) : (
              <option value="" className="bg-[#101211] text-[#A0A79F]">
                Commit Range Mode
              </option>
            )}
          </select>
        </div>
      </div>

      {/* Right: Tab Switcher (Graph vs Review) */}
      <div className="flex items-center gap-1 bg-[#151816] border border-[#292E2A] rounded-[4px] p-1 font-mono text-[11px]">
        <Link
          href={getTabUrl("graph")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-[3px] transition-colors ${
            activeTab === "graph"
              ? "bg-[#C7F36B] text-[#090A0A] font-semibold"
              : "text-[#A0A79F] hover:text-[#F0F2ED]"
          }`}
        >
          <Network size={13} />
          <span>Dependency Graph</span>
        </Link>

        <Link
          href={getTabUrl("review")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-[3px] transition-colors ${
            activeTab === "review"
              ? "bg-[#C7F36B] text-[#090A0A] font-semibold"
              : "text-[#A0A79F] hover:text-[#F0F2ED]"
          }`}
        >
          <FileSearch size={13} />
          <span>AI Code Review</span>
        </Link>
      </div>
    </div>
  );
});
