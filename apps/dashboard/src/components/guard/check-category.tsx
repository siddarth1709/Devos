"use client";

import { memo } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import type { GuardCheck, GuardCategoryKey, CheckStatus } from "@/types/guard";

interface CheckCategoryProps {
  categoryKey: GuardCategoryKey;
  title: string;
  checks: GuardCheck[];
  repositoryId?: string;
  pullRequestId?: string;
}

function getStatusBadge(status: CheckStatus) {
  switch (status) {
    case "passed":
      return {
        label: "PASSED",
        className: "bg-[#79D69A]/15 border-[#79D69A]/40 text-[#79D69A]",
        icon: CheckCircle2,
      };
    case "failed":
      return {
        label: "FAILED",
        className: "bg-[#F07878]/15 border-[#F07878]/40 text-[#F07878]",
        icon: XCircle,
      };
    case "warning":
      return {
        label: "WARNING",
        className: "bg-[#E9B96E]/15 border-[#E9B96E]/40 text-[#E9B96E]",
        icon: AlertTriangle,
      };
    case "not_run":
      return {
        label: "NOT RUN",
        className: "bg-[#1D221F] border-[#292E2A] text-[#A0A79F]",
        icon: Clock,
      };
    default:
      return {
        label: "UNAVAILABLE",
        className: "bg-[#151816] border-[#222724] text-[#6E776F]",
        icon: HelpCircle,
      };
  }
}

export const CATEGORY_METADATA: Record<
  GuardCategoryKey,
  { title: string; description: string }
> = {
  change_integrity: {
    title: "Change Integrity",
    description: "Evaluates branch drift, uncommitted diffs, and AST symbol mapping.",
  },
  code_quality: {
    title: "Code Quality & Static Analysis",
    description: "Evaluates AI review findings, AST smells, and type checking.",
  },
  test_health: {
    title: "Test Health & Coverage",
    description: "Evaluates blast radius test coverage and regression suites.",
  },
  dependency_health: {
    title: "Dependency & Architecture Health",
    description: "Evaluates cyclic dependencies, boundary violations, and package freshness.",
  },
  runtime_configuration: {
    title: "Runtime & Configuration",
    description: "Evaluates environment variable declarations and migration safety.",
  },
  review_integrity: {
    title: "Review Integrity",
    description: "Evaluates grounded evidence links and reviewer approvals.",
  },
};

interface CheckCategorySectionProps {
  checks: GuardCheck[];
  repositoryId?: string;
  pullRequestId?: string;
}

export const CheckCategorySection = memo(function CheckCategorySection({
  checks,
  repositoryId = "",
  pullRequestId = "",
}: CheckCategorySectionProps) {
  const categories: GuardCategoryKey[] = [
    "change_integrity",
    "code_quality",
    "test_health",
    "dependency_health",
    "runtime_configuration",
    "review_integrity",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[12px] font-semibold text-[#F0F2ED] uppercase tracking-wider">
          Verification Check Categories
        </h3>
        <span className="font-mono text-[11px] text-[#A0A79F]">
          {checks.filter((c) => c.status === "passed").length} / {checks.length} Passing
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((catKey) => {
          const categoryChecks = checks.filter((c) => c.category === catKey);
          return (
            <CheckCategory
              key={catKey}
              categoryKey={catKey}
              title={CATEGORY_METADATA[catKey].title}
              checks={categoryChecks}
              repositoryId={repositoryId}
              pullRequestId={pullRequestId}
            />
          );
        })}
      </div>
    </div>
  );
});

export const CheckCategory = memo(function CheckCategory({
  title,
  checks,
  repositoryId = "",
  pullRequestId = "",
}: CheckCategoryProps) {
  return (
    <div className="p-5 bg-[#101211] border border-[#292E2A] rounded-[6px] space-y-4">
      {/* Category Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#1D221F]">
        <h4 className="font-mono text-[11px] font-semibold text-[#F0F2ED] uppercase tracking-wider">
          {title}
        </h4>
        <span className="font-mono text-[10px] text-[#6E776F]">
          {checks.length} {checks.length === 1 ? "check" : "checks"}
        </span>
      </div>

      {/* Checks List */}
      <div className="space-y-2.5">
        {checks.map((check) => {
          const badge = getStatusBadge(check.status);
          const BadgeIcon = badge.icon;

          return (
            <div
              key={check.id}
              className="p-3.5 bg-[#151816] border border-[#222724] rounded-[4px] space-y-2 transition-colors hover:border-[#2E3530]"
            >
              {/* Top Row: Check name & Status Pill */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BadgeIcon size={14} className={badge.className.split(" ").pop()} />
                  <span className="font-mono text-[12px] font-semibold text-[#F0F2ED]">
                    {check.name}
                  </span>
                </div>

                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] border font-mono text-[9px] uppercase font-semibold ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>

              {/* Description */}
              <p className="font-body text-[12px] text-[#A0A79F] leading-[1.5]">
                {check.description}
              </p>

              {/* Footer Metadata & Inspector Link */}
              <div className="pt-2 border-t border-[#1D221F] flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-[#6E776F]">
                <div className="flex items-center gap-3">
                  {check.evidenceSource && (
                    <span>Source: {check.evidenceSource}</span>
                  )}
                  {check.lastExecutedAt && (
                    <span>
                      Run: {new Date(check.lastExecutedAt).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {check.findingId && (
                  <Link
                    href={`/app/review?repo=${encodeURIComponent(
                      repositoryId
                    )}&pr=${encodeURIComponent(pullRequestId)}&findingId=${encodeURIComponent(
                      check.findingId
                    )}`}
                    className="inline-flex items-center gap-1 text-[#C7F36B] hover:underline"
                  >
                    <span>Inspect Finding</span>
                    <ArrowRight size={10} />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
