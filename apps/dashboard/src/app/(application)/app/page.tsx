"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  FolderGit2,
  Network,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import { useAuth } from "@/hooks/use-auth";
import { useRepositories, useGitHubStatus } from "@/hooks/use-devos-api";
import { ConnectGitHubModal } from "@/components/app-shell/connect-github-modal";
import { DEMO_REPOSITORY, DEMO_PULL_REQUEST } from "@/lib/demo-fixtures";

export default function DashboardOverviewPage() {
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const { isDemo } = useAuth();
  const { data: githubStatus } = useGitHubStatus();
  const {
    data: liveRepositories,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useRepositories();

  const repositories = useMemo(() => {
    if (liveRepositories && liveRepositories.length > 0) return liveRepositories;
    if (isDemo) return [DEMO_REPOSITORY];
    return [];
  }, [liveRepositories, isDemo]);

  const isConnected = isDemo || githubStatus?.status === "connected";
  const hasRepositories = repositories && repositories.length > 0;

  return (
    <div className="max-w-[1200px] mx-auto space-y-8">
      {/* 1. Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1D221F]">
        <div>
          <div className="flex items-center gap-2 text-[#C7F36B] font-mono text-[10px] tracking-[0.14em] uppercase font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C7F36B]" />
            <span>CONSOLE OVERVIEW</span>
          </div>
          <h1 className="mt-2 font-display font-semibold text-[26px] sm:text-[32px] text-[#F0F2ED] tracking-[-0.03em]">
            Engineering Intelligence Workspace
          </h1>
          <p className="mt-1 font-body text-[14px] text-[#A0A79F] max-w-[620px] leading-[1.6]">
            Understand pull request impact, inspect transitive blast radius, and verify deterministic release readiness before shipping code.
          </p>
        </div>

        {/* Primary Header CTAs */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 border border-[#292E2A] rounded-[4px] text-[#A0A79F] hover:text-[#F0F2ED] hover:bg-[#151816] transition-colors"
            title="Refresh repository state"
          >
            <RefreshCw size={15} className={isFetching ? "animate-spin" : ""} />
          </button>

          {!isConnected ? (
            <button
              type="button"
              onClick={() => setConnectModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 h-[42px] bg-[#C7F36B] text-[#090A0A] font-mono text-[11px] font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#D7FF86] active:scale-[0.98] transition-all shadow-sm"
            >
              <GithubIcon size={15} />
              <span>Connect Repository</span>
            </button>
          ) : (
            <Link
              href="/app/repositories"
              className="inline-flex items-center gap-2 px-4 h-[42px] bg-[#C7F36B] text-[#090A0A] font-mono text-[11px] font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#D7FF86] active:scale-[0.98] transition-all"
            >
              <span>Manage Repositories</span>
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>

      {/* Backend API Offline / Awaiting Notification */}
      {isError && (
        <div className="p-4 rounded-[4px] bg-[#151816] border border-[#3A4338] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-[#E9B96E] shrink-0 mt-0.5" />
            <div>
              <span className="font-display font-medium text-[13px] text-[#F0F2ED]">
                Backend Service Awaiting Initialization
              </span>
              <p className="font-body text-[12px] text-[#A0A79F] leading-[1.6]">
                {error?.message ||
                  "The frontend is connected to http://localhost:3001/api. Once Builder 2 launches the API container, live repositories will populate automatically."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="self-start sm:self-center px-3 py-1.5 border border-[#292E2A] rounded-[3px] font-mono text-[10px] text-[#C7F36B] hover:bg-[#181D19] uppercase tracking-wider shrink-0 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* 2. Repository Overview Area */}
      {isLoading ? (
        /* Loading Skeleton */
        <div className="p-8 border border-[#292E2A] rounded-[6px] bg-[#101211] space-y-4 animate-pulse">
          <div className="h-4 w-48 bg-[#1D221F] rounded" />
          <div className="h-6 w-80 bg-[#1D221F] rounded" />
          <div className="h-20 w-full bg-[#151816] rounded" />
        </div>
      ) : hasRepositories ? (
        /* Active Repositories List Overview */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-[#A0A79F] font-semibold">
              CONNECTED REPOSITORIES ({repositories.length})
            </span>
            <Link
              href="/app/repositories"
              className="text-[12px] font-mono text-[#C7F36B] hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {repositories.map((repo) => (
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
                    <span className="font-mono text-[9px] tracking-[0.08em] px-2 py-0.5 rounded-[2px] bg-[#151816] border border-[#292E2A] text-[#A0A79F] uppercase">
                      {repo.visibility}
                    </span>
                    <FolderGit2 size={15} className="text-[#A0A79F] group-hover:text-[#C7F36B] transition-colors" />
                  </div>
                  <h3 className="mt-3 font-display font-semibold text-[16px] text-[#F0F2ED] group-hover:text-white transition-colors">
                    {repo.name}
                  </h3>
                  <span className="font-mono text-[11px] text-[#6E776F] block mt-0.5">
                    {repo.fullName}
                  </span>
                </div>

                <div className="pt-4 mt-4 border-t border-[#1D221F] flex items-center justify-between text-[11px] font-mono text-[#A0A79F]">
                  <span>Branch: {repo.defaultBranch}</span>
                  <span className="text-[#C7F36B] group-hover:translate-x-1 transition-transform">
                    {repo.id === DEMO_REPOSITORY.id ? "Explore Graph &rarr;" : "&rarr;"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        /* Designed Empty State (Zero Fake Data) */
        <div className="p-8 sm:p-12 border border-[#292E2A] rounded-[6px] bg-[#101211] flex flex-col items-center text-center max-w-[760px] mx-auto">
          <div className="w-14 h-14 rounded-full bg-[#151816] border border-[#292E2A] flex items-center justify-center text-[#C7F36B] mb-5">
            <FolderGit2 size={24} />
          </div>

          <h2 className="font-display font-semibold text-[22px] sm:text-[24px] text-[#F0F2ED]">
            No Repositories Connected Yet
          </h2>

          <p className="mt-2.5 font-body text-[14px] leading-[1.7] text-[#A0A79F] max-w-[500px]">
            To analyze code changes and compute dependency blast radius, connect your GitHub organization or personal repository. DEVOS analyzes PR diffs in-memory without storing source files.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={() => setConnectModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-6 h-[44px] bg-[#C7F36B] text-[#090A0A] font-mono text-[11px] font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#D7FF86] active:scale-[0.98] transition-all"
            >
              <GithubIcon size={15} />
              <span>Connect GitHub Repository</span>
            </button>
            <Link
              href="/app/repositories"
              className="inline-flex items-center justify-center h-[44px] px-5 border border-[#292E2A] text-[#F0F2ED] font-mono text-[11px] uppercase tracking-wider rounded-[4px] hover:bg-[#151816] transition-colors"
            >
              Repository Directory
            </Link>
          </div>

          {/* Workflow explanation strip */}
          <div className="mt-10 pt-8 border-t border-[#1D221F] w-full grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            <div>
              <span className="font-mono text-[10px] text-[#C7F36B] font-semibold block">
                01 / CONNECT
              </span>
              <p className="mt-1 font-body text-[12px] text-[#A0A79F] leading-[1.6]">
                Link repository via GitHub App authorization.
              </p>
            </div>
            <div>
              <span className="font-mono text-[10px] text-[#C7F36B] font-semibold block">
                02 / SELECT PR
              </span>
              <p className="mt-1 font-body text-[12px] text-[#A0A79F] leading-[1.6]">
                Inspect modified files and syntax-highlighted diffs.
              </p>
            </div>
            <div>
              <span className="font-mono text-[10px] text-[#C7F36B] font-semibold block">
                03 / REVEAL IMPACT
              </span>
              <p className="mt-1 font-body text-[12px] text-[#A0A79F] leading-[1.6]">
                Gemma reasoning correlates AST diffs with test coverage.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Core Feature Quick Access Grid */}
      <div className="space-y-4 pt-4">
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-[#A0A79F] font-semibold">
          CORE CAPABILITIES
        </span>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Dependency Graph */}
          <Link
            href="/app/graph"
            className="group p-6 bg-[#101211] border border-[#292E2A] hover:border-[#44553D] rounded-[4px] transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-[3px] bg-[#151816] border border-[#292E2A] flex items-center justify-center text-[#C7F36B] mb-4">
                <Network size={18} />
              </div>
              <h3 className="font-display font-semibold text-[17px] text-[#F0F2ED] group-hover:text-white transition-colors">
                Dependency Graph
              </h3>
              <p className="mt-2 font-body text-[13px] leading-[1.7] text-[#A0A79F]">
                Transitive symbol dependency lattice powered by React Flow. Identifies exactly what touches what.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-[#1D221F] flex items-center justify-between font-mono text-[9px] text-[#6E776F] uppercase">
              <span>EXPLORE GRAPH</span>
              <ArrowRight size={13} className="text-[#C7F36B] group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 2: AI Code Review */}
          <Link
            href="/app/review"
            className="group p-6 bg-[#101211] border border-[#292E2A] hover:border-[#44553D] rounded-[4px] transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-[3px] bg-[#151816] border border-[#292E2A] flex items-center justify-center text-[#79D69A] mb-4">
                <Sparkles size={18} />
              </div>
              <h3 className="font-display font-semibold text-[17px] text-[#F0F2ED] group-hover:text-white transition-colors">
                AI Code Review
              </h3>
              <p className="mt-2 font-body text-[13px] leading-[1.7] text-[#A0A79F]">
                Evidence-grounded code analysis with Gemma. Every finding is anchored directly to repository AST symbols.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-[#1D221F] flex items-center justify-between font-mono text-[9px] text-[#6E776F] uppercase">
              <span>VIEW REVIEW ENGINE</span>
              <ArrowRight size={13} className="text-[#C7F36B] group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Card 3: Pre-ship Guard */}
          <Link
            href="/app/guard"
            className="group p-6 bg-[#101211] border border-[#292E2A] hover:border-[#44553D] rounded-[4px] transition-all duration-200 flex flex-col justify-between"
          >
            <div>
              <div className="w-9 h-9 rounded-[3px] bg-[#151816] border border-[#292E2A] flex items-center justify-center text-[#E9B96E] mb-4">
                <ShieldCheck size={18} />
              </div>
              <h3 className="font-display font-semibold text-[17px] text-[#F0F2ED] group-hover:text-white transition-colors">
                Pre-ship Guard
              </h3>
              <p className="mt-2 font-body text-[13px] leading-[1.7] text-[#A0A79F]">
                Deterministic release evaluation: Safe, Conditional, Unsafe, or Unknown based on concrete test checks.
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-[#1D221F] flex items-center justify-between font-mono text-[9px] text-[#6E776F] uppercase">
              <span>INSPECT READINESS</span>
              <ArrowRight size={13} className="text-[#C7F36B] group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>

      {/* 4. Recent Analysis & Release Readiness Widgets (Truthful Empty State) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Recent Analysis Feed */}
        <div className="p-6 bg-[#101211] border border-[#292E2A] rounded-[4px] flex flex-col justify-between min-h-[200px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1D221F]">
              <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-[#A0A79F] font-semibold">
                RECENT ANALYSES
              </span>
              <Clock size={14} className="text-[#6E776F]" />
            </div>
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <span className="font-mono text-[11px] text-[#A0A79F]">
                No pull requests analyzed yet
              </span>
              <p className="mt-1 font-body text-[12px] text-[#6E776F] max-w-[320px]">
                Once a pull request analysis is initiated, AST extraction and blast radius history will appear here.
              </p>
            </div>
          </div>
          <div className="pt-3 border-t border-[#1D221F] font-mono text-[9px] text-[#6E776F]">
            GROUNDED IN REPOSITORY TRACEABILITY
          </div>
        </div>

        {/* Release Readiness Status */}
        <div className="p-6 bg-[#101211] border border-[#292E2A] rounded-[4px] flex flex-col justify-between min-h-[200px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#1D221F]">
              <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-[#A0A79F] font-semibold">
                LATEST RELEASE READINESS
              </span>
              <span className="px-2 py-0.5 rounded-[2px] bg-[#151816] border border-[#292E2A] font-mono text-[9px] text-[#6E776F] uppercase">
                PENDING INPUT
              </span>
            </div>
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <span className="font-mono text-[11px] text-[#A0A79F]">
                Awaiting pull request selection
              </span>
              <p className="mt-1 font-body text-[12px] text-[#6E776F] max-w-[320px]">
                Pre-ship Guard calculates release condition from deterministic regression checks and coverage results.
              </p>
            </div>
          </div>
          <div className="pt-3 border-t border-[#1D221F] font-mono text-[9px] text-[#6E776F]">
            ZERO FABRICATED METRICS
          </div>
        </div>
      </div>

      {/* GitHub Connect Modal */}
      <ConnectGitHubModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
      />
    </div>
  );
}
