"use client";

import { memo } from "react";
import Link from "next/link";
import {
  X,
  FileCode2,
  ExternalLink,
  Sparkles,
  Network,
  Layers,
  Wrench,
  ShieldAlert,
} from "lucide-react";
import type { Finding, Evidence } from "@/types/api";
import { EvidenceCard } from "./evidence-card";

interface FindingDetailPanelProps {
  finding: Finding | null;
  onClose: () => void;
  evidences?: Evidence[];
  repositoryId?: string;
  pullRequestId?: string;
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "critical":
    case "high":
      return "bg-[#F07878]/15 border-[#F07878]/40 text-[#F07878]";
    case "medium":
      return "bg-[#E9B96E]/15 border-[#E9B96E]/40 text-[#E9B96E]";
    case "low":
      return "bg-[#79D69A]/15 border-[#79D69A]/40 text-[#79D69A]";
    default:
      return "bg-[#84C2F5]/15 border-[#84C2F5]/40 text-[#84C2F5]";
  }
}

export const FindingDetailPanel = memo(function FindingDetailPanel({
  finding,
  onClose,
  evidences = [],
  repositoryId = "",
  pullRequestId = "",
}: FindingDetailPanelProps) {
  if (!finding) return null;

  // Filter evidences associated with this finding
  const findingEvidences = evidences.filter((ev) =>
    finding.evidenceIds.includes(ev.id)
  );

  return (
    <div className="w-full bg-[#101211] border border-[#292E2A] rounded-[6px] overflow-hidden flex flex-col h-full shadow-2xl">
      {/* Header */}
      <div className="p-4 bg-[#151816] border-b border-[#1D221F] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-[9px] uppercase px-2 py-0.5 rounded-[2px] border font-semibold ${getSeverityBadge(
              finding.severity
            )}`}
          >
            {finding.severity}
          </span>
          <span className="font-mono text-[10px] text-[#A0A79F]">
            Finding #{finding.id}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 text-[#A0A79F] hover:text-[#F0F2ED] rounded hover:bg-[#1D221F] transition-colors"
          title="Close detail panel"
        >
          <X size={15} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Title & Metadata Badges */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2 font-mono text-[10px]">
            <span className="px-2 py-0.5 rounded-[2px] bg-[#1D221F] text-[#A0A79F] border border-[#292E2A] flex items-center gap-1">
              <Sparkles size={11} className="text-[#C7F36B]" />
              <span>{finding.origin === "gemma" ? "Gemma 2 LLM" : "Deterministic AST"}</span>
            </span>

            <span className="px-2 py-0.5 rounded-[2px] bg-[#1D221F] text-[#A0A79F] border border-[#292E2A]">
              Status: <strong className="text-[#F0F2ED] uppercase">{finding.status}</strong>
            </span>

            <span className="px-2 py-0.5 rounded-[2px] bg-[#1D221F] text-[#A0A79F] border border-[#292E2A]">
              Confidence: <strong className="text-[#C7F36B]">{finding.confidence}</strong>
            </span>
          </div>

          <h2 className="font-display font-semibold text-[20px] text-[#F0F2ED] tracking-[-0.01em]">
            {finding.title}
          </h2>
        </div>

        {/* Source File Location with direct Link to PR Diff */}
        {finding.file && (
          <div className="p-3 bg-[#151816] border border-[#292E2A] rounded-[4px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-[11px]">
            <div className="flex items-center gap-2 text-[#F0F2ED] min-w-0">
              <FileCode2 size={14} className="text-[#A0A79F] shrink-0" />
              <span className="truncate">{finding.file}</span>
              {finding.line && <span className="text-[#C7F36B]">:{finding.line}</span>}
            </div>

            {repositoryId && pullRequestId && (
              <Link
                href={`/app/repositories/${encodeURIComponent(
                  repositoryId
                )}/pulls/${encodeURIComponent(pullRequestId)}?path=${encodeURIComponent(
                  finding.file
                )}`}
                className="inline-flex items-center gap-1 text-[#C7F36B] hover:underline shrink-0"
              >
                <span>Jump to Source Diff</span>
                <ExternalLink size={12} />
              </Link>
            )}
          </div>
        )}

        {/* Cross-Feature Action: Open in Dependency Graph */}
        <div className="p-3.5 rounded-[4px] bg-[#151816] border border-[#3A4338] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-[#1D221F] text-[#C7F36B]">
              <Network size={16} />
            </div>
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#A0A79F] font-semibold block">
                DEPENDENCY IMPACT
              </span>
              <span className="font-mono text-[12px] text-[#F0F2ED]">
                Inspect affected symbols in Engineering Graph
              </span>
            </div>
          </div>

          <Link
            href={`/app/graph?repo=${encodeURIComponent(
              repositoryId
            )}&pr=${encodeURIComponent(pullRequestId)}${
              finding.symbol ? `&focusNode=${encodeURIComponent(finding.symbol)}` : ""
            }`}
            className="px-3.5 py-1.5 bg-[#C7F36B] text-[#090A0A] font-mono text-[11px] font-semibold uppercase tracking-wider rounded-[3px] hover:bg-[#D7FF86] transition-colors shrink-0 flex items-center gap-1.5"
          >
            <span>Open Graph</span>
            <span>&rarr;</span>
          </Link>
        </div>

        {/* Detailed Explanation */}
        <div className="space-y-2">
          <span className="font-mono text-[10px] tracking-wider uppercase text-[#A0A79F] font-semibold block">
            DETAILED EXPLANATION
          </span>
          <p className="font-body text-[13px] sm:text-[14px] leading-[1.7] text-[#F0F2ED]">
            {finding.description}
          </p>
        </div>

        {/* Why it Matters / Architectural Impact */}
        {finding.architecturalImpact && (
          <div className="p-4 rounded-[4px] bg-[#181612] border border-[#443522] space-y-1.5">
            <div className="flex items-center gap-1.5 text-[#E9B96E] font-mono text-[10px] uppercase tracking-wider font-semibold">
              <ShieldAlert size={12} />
              <span>Architectural Impact & Regression Risk</span>
            </div>
            <p className="font-body text-[13px] text-[#A0A79F] leading-[1.6]">
              {finding.architecturalImpact}
            </p>
          </div>
        )}

        {/* Confidence Rationale */}
        {finding.rationale && (
          <div className="space-y-1.5">
            <span className="font-mono text-[10px] tracking-wider uppercase text-[#A0A79F] font-semibold block">
              CONFIDENCE RATIONALE
            </span>
            <p className="font-body text-[12px] text-[#A0A79F] leading-[1.6]">
              {finding.rationale}
            </p>
          </div>
        )}

        {/* Suggested Remediation */}
        {finding.remediation && (
          <div className="space-y-2">
            <span className="font-mono text-[10px] tracking-wider uppercase text-[#79D69A] font-semibold flex items-center gap-1.5">
              <Wrench size={12} />
              <span>RECOMMENDED REMEDIATION</span>
            </span>
            <pre className="p-3 bg-[#151816] border border-[#222724] rounded-[4px] font-mono text-[12px] text-[#79D69A] overflow-x-auto whitespace-pre-wrap leading-[1.5]">
              {finding.remediation}
            </pre>
          </div>
        )}

        {/* Supporting Evidence Artifacts */}
        <div className="space-y-2.5">
          <span className="font-mono text-[10px] tracking-wider uppercase text-[#A0A79F] font-semibold flex items-center gap-1.5">
            <Layers size={12} className="text-[#C7F36B]" />
            <span>SUPPORTING EVIDENCE ({findingEvidences.length} ARTIFACTS)</span>
          </span>

          {findingEvidences.length > 0 ? (
            <div className="space-y-2.5">
              {findingEvidences.map((ev) => (
                <EvidenceCard key={ev.id} evidence={ev} />
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-[4px] bg-[#151816] border border-[#222724] text-center font-mono text-[11px] text-[#6E776F]">
              No direct AST trace artifacts attached to this finding.
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
