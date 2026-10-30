"use client";

import { memo } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  FileCode2,
  ExternalLink,
  Sparkles,
  Network,
  CheckCircle2,
} from "lucide-react";
import type { GuardBlocker } from "@/types/guard";

interface BlockingIssuesProps {
  blockers: GuardBlocker[];
  repositoryId?: string;
  pullRequestId?: string;
  checksCompleted: boolean;
}

export const BlockingIssues = memo(function BlockingIssues({
  blockers,
  repositoryId = "",
  pullRequestId = "",
  checksCompleted,
}: BlockingIssuesProps) {
  return (
    <div className="p-6 bg-[#101211] border border-[#292E2A] rounded-[6px] space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-[#F07878]" />
          <h3 className="font-mono text-[12px] font-semibold text-[#F0F2ED] uppercase tracking-wider">
            BLOCKING ISSUES ({blockers.length})
          </h3>
        </div>
        <span className="font-mono text-[10px] text-[#A0A79F]">
          Must be resolved before deployment
        </span>
      </div>

      {blockers.length > 0 ? (
        <div className="space-y-3">
          {blockers.map((blocker) => (
            <div
              key={blocker.id}
              className="p-4 bg-[#151816] border border-[#F07878]/30 rounded-[4px] space-y-3 transition-colors hover:border-[#F07878]/60"
            >
              {/* Header: Severity Badge and Title */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-[2px] bg-[#F07878]/15 border border-[#F07878]/40 text-[#F07878] font-mono text-[9px] uppercase font-semibold">
                    {blocker.severity} BLOCKER
                  </span>
                  <h4 className="font-display font-semibold text-[15px] text-[#F0F2ED]">
                    {blocker.title}
                  </h4>
                </div>

                {blocker.filePath && (
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#A0A79F]">
                    <FileCode2 size={13} className="text-[#6E776F]" />
                    <span>{blocker.filePath}</span>
                    {blocker.line && <span className="text-[#C7F36B]">:{blocker.line}</span>}
                  </div>
                )}
              </div>

              {/* Explanation */}
              <p className="font-body text-[13px] text-[#A0A79F] leading-[1.6]">
                {blocker.explanation}
              </p>

              {/* Cross-navigation links */}
              <div className="pt-2 border-t border-[#1D221F] flex flex-wrap items-center gap-4 font-mono text-[11px]">
                {blocker.findingId && (
                  <Link
                    href={`/app/review?repo=${encodeURIComponent(
                      repositoryId
                    )}&pr=${encodeURIComponent(pullRequestId)}&findingId=${encodeURIComponent(
                      blocker.findingId
                    )}`}
                    className="inline-flex items-center gap-1 text-[#C7F36B] hover:underline"
                  >
                    <Sparkles size={12} />
                    <span>View Finding in Code Review</span>
                    <span>&rarr;</span>
                  </Link>
                )}

                {blocker.symbolId && (
                  <Link
                    href={`/app/graph?repo=${encodeURIComponent(
                      repositoryId
                    )}&pr=${encodeURIComponent(pullRequestId)}&focusNode=${encodeURIComponent(
                      blocker.symbolId
                    )}`}
                    className="inline-flex items-center gap-1 text-[#84C2F5] hover:underline"
                  >
                    <Network size={12} />
                    <span>Trace in Engineering Graph</span>
                    <span>&rarr;</span>
                  </Link>
                )}

                {blocker.filePath && repositoryId && pullRequestId && (
                  <Link
                    href={`/app/repositories/${encodeURIComponent(
                      repositoryId
                    )}/pulls/${encodeURIComponent(pullRequestId)}?path=${encodeURIComponent(
                      blocker.filePath
                    )}`}
                    className="inline-flex items-center gap-1 text-[#A0A79F] hover:text-[#F0F2ED]"
                  >
                    <ExternalLink size={12} />
                    <span>View Diff Excerpt</span>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : checksCompleted ? (
        <div className="p-6 bg-[#151816] border border-[#222724] rounded-[4px] text-center space-y-1.5">
          <CheckCircle2 size={20} className="text-[#79D69A] mx-auto" />
          <h4 className="font-mono text-[12px] font-semibold text-[#F0F2ED]">
            No Blocking Issues Reported
          </h4>
          <p className="font-body text-[12px] text-[#A0A79F] max-w-[420px] mx-auto">
            No verified blocking conditions were detected by the completed analysis checks.
          </p>
        </div>
      ) : (
        <div className="p-6 bg-[#151816] border border-[#222724] rounded-[4px] text-center space-y-1.5">
          <span className="font-mono text-[11px] text-[#6E776F]">
            Verification checks pending. Release readiness cannot be guaranteed until analysis completes.
          </span>
        </div>
      )}
    </div>
  );
});

