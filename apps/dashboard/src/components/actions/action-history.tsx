"use client";

import { useState, memo } from "react";
import type { ActionRecord, ActionExecutionStatus } from "@/types/actions";
import {
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  History,
  ShieldAlert,
} from "lucide-react";

interface ActionHistoryProps {
  records: ActionRecord[];
  isBackendConnected: boolean;
  isFixturePreview?: boolean;
}

function getStatusBadge(status: ActionExecutionStatus) {
  switch (status) {
    case "completed":
      return {
        label: "COMPLETED",
        className: "bg-[#79D69A]/15 text-[#79D69A] border-[#79D69A]/30",
        icon: CheckCircle2,
      };
    case "failed":
      return {
        label: "FAILED",
        className: "bg-[#F07878]/15 text-[#F07878] border-[#F07878]/30",
        icon: XCircle,
      };
    case "running":
      return {
        label: "RUNNING",
        className: "bg-[#C7F36B]/15 text-[#C7F36B] border-[#C7F36B]/30",
        icon: RotateCcw,
      };
    case "awaiting_approval":
      return {
        label: "AWAITING APPROVAL",
        className: "bg-[#E9B96E]/15 text-[#E9B96E] border-[#E9B96E]/30",
        icon: ShieldAlert,
      };
    default:
      return {
        label: status.toUpperCase(),
        className: "bg-[#1D221F] text-[#A0A79F] border-[#292E2A]",
        icon: Clock,
      };
  }
}

export const ActionHistory = memo(function ActionHistory({
  records,
  isBackendConnected,
  isFixturePreview = false,
}: ActionHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredRecords = records.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="rounded-xl border border-[#292E2A] bg-[#101211] p-5 space-y-4">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#1D221F] gap-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[#A0A79F]" />
          <h3 className="font-mono text-[13px] font-semibold text-[#F0F2ED] uppercase tracking-wider">
            Execution Audit Trail
          </h3>
          <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-[#1D221F] text-[#A0A79F]">
            {records.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="font-mono text-[11px] bg-[#151816] border border-[#292E2A] text-[#A0A79F] rounded px-2.5 py-1 focus:outline-none focus:border-[#C7F36B]"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
            <option value="awaiting_approval">Awaiting Approval</option>
          </select>
        </div>
      </div>

      {!isBackendConnected && !isFixturePreview ? (
        <div className="py-8 text-center">
          <History className="h-8 w-8 text-[#3E4540] mx-auto mb-2" />
          <p className="font-mono text-[13px] text-[#A0A79F]">
            Execution history unavailable
          </p>
          <p className="font-body text-[12px] text-[#6E776F] mt-1 max-w-sm mx-auto">
            Action execution persistence requires connected backend services from Builder 2.
          </p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="py-8 text-center font-mono text-[12px] text-[#6E776F]">
          No action execution records found matching filter.
        </div>
      ) : (
        <div className="divide-y divide-[#1D221F]">
          {filteredRecords.map((record) => {
            const badge = getStatusBadge(record.status);
            const Icon = badge.icon;
            const isExpanded = expandedId === record.id;

            return (
              <div key={record.id} className="py-3.5 space-y-2">
                <div
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono font-medium ${badge.className}`}
                    >
                      <Icon className="h-3 w-3" />
                      {badge.label}
                    </span>
                    <span className="font-mono text-[13px] font-semibold text-[#F0F2ED] group-hover:text-[#C7F36B] transition-colors">
                      {record.name}
                    </span>
                    <span className="font-mono text-[11px] text-[#6E776F]">
                      ({record.target})
                    </span>
                  </div>

                  <div className="flex items-center gap-4 font-mono text-[11px] text-[#80887F]">
                    {record.durationMs && (
                      <span>{(record.durationMs / 1000).toFixed(1)}s</span>
                    )}
                    <span>{new Date(record.requestedAt).toLocaleTimeString()}</span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-[#A0A79F]" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-[#A0A79F]" />
                    )}
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="p-3.5 mt-2 rounded bg-[#0A0C0B] border border-[#1D221F] space-y-2.5 font-mono text-[11px]">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#80887F]">
                      <div>
                        <span className="text-[#A0A79F]">Execution ID: </span>
                        {record.id}
                      </div>
                      <div>
                        <span className="text-[#A0A79F]">Requested By: </span>
                        {record.requestedBy}
                      </div>
                      <div>
                        <span className="text-[#A0A79F]">Timestamp: </span>
                        {record.requestedAt}
                      </div>
                      {record.approvedAt && (
                        <div>
                          <span className="text-[#A0A79F]">Approved At: </span>
                          {record.approvedAt}
                        </div>
                      )}
                    </div>

                    {record.error && (
                      <div className="p-2.5 rounded bg-[#F07878]/10 border border-[#F07878]/30 text-[#F07878]">
                        <span className="font-semibold">Error: </span>
                        {record.error}
                      </div>
                    )}

                    {record.output ? (
                      <div>
                        <span className="text-[#A0A79F] block mb-1">Output Payload:</span>
                        <pre className="p-2 rounded bg-[#101211] border border-[#1D221F] text-[#79D69A] overflow-x-auto text-[10px]">
                          {typeof record.output === "string"
                            ? record.output
                            : JSON.stringify(record.output, null, 2)}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
