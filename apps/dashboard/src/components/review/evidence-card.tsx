"use client";

import { useState, memo } from "react";
import {
  FileText,
  GitCommit,
  Clock,
  ChevronDown,
  ChevronUp,
  Cpu,
  CheckCircle2,
} from "lucide-react";
import type { Evidence } from "@/types/api";

interface EvidenceCardProps {
  evidence: Evidence;
}

export const EvidenceCard = memo(function EvidenceCard({
  evidence,
}: EvidenceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formattedPayload =
    typeof evidence.payload === "string"
      ? evidence.payload
      : JSON.stringify(evidence.payload, null, 2);

  return (
    <div className="p-3.5 bg-[#151816] border border-[#292E2A] rounded-[4px] space-y-2.5 transition-colors hover:border-[#3E4540]">
      {/* Header: Evidence Type, ID, and Collector */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-[2px] bg-[#C7F36B]/15 border border-[#C7F36B]/30 text-[#C7F36B] font-mono text-[9px] uppercase tracking-wider font-semibold">
            {evidence.type}
          </span>
          <span className="font-mono text-[11px] text-[#A0A79F] font-semibold">
            #{evidence.id}
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#6E776F]">
          <Cpu size={11} />
          <span>{evidence.collector}</span>
        </div>
      </div>

      {/* Target File & Lines */}
      <div className="flex items-center gap-2 font-mono text-[11px] text-[#F0F2ED]">
        <FileText size={13} className="text-[#A0A79F]" />
        <span className="truncate">{evidence.file}</span>
        {evidence.lineStart && (
          <span className="text-[#A0A79F]">
            :{evidence.lineStart}
            {evidence.lineEnd && `–${evidence.lineEnd}`}
          </span>
        )}
      </div>

      {/* Source commit & Timestamp */}
      <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-[#6E776F]">
        <div className="flex items-center gap-1">
          <GitCommit size={11} />
          <span>{evidence.sourceCommit.slice(0, 8)}</span>
        </div>
        <span>•</span>
        <div className="flex items-center gap-1">
          <Clock size={11} />
          <span>{new Date(evidence.collectedAt).toLocaleTimeString()}</span>
        </div>
        <span>•</span>
        <div className="flex items-center gap-1 text-[#79D69A]">
          <CheckCircle2 size={11} />
          <span>Grounded AST Trace</span>
        </div>
      </div>

      {/* Expandable Excerpt / Payload */}
      {formattedPayload && (
        <div className="pt-2 border-t border-[#1D221F]">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between font-mono text-[10px] text-[#A0A79F] hover:text-[#F0F2ED] transition-colors"
          >
            <span>{isExpanded ? "Collapse Artifact Excerpt" : "View Artifact Excerpt"}</span>
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {isExpanded && (
            <pre className="mt-2 p-2.5 rounded bg-[#090A0A] border border-[#1D221F] font-mono text-[11px] text-[#A0A79F] overflow-x-auto whitespace-pre-wrap leading-[1.5]">
              {formattedPayload}
            </pre>
          )}
        </div>
      )}
    </div>
  );
});
