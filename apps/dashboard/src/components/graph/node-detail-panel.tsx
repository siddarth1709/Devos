"use client";

import { memo } from "react";
import Link from "next/link";
import {
  X,
  FileCode2,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Flame,
  CheckCircle2,
} from "lucide-react";
import type { SymbolNodeData } from "@/lib/graph-transform";
import type { Finding } from "@/types/api";

interface NodeDetailPanelProps {
  nodeData: SymbolNodeData | null;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  incomingNodes: { id: string; name: string; kind: string }[];
  outgoingNodes: { id: string; name: string; kind: string }[];
  relatedFindings?: Finding[];
  repositoryId?: string;
  pullRequestId?: string;
}

export const NodeDetailPanel = memo(function NodeDetailPanel({
  nodeData,
  onClose,
  onSelectNode,
  incomingNodes,
  outgoingNodes,
  relatedFindings = [],
  repositoryId = "",
  pullRequestId = "",
}: NodeDetailPanelProps) {
  if (!nodeData) return null;

  const isChanged =
    nodeData.changeStatus !== "unchanged" || nodeData.impactStatus === "root_cause";
  const isImpacted = nodeData.impactStatus === "impacted";

  return (
    <div className="w-full lg:w-[360px] bg-[#101211] border-l border-[#292E2A] flex flex-col h-full overflow-hidden shadow-2xl z-20">
      {/* Panel Header */}
      <div className="p-4 border-b border-[#1D221F] bg-[#151816] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-[#1D221F] text-[#C7F36B]">
            <FileCode2 size={15} />
          </div>
          <div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#A0A79F] font-semibold block">
              SYMBOL INSPECTOR
            </span>
            <span className="font-mono text-[11px] font-semibold text-[#F0F2ED]">
              {nodeData.kind.toUpperCase()}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-[#A0A79F] hover:text-[#F0F2ED] rounded hover:bg-[#1D221F] transition-colors"
          title="Close panel"
        >
          <X size={15} />
        </button>
      </div>

      {/* Panel Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Symbol Name & Badges */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            {isChanged ? (
              <span className="px-2 py-0.5 rounded-[2px] bg-[#C7F36B]/15 border border-[#C7F36B]/40 text-[#C7F36B] font-mono text-[9px] uppercase tracking-wider font-semibold">
                ROOT REPOSITORY CHANGE
              </span>
            ) : isImpacted ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#E9B96E]/15 border border-[#E9B96E]/40 text-[#E9B96E] font-mono text-[9px] uppercase tracking-wider font-semibold">
                <AlertTriangle size={11} />
                <span>DOWNSTREAM IMPACTED</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#181D19] border border-[#292E2A] text-[#79D69A] font-mono text-[9px] uppercase tracking-wider font-semibold">
                <CheckCircle2 size={11} />
                <span>UNCHANGED ANCHOR</span>
              </span>
            )}
          </div>

          <h2 className="font-mono font-semibold text-[17px] text-[#F0F2ED] break-all">
            {nodeData.name}
          </h2>

          <div className="mt-1 font-mono text-[11px] text-[#6E776F] break-all">
            {nodeData.file}:{nodeData.lineStart}–{nodeData.lineEnd}
          </div>
        </div>

        {/* Action: Open in Diff Viewer */}
        {repositoryId && pullRequestId && (
          <Link
            href={`/app/repositories/${encodeURIComponent(
              repositoryId
            )}/pulls/${encodeURIComponent(pullRequestId)}?path=${encodeURIComponent(
              nodeData.file
            )}`}
            className="w-full p-2.5 rounded-[4px] bg-[#151816] border border-[#292E2A] hover:border-[#C7F36B] text-[#F0F2ED] font-mono text-[11px] flex items-center justify-between transition-colors group"
          >
            <div className="flex items-center gap-2 text-[#A0A79F] group-hover:text-[#F0F2ED]">
              <ExternalLink size={13} className="text-[#C7F36B]" />
              <span>Open in PR Source Diff</span>
            </div>
            <span className="text-[#6E776F] group-hover:text-[#C7F36B]">&rarr;</span>
          </Link>
        )}

        {/* Blast Radius Context Card */}
        <div className="p-3 bg-[#151816] border border-[#222724] rounded-[4px] space-y-2">
          <div className="flex items-center gap-1.5 text-[#E9B96E] font-mono text-[10px] font-semibold uppercase tracking-wider">
            <Flame size={12} />
            <span>Downstream Blast Radius</span>
          </div>
          <p className="font-body text-[12px] text-[#A0A79F] leading-[1.6]">
            {isChanged
              ? "Directly modified in this pull request. Potential ripple effects through its outgoing call sites and importers."
              : isImpacted
              ? "Not modified directly, but depends on modified upstream symbols. At risk of regression."
              : "Stable repository anchor with zero detected blast radius in this analysis."}
          </p>
        </div>

        {/* Related Review Findings */}
        {relatedFindings.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#A0A79F] font-semibold flex items-center gap-1">
                <Sparkles size={12} className="text-[#C7F36B]" />
                <span>AI REVIEW FINDINGS ({relatedFindings.length})</span>
              </span>
            </div>

            <div className="space-y-2">
              {relatedFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="p-3 bg-[#151816] border border-[#292E2A] rounded-[4px] space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-mono text-[9px] uppercase px-1.5 py-0.5 rounded-[2px] font-semibold ${
                        finding.severity === "critical" || finding.severity === "high"
                          ? "bg-[#F07878]/15 border border-[#F07878]/40 text-[#F07878]"
                          : finding.severity === "medium"
                          ? "bg-[#E9B96E]/15 border border-[#E9B96E]/40 text-[#E9B96E]"
                          : "bg-[#79D69A]/15 border border-[#79D69A]/40 text-[#79D69A]"
                      }`}
                    >
                      {finding.severity}
                    </span>
                    <span className="font-mono text-[9px] text-[#6E776F]">
                      {finding.confidence} Confidence
                    </span>
                  </div>

                  <h3 className="font-mono text-[12px] font-semibold text-[#F0F2ED] line-clamp-2">
                    {finding.title}
                  </h3>

                  <p className="font-body text-[11px] text-[#A0A79F] line-clamp-2">
                    {finding.description}
                  </p>

                  <Link
                    href={`/app/review?repo=${encodeURIComponent(
                      repositoryId
                    )}&pr=${encodeURIComponent(pullRequestId)}&findingId=${encodeURIComponent(
                      finding.id
                    )}`}
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-[#C7F36B] hover:underline pt-1"
                  >
                    <span>Inspect in Review Console</span>
                    <span>&rarr;</span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Incoming Dependencies (Callers / Importers) */}
        <div className="space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#A0A79F] font-semibold flex items-center gap-1">
            <ArrowLeft size={12} className="text-[#84C2F5]" />
            <span>INCOMING DEPENDENCIES ({incomingNodes.length})</span>
          </span>

          {incomingNodes.length > 0 ? (
            <div className="space-y-1 max-h-[140px] overflow-y-auto">
              {incomingNodes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectNode(item.id)}
                  className="w-full p-2 bg-[#151816] hover:bg-[#1B201C] border border-[#222724] rounded-[3px] text-left flex items-center justify-between font-mono text-[11px] text-[#F0F2ED] transition-colors"
                >
                  <span className="truncate">{item.name}</span>
                  <span className="text-[9px] text-[#6E776F] uppercase">
                    {item.kind}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-[#151816] rounded border border-[#222724] text-center font-mono text-[10px] text-[#6E776F]">
              No incoming callers detected
            </div>
          )}
        </div>

        {/* Outgoing Dependencies (Callees / Dependencies) */}
        <div className="space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#A0A79F] font-semibold flex items-center gap-1">
            <ArrowRight size={12} className="text-[#C7F36B]" />
            <span>OUTGOING DEPENDENCIES ({outgoingNodes.length})</span>
          </span>

          {outgoingNodes.length > 0 ? (
            <div className="space-y-1 max-h-[140px] overflow-y-auto">
              {outgoingNodes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectNode(item.id)}
                  className="w-full p-2 bg-[#151816] hover:bg-[#1B201C] border border-[#222724] rounded-[3px] text-left flex items-center justify-between font-mono text-[11px] text-[#F0F2ED] transition-colors"
                >
                  <span className="truncate">{item.name}</span>
                  <span className="text-[9px] text-[#6E776F] uppercase">
                    {item.kind}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-[#151816] rounded border border-[#222724] text-center font-mono text-[10px] text-[#6E776F]">
              No outgoing dependencies detected
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

