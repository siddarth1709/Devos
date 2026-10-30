"use client";

import { memo } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { GuardWarning } from "@/types/guard";

interface GuardWarningsProps {
  warnings: GuardWarning[];
  outstandingChecks: string[];
  repositoryId?: string;
  pullRequestId?: string;
}

export const GuardWarnings = memo(function GuardWarnings({
  warnings,
  outstandingChecks,
  repositoryId = "",
  pullRequestId = "",
}: GuardWarningsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* 1. Advisory Warnings */}
      <div className="p-6 bg-[#101211] border border-[#292E2A] rounded-[6px] space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#1D221F]">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-[#E9B96E]" />
            <h3 className="font-mono text-[11px] font-semibold text-[#F0F2ED] uppercase tracking-wider">
              ADVISORY WARNINGS ({warnings.length})
            </h3>
          </div>
          <span className="font-mono text-[10px] text-[#A0A79F]">Non-blocking conditions</span>
        </div>

        {warnings.length > 0 ? (
          <div className="space-y-3">
            {warnings.map((warn) => (
              <div
                key={warn.id}
                className="p-3.5 bg-[#151816] border border-[#E9B96E]/20 rounded-[4px] space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] font-semibold text-[#F0F2ED]">
                    {warn.title}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-[2px] bg-[#E9B96E]/15 border border-[#E9B96E]/40 text-[#E9B96E] font-mono text-[9px] uppercase font-semibold">
                    Warning
                  </span>
                </div>

                <p className="font-body text-[12px] text-[#A0A79F] leading-[1.5]">
                  {warn.explanation}
                </p>

                {warn.suggestedNextStep && (
                  <div className="pt-1.5 border-t border-[#1D221F] font-mono text-[11px] text-[#79D69A]">
                    Next step: {warn.suggestedNextStep}
                  </div>
                )}

                {warn.findingId && (
                  <Link
                    href={`/app/review?repo=${encodeURIComponent(
                      repositoryId
                    )}&pr=${encodeURIComponent(pullRequestId)}&findingId=${encodeURIComponent(
                      warn.findingId
                    )}`}
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-[#C7F36B] hover:underline pt-1"
                  >
                    <span>Inspect in Review Console</span>
                    <ArrowRight size={10} />
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-[#151816] rounded border border-[#222724] text-center font-mono text-[11px] text-[#6E776F]">
            No outstanding warnings reported.
          </div>
        )}
      </div>

      {/* 2. Outstanding / Unknown Verification Scope */}
      <div className="p-6 bg-[#101211] border border-[#292E2A] rounded-[6px] space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#1D221F]">
          <h3 className="font-mono text-[11px] font-semibold text-[#F0F2ED] uppercase tracking-wider">
            OUTSTANDING VERIFICATION CHECKS ({outstandingChecks.length})
          </h3>
          <span className="font-mono text-[10px] text-[#6E776F]">Telemetry gaps</span>
        </div>

        {outstandingChecks.length > 0 ? (
          <div className="space-y-2.5">
            {outstandingChecks.map((item, idx) => (
              <div
                key={idx}
                className="p-3 bg-[#151816] border border-[#222724] rounded-[4px] flex items-start gap-2.5"
              >
                <span className="font-mono text-[10px] text-[#E9B96E] mt-0.5">•</span>
                <span className="font-body text-[12px] text-[#A0A79F] leading-[1.5]">
                  {item}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-[#151816] rounded border border-[#222724] text-center font-mono text-[11px] text-[#6E776F]">
            All defined verification checks have collected evidence.
          </div>
        )}
      </div>
    </div>
  );
});
