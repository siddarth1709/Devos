"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FileCode2,
  Play,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FilePlus,
  FileMinus,
  FileEdit,
  ArrowLeft,
} from "lucide-react";
import {
  usePullRequest,
  useChangedFiles,
  useFileDiff,
  useTriggerAnalysis,
} from "@/hooks/use-devos-api";

export default function PullRequestReviewPage() {
  const params = useParams();
  const repositoryId = (params?.repositoryId as string) || "";
  const pullRequestId = (params?.pullRequestId as string) || "";

  const [selectedFile, setSelectedFile] = useState<string>("");
  const [fileSearch, setFileSearch] = useState<string>("");

  const {
    data: pullRequest,
    isLoading: prLoading,
    isError: prError,
    error: prErrorObj,
    refetch: refetchPr,
  } = usePullRequest(repositoryId, pullRequestId);

  const {
    data: changedFiles,
    isLoading: filesLoading,
  } = useChangedFiles(repositoryId, pullRequestId);

  const activeFilePath = selectedFile || changedFiles?.[0]?.filename || "";

  const {
    data: diffData,
    isLoading: diffLoading,
    isError: diffError,
    error: diffErrorObj,
    refetch: refetchDiff,
  } = useFileDiff(repositoryId, pullRequestId, activeFilePath);

  const triggerAnalysis = useTriggerAnalysis(repositoryId, pullRequestId);

  const filteredFiles = (changedFiles || []).filter((f) =>
    f.filename.toLowerCase().includes(fileSearch.toLowerCase())
  );

  const currentIndex = changedFiles?.findIndex(
    (f) => f.filename === activeFilePath
  ) ?? -1;

  const handlePrevFile = () => {
    if (changedFiles && currentIndex > 0) {
      setSelectedFile(changedFiles[currentIndex - 1].filename);
    }
  };

  const handleNextFile = () => {
    if (changedFiles && currentIndex < changedFiles.length - 1) {
      setSelectedFile(changedFiles[currentIndex + 1].filename);
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      {/* Back to Repository Navigation */}
      <div>
        <Link
          href={`/app/repositories/${encodeURIComponent(repositoryId)}`}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#A0A79F] hover:text-[#F0F2ED] transition-colors"
        >
          <ArrowLeft size={13} />
          <span>Back to {decodeURIComponent(repositoryId)}</span>
        </Link>
      </div>

      {/* 1. Pull Request Header & Analysis Trigger */}
      <div className="p-6 bg-[#101211] border border-[#292E2A] rounded-[6px]">
        {prLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-40 bg-[#1D221F] rounded" />
            <div className="h-7 w-80 bg-[#1D221F] rounded" />
          </div>
        ) : prError ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-[#E9B96E]" />
              <div>
                <h1 className="font-display font-semibold text-[20px] text-[#F0F2ED]">
                  Pull Request #{pullRequestId}
                </h1>
                <p className="font-body text-[12px] text-[#A0A79F]">
                  {prErrorObj?.message || "Pull request metadata pending from backend."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => refetchPr()}
              className="px-3 py-1.5 border border-[#292E2A] text-[#C7F36B] font-mono text-[10px] uppercase rounded-[3px] hover:bg-[#151816]"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[12px] font-semibold text-[#A0A79F]">
                  #{pullRequest?.number || pullRequestId}
                </span>
                <span
                  className={`font-mono text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-[2px] border ${
                    pullRequest?.state === "open"
                      ? "text-[#79D69A] border-[#34523C] bg-[#79D69A]/10"
                      : pullRequest?.state === "merged"
                      ? "text-[#C7F36B] border-[#44553D] bg-[#C7F36B]/10"
                      : "text-[#A0A79F] border-[#292E2A] bg-[#151816]"
                  }`}
                >
                  {pullRequest?.state || "OPEN"}
                </span>
                <span className="font-mono text-[11px] text-[#6E776F]">
                  by @{pullRequest?.author.login || "developer"}
                </span>
              </div>

              <h1 className="mt-2 font-display font-semibold text-[22px] sm:text-[26px] text-[#F0F2ED] tracking-[-0.02em] truncate">
                {pullRequest?.title || `Pull Request #${pullRequestId}`}
              </h1>

              <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px] text-[#A0A79F]">
                <span>
                  {pullRequest?.sourceBranch || "head"} &rarr;{" "}
                  {pullRequest?.targetBranch || "base"}
                </span>
                <span>•</span>
                <span>{changedFiles?.length || 0} modified files</span>
              </div>
            </div>

            {/* Analysis Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => triggerAnalysis.mutate()}
                disabled={triggerAnalysis.isPending}
                className="inline-flex items-center gap-2 px-5 h-[42px] bg-[#C7F36B] text-[#090A0A] font-mono text-[11px] font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#D7FF86] active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
              >
                {triggerAnalysis.isPending ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
                )}
                <span>
                  {triggerAnalysis.isPending
                    ? "Submitting Job..."
                    : "Run Impact Analysis"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Analysis Job Trigger Notification */}
      {triggerAnalysis.isSuccess && (
        <div className="p-4 rounded-[4px] bg-[#79D69A]/10 border border-[#79D69A]/30 flex items-center justify-between text-[#79D69A] font-mono text-[12px]">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>
              Analysis Job #{triggerAnalysis.data?.jobId} queued with Builder 2.
            </span>
          </div>
          <Link
            href="/app/graph"
            className="text-[#F0F2ED] hover:underline flex items-center gap-1"
          >
            <span>Track in Dependency Graph</span>
            <span>&rarr;</span>
          </Link>
        </div>
      )}

      {/* 2. Developer Split View: Changed Files Tree (Left) & Diff Viewer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Changed Files List (Cols 1-4) */}
        <div className="lg:col-span-4 bg-[#101211] border border-[#292E2A] rounded-[6px] overflow-hidden">
          <div className="p-3.5 border-b border-[#1D221F] bg-[#151816] flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.1em] text-[#A0A79F] uppercase font-semibold">
              CHANGED FILES ({changedFiles?.length || 0})
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevFile}
                disabled={currentIndex <= 0}
                className="p-1 text-[#A0A79F] hover:text-[#F0F2ED] disabled:opacity-30"
                title="Previous file"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={handleNextFile}
                disabled={!changedFiles || currentIndex >= changedFiles.length - 1}
                className="p-1 text-[#A0A79F] hover:text-[#F0F2ED] disabled:opacity-30"
                title="Next file"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* File Search */}
          <div className="p-2.5 border-b border-[#1D221F]">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6E776F]"
              />
              <input
                type="text"
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                placeholder="Filter files..."
                className="w-full h-[30px] pl-7 pr-2 bg-[#151816] border border-[#222724] rounded-[3px] text-[11px] font-mono text-[#F0F2ED] placeholder:text-[#6E776F] focus:outline-none focus:border-[#C7F36B]"
              />
            </div>
          </div>

          {/* Files List */}
          <div className="max-h-[580px] overflow-y-auto divide-y divide-[#1D221F]">
            {filesLoading ? (
              <div className="p-5 text-center font-mono text-[11px] text-[#6E776F]">
                Loading changed files...
              </div>
            ) : filteredFiles.length > 0 ? (
              filteredFiles.map((file) => {
                const isSelected = file.filename === activeFilePath;
                return (
                  <button
                    key={file.filename}
                    type="button"
                    onClick={() => setSelectedFile(file.filename)}
                    className={`w-full p-3 text-left flex items-start gap-2.5 transition-colors ${
                      isSelected
                        ? "bg-[#181D19] border-l-2 border-[#C7F36B]"
                        : "hover:bg-[#151816] border-l-2 border-transparent"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {file.status === "added" ? (
                        <FilePlus size={14} className="text-[#79D69A]" />
                      ) : file.status === "deleted" ? (
                        <FileMinus size={14} className="text-[#F07878]" />
                      ) : (
                        <FileEdit size={14} className="text-[#E9B96E]" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <span
                        className={`block font-mono text-[11px] truncate ${
                          isSelected
                            ? "text-[#F0F2ED] font-semibold"
                            : "text-[#A0A79F]"
                        }`}
                        title={file.filename}
                      >
                        {file.filename}
                      </span>

                      <div className="mt-1 flex items-center gap-2 font-mono text-[9px]">
                        {file.additions > 0 && (
                          <span className="text-[#79D69A]">+{file.additions}</span>
                        )}
                        {file.deletions > 0 && (
                          <span className="text-[#F07878]">-{file.deletions}</span>
                        )}
                        <span className="text-[#6E776F] uppercase">
                          {file.status}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-center font-mono text-[11px] text-[#6E776F]">
                {fileSearch ? "No matching files" : "No modified files detected"}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Diff Viewer (Cols 5-12) */}
        <div className="lg:col-span-8 bg-[#101211] border border-[#292E2A] rounded-[6px] overflow-hidden flex flex-col min-h-[480px]">
          {/* Diff Header */}
          <div className="p-3.5 bg-[#151816] border-b border-[#1D221F] flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <FileCode2 size={15} className="text-[#C7F36B] shrink-0" />
              <span className="font-mono text-[12px] font-semibold text-[#F0F2ED] truncate">
                {activeFilePath || "No file selected"}
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0 font-mono text-[10px]">
              {diffData && (
                <div className="flex items-center gap-2">
                  <span className="text-[#79D69A]">+{diffData.additions}</span>
                  <span className="text-[#F07878]">-{diffData.deletions}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => refetchDiff()}
                className="p-1 text-[#A0A79F] hover:text-[#F0F2ED]"
                title="Reload diff"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* Diff Content Panel */}
          <div className="flex-1 overflow-x-auto font-mono text-[11px] leading-[1.6]">
            {diffLoading ? (
              <div className="p-12 text-center text-[#6E776F] flex flex-col items-center justify-center">
                <RefreshCw size={20} className="animate-spin mb-3 text-[#C7F36B]" />
                <span>Loading file diff...</span>
              </div>
            ) : diffError ? (
              <div className="p-10 text-center text-[#A0A79F]">
                <AlertCircle size={22} className="mx-auto text-[#E9B96E] mb-2" />
                <span className="block font-semibold text-[#F0F2ED]">
                  Diff Unavailable from Backend
                </span>
                <p className="mt-1 text-[12px] text-[#6E776F] max-w-[400px] mx-auto">
                  {diffErrorObj?.message ||
                    "Unable to retrieve diff patch. Ensure Builder 2's diff endpoint is active."}
                </p>
              </div>
            ) : diffData?.isBinary ? (
              <div className="p-12 text-center text-[#A0A79F]">
                <span>Binary file modified. Diff content suppressed.</span>
              </div>
            ) : diffData?.hunks && diffData.hunks.length > 0 ? (
              <div className="divide-y divide-[#1D221F]">
                {diffData.hunks.map((hunk, hIdx) => (
                  <div key={hIdx} className="overflow-x-auto">
                    {/* Hunk Header */}
                    <div className="px-4 py-1.5 bg-[#151816]/70 text-[#6E776F] font-mono text-[10px] select-none border-b border-[#1D221F]">
                      {hunk.header}
                    </div>

                    {/* Hunk Lines */}
                    <table className="w-full border-collapse">
                      <tbody>
                        {hunk.lines.map((line, lIdx) => {
                          const isAdd = line.type === "addition";
                          const isDel = line.type === "deletion";

                          return (
                            <tr
                              key={lIdx}
                              className={`group ${
                                isAdd
                                  ? "bg-[#79D69A]/[0.08] hover:bg-[#79D69A]/[0.12]"
                                  : isDel
                                  ? "bg-[#F07878]/[0.08] hover:bg-[#F07878]/[0.12]"
                                  : "hover:bg-[#151816]/40"
                              }`}
                            >
                              {/* Old Line Number */}
                              <td className="w-12 px-2 py-0.5 text-right font-mono text-[10px] text-[#6E776F] select-none border-r border-[#1D221F]/60">
                                {line.oldLineNumber ?? ""}
                              </td>

                              {/* New Line Number */}
                              <td className="w-12 px-2 py-0.5 text-right font-mono text-[10px] text-[#6E776F] select-none border-r border-[#1D221F]/60">
                                {line.newLineNumber ?? ""}
                              </td>

                              {/* Marker */}
                              <td
                                className={`w-6 px-1.5 py-0.5 text-center font-mono text-[10px] select-none ${
                                  isAdd
                                    ? "text-[#79D69A]"
                                    : isDel
                                    ? "text-[#F07878]"
                                    : "text-[#6E776F]"
                                }`}
                              >
                                {isAdd ? "+" : isDel ? "-" : " "}
                              </td>

                              {/* Line Content */}
                              <td
                                className={`px-2 py-0.5 whitespace-pre font-mono text-[11px] ${
                                  isAdd
                                    ? "text-[#B9F5CD]"
                                    : isDel
                                    ? "text-[#FFB3B3]"
                                    : "text-[#D2D7D1]"
                                }`}
                              >
                                {line.content}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-[#6E776F]">
                <span>No text diff available for this file.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
