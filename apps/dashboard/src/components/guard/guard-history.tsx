"use client";

import React from "react";
import type { GuardHistoricalRun } from "@/types/guard";
import type { ReadinessState } from "@/types/api";
import { GitCommit, History, AlertTriangle, ShieldCheck, ShieldAlert, HelpCircle } from "lucide-react";

interface GuardHistoryProps {
  history: GuardHistoricalRun[];
  isBackendConnected: boolean;
  isFixturePreview?: boolean;
}

const READINESS_BADGES: Record<
  ReadinessState,
  { label: string; badgeClass: string; icon: React.ReactNode }
> = {
  safe: {
    label: "Safe to Ship",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  conditional: {
    label: "Conditional",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  unsafe: {
    label: "Unsafe",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    icon: <ShieldAlert className="h-3 w-3" />,
  },
  unknown: {
    label: "Unknown",
    badgeClass: "bg-neutral-500/10 text-neutral-400 border-neutral-700",
    icon: <HelpCircle className="h-3 w-3" />,
  },
};

export function GuardHistory({
  history,
  isBackendConnected,
  isFixturePreview = false,
}: GuardHistoryProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
      <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-neutral-400" />
          <h3 className="text-sm font-semibold text-neutral-200">Evaluation History</h3>
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
            {history.length}
          </span>
        </div>
        {isFixturePreview && (
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
            Fixture Preview
          </span>
        )}
      </div>

      {!isBackendConnected && !isFixturePreview ? (
        <div className="py-8 text-center">
          <History className="h-8 w-8 text-neutral-600 mx-auto mb-2" />
          <p className="text-sm text-neutral-400">Historical runs unavailable</p>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
            Evaluation persistence endpoint is pending backend contract fulfillment. Historical audits will be displayed once the Builder 2 persistence service is connected.
          </p>
        </div>
      ) : history.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-neutral-400">No evaluation runs recorded yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-800/60 mt-2">
          {history.map((run) => {
            const badge = READINESS_BADGES[run.readiness] || READINESS_BADGES.unknown;
            return (
              <div
                key={run.runId}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium ${badge.badgeClass}`}
                  >
                    {badge.icon}
                    {badge.label}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-neutral-400">
                    <GitCommit className="h-3.5 w-3.5 text-neutral-500" />
                    <span>{run.revision.slice(0, 7)}</span>
                  </div>
                  <span className="text-neutral-500">{run.timestamp}</span>
                </div>

                <div className="flex items-center gap-4 text-neutral-400">
                  <span className={run.blockerCount > 0 ? "text-rose-400 font-medium" : ""}>
                    {run.blockerCount} blocker{run.blockerCount === 1 ? "" : "s"}
                  </span>
                  <span className={run.warningCount > 0 ? "text-amber-400 font-medium" : ""}>
                    {run.warningCount} warning{run.warningCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
