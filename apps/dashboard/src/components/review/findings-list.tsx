"use client";

import { memo, useEffect } from "react";
import {
  FileCode2,
  Sparkles,
  Cpu,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import type { Finding } from "@/types/api";

interface FindingsListProps {
  findings: Finding[];
  selectedFindingId: string | null;
  onSelectFinding: (findingId: string) => void;
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

export const FindingsList = memo(function FindingsList({
  findings,
  selectedFindingId,
  onSelectFinding,
}: FindingsListProps) {
  // Keyboard navigation support: 'j' for next, 'k' for previous
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "SELECT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const currentIndex = findings.findIndex(
          (f) => f.id === selectedFindingId
        );
        if (currentIndex < findings.length - 1) {
          onSelectFinding(findings[currentIndex + 1].id);
        }
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIndex = findings.findIndex(
          (f) => f.id === selectedFindingId
        );
        if (currentIndex > 0) {
          onSelectFinding(findings[currentIndex - 1].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [findings, selectedFindingId, onSelectFinding]);

  if (findings.length === 0) {
    return (
      <div className="p-8 bg-[#101211] border border-[#292E2A] rounded-[6px] text-center space-y-2">
        <AlertCircle size={20} className="text-[#6E776F] mx-auto" />
        <h3 className="font-mono text-[13px] font-semibold text-[#F0F2ED]">
          No Matching Findings
        </h3>
        <p className="font-body text-[12px] text-[#A0A79F] max-w-[340px] mx-auto">
          No findings match the current search or severity filter criteria. Try clearing filters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {findings.map((finding) => {
        const isSelected = finding.id === selectedFindingId;

        return (
          <button
            key={finding.id}
            type="button"
            onClick={() => onSelectFinding(finding.id)}
            className={`w-full p-4 text-left rounded-[6px] border transition-all cursor-pointer ${
              isSelected
                ? "bg-[#181D19] border-[#C7F36B] shadow-[0_0_15px_rgba(199,243,107,0.15)] ring-1 ring-[#C7F36B]"
                : "bg-[#101211] border-[#292E2A] hover:bg-[#151816] hover:border-[#3E4540]"
            }`}
          >
            {/* Top Row: Severity, Origin, and Confidence */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-[9px] uppercase px-2 py-0.5 rounded-[2px] border font-semibold ${getSeverityBadge(
                    finding.severity
                  )}`}
                >
                  {finding.severity}
                </span>

                <span className="font-mono text-[10px] text-[#A0A79F] flex items-center gap-1">
                  {finding.origin === "gemma" ? (
                    <>
                      <Sparkles size={11} className="text-[#C7F36B]" />
                      <span>Gemma AI</span>
                    </>
                  ) : (
                    <>
                      <Cpu size={11} className="text-[#79D69A]" />
                      <span>AST Analysis</span>
                    </>
                  )}
                </span>
              </div>

              <span className="font-mono text-[10px] text-[#6E776F]">
                {finding.confidence} Confidence
              </span>
            </div>

            {/* Title */}
            <h3 className="font-display font-semibold text-[15px] text-[#F0F2ED] line-clamp-2">
              {finding.title}
            </h3>

            {/* Description excerpt */}
            <p className="mt-1 font-body text-[12px] text-[#A0A79F] line-clamp-2 leading-[1.5]">
              {finding.description}
            </p>

            {/* Footer File reference and evidence counts */}
            <div className="mt-3 pt-2 border-t border-[#1D221F] flex items-center justify-between font-mono text-[10px] text-[#6E776F]">
              <div className="flex items-center gap-1.5 truncate max-w-[260px]">
                <FileCode2 size={12} className="text-[#A0A79F] shrink-0" />
                <span className="truncate">{finding.file || "unknown file"}</span>
                {finding.line && <span>:{finding.line}</span>}
              </div>

              <div className="flex items-center gap-1 text-[#A0A79F] shrink-0">
                <span>{finding.evidenceIds.length} Evidence</span>
                <ChevronRight size={13} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
});

