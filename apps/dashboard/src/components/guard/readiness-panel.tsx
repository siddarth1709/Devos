"use client";

import { memo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  HelpCircle,
  AlertTriangle,
  Clock,
  Sparkles,
} from "lucide-react";
import type { ReadinessState } from "@/types/api";

interface ReadinessPanelProps {
  readiness: ReadinessState;
  reason?: string;
  lastEvaluatedAt?: string | null;
  blockerCount: number;
  warningCount: number;
  totalChecks: number;
  passedChecks: number;
}

function getReadinessConfig(readiness: ReadinessState) {
  switch (readiness) {
    case "safe":
      return {
        label: "SAFE TO SHIP",
        sublabel: "Release Criteria Satisfied",
        description:
          "All required checks have completed, and available evidence satisfies the defined release criteria.",
        badgeBg: "bg-[#79D69A]/15",
        badgeBorder: "border-[#79D69A]/40",
        badgeText: "text-[#79D69A]",
        icon: ShieldCheck,
      };
    case "conditional":
      return {
        label: "CONDITIONAL RELEASE",
        sublabel: "Outstanding Conditions Require Review",
        description:
          "The available evidence identifies outstanding warnings or conditions that must be reviewed before shipping.",
        badgeBg: "bg-[#E9B96E]/15",
        badgeBorder: "border-[#E9B96E]/40",
        badgeText: "text-[#E9B96E]",
        icon: AlertTriangle,
      };
    case "unsafe":
      return {
        label: "RELEASE BLOCKED (UNSAFE)",
        sublabel: "Active Blocking Conditions Detected",
        description:
          "At least one verified blocking condition exists. Release cannot proceed until resolved.",
        badgeBg: "bg-[#F07878]/15",
        badgeBorder: "border-[#F07878]/40",
        badgeText: "text-[#F07878]",
        icon: ShieldAlert,
      };
    default:
      return {
        label: "READINESS UNKNOWN",
        sublabel: "Insufficient Evidence Collected",
        description:
          "There is insufficient evidence to determine release readiness. UNKNOWN is never treated as safe.",
        badgeBg: "bg-[#1D221F]",
        badgeBorder: "border-[#292E2A]",
        badgeText: "text-[#A0A79F]",
        icon: HelpCircle,
      };
  }
}

export const ReadinessPanel = memo(function ReadinessPanel({
  readiness,
  reason,
  lastEvaluatedAt,
  blockerCount,
  warningCount,
  totalChecks,
  passedChecks,
}: ReadinessPanelProps) {
  const config = getReadinessConfig(readiness);
  const Icon = config.icon;

  return (
    <div className="p-6 bg-[#101211] border border-[#292E2A] rounded-[6px] space-y-6">
      {/* Top Banner: Status Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div
            className={`w-14 h-14 rounded-[6px] border ${config.badgeBorder} ${config.badgeBg} flex items-center justify-center shrink-0 shadow-lg`}
          >
            <Icon size={28} className={config.badgeText} />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`font-mono text-[10px] tracking-wider uppercase px-2.5 py-0.5 rounded-[2px] border ${config.badgeBorder} ${config.badgeBg} ${config.badgeText} font-semibold`}
              >
                {config.label}
              </span>
              <span className="font-mono text-[11px] text-[#6E776F]">
                {config.sublabel}
              </span>
            </div>

            <h2 className="font-display font-semibold text-[22px] sm:text-[26px] text-[#F0F2ED] tracking-[-0.02em]">
              Release Readiness Evaluation
            </h2>

            <p className="font-body text-[13px] text-[#A0A79F] max-w-[620px] leading-[1.6]">
              {config.description}
            </p>
          </div>
        </div>

        {/* Evaluation Metadata Chips */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="p-3 bg-[#151816] border border-[#222724] rounded-[4px] text-center min-w-[90px]">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#F07878] font-semibold block">
              Blockers
            </span>
            <span className="font-mono text-[18px] font-semibold text-[#F0F2ED] mt-0.5 block">
              {blockerCount}
            </span>
          </div>

          <div className="p-3 bg-[#151816] border border-[#222724] rounded-[4px] text-center min-w-[90px]">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#E9B96E] font-semibold block">
              Warnings
            </span>
            <span className="font-mono text-[18px] font-semibold text-[#F0F2ED] mt-0.5 block">
              {warningCount}
            </span>
          </div>

          <div className="p-3 bg-[#151816] border border-[#222724] rounded-[4px] text-center min-w-[100px]">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#79D69A] font-semibold block">
              Checks Passed
            </span>
            <span className="font-mono text-[18px] font-semibold text-[#F0F2ED] mt-0.5 block">
              {passedChecks} / {totalChecks}
            </span>
          </div>
        </div>
      </div>

      {/* "Why this result?" Explanation Section */}
      <div className="p-4 bg-[#151816] border border-[#222724] rounded-[4px] space-y-2">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
          <span className="text-[#C7F36B] font-semibold flex items-center gap-1.5">
            <Sparkles size={12} />
            <span>Why this result?</span>
          </span>
          {lastEvaluatedAt && (
            <span className="text-[#6E776F] flex items-center gap-1">
              <Clock size={11} />
              <span>Evaluated {new Date(lastEvaluatedAt).toLocaleString()}</span>
            </span>
          )}
        </div>

        <p className="font-body text-[13px] text-[#F0F2ED] leading-[1.6]">
          {reason || "The required analysis evidence is not currently available from Builder 2 API."}
        </p>
      </div>
    </div>
  );
});
