"use client";

import { memo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Sparkles,
  GitPullRequest,
} from "lucide-react";
import type { AnalysisReport, ReadinessState } from "@/types/api";

interface ReviewOverviewProps {
  report: AnalysisReport;
  repositoryId?: string;
  pullRequestId?: string;
}

function getReadinessBadge(readiness: ReadinessState) {
  switch (readiness) {
    case "safe":
      return {
        label: "RELEASE READY (SAFE)",
        bg: "bg-[#79D69A]/15",
        border: "border-[#79D69A]/40",
        text: "text-[#79D69A]",
        icon: ShieldCheck,
      };
    case "conditional":
      return {
        label: "CONDITIONAL RELEASE",
        bg: "bg-[#E9B96E]/15",
        border: "border-[#E9B96E]/40",
        text: "text-[#E9B96E]",
        icon: ShieldAlert,
      };
    case "unsafe":
      return {
        label: "RELEASE BLOCKED (UNSAFE)",
        bg: "bg-[#F07878]/15",
        border: "border-[#F07878]/40",
        text: "text-[#F07878]",
        icon: ShieldAlert,
      };
    default:
      return {
        label: "STATUS UNKNOWN",
        bg: "bg-[#1D221F]",
        border: "border-[#292E2A]",
        text: "text-[#A0A79F]",
        icon: ShieldAlert,
      };
  }
}

export const ReviewOverview = memo(function ReviewOverview({
  report,
  repositoryId = "",
  pullRequestId = "",
}: ReviewOverviewProps) {
  const readiness = getReadinessBadge(report.readiness);
  const ReadinessIcon = readiness.icon;

  // Severity counts based strictly on actual loaded findings
  const severityCounts = {
    critical: report.findings.filter((f) => f.severity === "critical").length,
    high: report.findings.filter((f) => f.severity === "high").length,
    medium: report.findings.filter((f) => f.severity === "medium").length,
    low: report.findings.filter((f) => f.severity === "low").length,
    info: report.findings.filter((f) => f.severity === "info").length,
  };

  return (
    <div className="p-6 bg-[#101211] border border-[#292E2A] rounded-[6px] space-y-6">
      {/* Top Bar: Readiness State, Pull Request context & Confidence Attribution */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] border ${readiness.bg} ${readiness.border} ${readiness.text} font-mono text-[10px] uppercase tracking-wider font-semibold`}
            >
              <ReadinessIcon size={13} />
              <span>{readiness.label}</span>
            </span>

            {repositoryId && (
              <span className="font-mono text-[11px] text-[#A0A79F]">
                {repositoryId}
              </span>
            )}

            {pullRequestId && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#6E776F]">
                <GitPullRequest size={12} />
                <span>PR #{pullRequestId}</span>
              </span>
            )}
          </div>

          <h1 className="font-display font-semibold text-[22px] sm:text-[26px] text-[#F0F2ED] tracking-[-0.02em]">
            Evidence-Backed AI Code Review
          </h1>
        </div>

        {/* Model & Analysis ID attribution */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3 py-1.5 rounded-[4px] bg-[#151816] border border-[#222724] flex items-center gap-2 font-mono text-[11px] text-[#A0A79F]">
            <Sparkles size={13} className="text-[#C7F36B]" />
            <span>Gemma 2 + AST Analysis</span>
          </div>
          <div className="px-3 py-1.5 rounded-[4px] bg-[#151816] border border-[#222724] font-mono text-[11px] text-[#6E776F]">
            Job #{report.jobId.slice(0, 12)}
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="p-4 rounded-[4px] bg-[#151816] border border-[#222724] space-y-1.5">
        <span className="font-mono text-[10px] tracking-wider uppercase text-[#C7F36B] font-semibold block">
          EXECUTIVE SUMMARY
        </span>
        <p className="font-body text-[13px] sm:text-[14px] leading-[1.6] text-[#F0F2ED]">
          {report.summary}
        </p>
      </div>

      {/* Metrics Row: Severity Breakdown & Trust Meter */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-2">
        {/* Severity Distribution */}
        <div className="md:col-span-7 space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#A0A79F] font-semibold block">
            FINDINGS SEVERITY DISTRIBUTION ({report.findings.length} TOTAL)
          </span>

          <div className="grid grid-cols-5 gap-2 font-mono text-center">
            <div className="p-2.5 rounded-[4px] bg-[#151816] border border-[#292E2A]">
              <span className="block text-[10px] uppercase text-[#F07878] font-semibold">
                Critical
              </span>
              <span className="block text-[18px] font-semibold text-[#F0F2ED] mt-0.5">
                {severityCounts.critical}
              </span>
            </div>

            <div className="p-2.5 rounded-[4px] bg-[#151816] border border-[#292E2A]">
              <span className="block text-[10px] uppercase text-[#F07878] font-semibold">
                High
              </span>
              <span className="block text-[18px] font-semibold text-[#F0F2ED] mt-0.5">
                {severityCounts.high}
              </span>
            </div>

            <div className="p-2.5 rounded-[4px] bg-[#151816] border border-[#292E2A]">
              <span className="block text-[10px] uppercase text-[#E9B96E] font-semibold">
                Medium
              </span>
              <span className="block text-[18px] font-semibold text-[#F0F2ED] mt-0.5">
                {severityCounts.medium}
              </span>
            </div>

            <div className="p-2.5 rounded-[4px] bg-[#151816] border border-[#292E2A]">
              <span className="block text-[10px] uppercase text-[#79D69A] font-semibold">
                Low
              </span>
              <span className="block text-[18px] font-semibold text-[#F0F2ED] mt-0.5">
                {severityCounts.low}
              </span>
            </div>

            <div className="p-2.5 rounded-[4px] bg-[#151816] border border-[#292E2A]">
              <span className="block text-[10px] uppercase text-[#84C2F5] font-semibold">
                Info
              </span>
              <span className="block text-[18px] font-semibold text-[#F0F2ED] mt-0.5">
                {severityCounts.info}
              </span>
            </div>
          </div>
        </div>

        {/* Trust Meter & Claims Verification */}
        <div className="md:col-span-5 space-y-2">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[#A0A79F] font-semibold">
            <span>GROUNDED TRUST METER</span>
            <span className="text-[#C7F36B]">{report.trustMeter}% SCORE</span>
          </div>

          <div className="p-3 bg-[#151816] border border-[#292E2A] rounded-[4px] space-y-2.5">
            {/* Progress Bar */}
            <div className="w-full h-2 bg-[#1B201C] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#79D69A] to-[#C7F36B] transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(0, report.trustMeter))}%` }}
              />
            </div>

            <div className="flex items-center justify-between font-mono text-[11px]">
              <div className="flex items-center gap-1.5 text-[#79D69A]">
                <CheckCircle2 size={13} />
                <span>{report.claimsVerified} Claims Verified</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#A0A79F]">
                <XCircle size={13} className="text-[#6E776F]" />
                <span>{report.claimsRejected} Claims Rejected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
