"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { SymbolNodeData } from "@/lib/graph-transform";
import {
  Code2,
  Box,
  Braces,
  Variable,
  FileCode2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
} from "lucide-react";

function getKindIcon(kind: string) {
  switch (kind) {
    case "function":
      return <Braces size={13} className="text-[#C7F36B]" />;
    case "class":
      return <Box size={13} className="text-[#79D69A]" />;
    case "method":
      return <Code2 size={13} className="text-[#84C2F5]" />;
    case "variable":
      return <Variable size={13} className="text-[#E9B96E]" />;
    default:
      return <FileCode2 size={13} className="text-[#A0A79F]" />;
  }
}

export const SymbolNode = memo(function SymbolNode({
  data,
}: NodeProps & { data: SymbolNodeData }) {
  const isChanged = data.changeStatus !== "unchanged" || data.impactStatus === "root_cause";
  const isImpacted = data.impactStatus === "impacted";

  return (
    <div
      className={`relative w-[260px] p-3 rounded-[6px] transition-all cursor-pointer select-none ${
        data.isSelected
          ? "bg-[#181D19] border-2 border-[#C7F36B] shadow-[0_0_20px_rgba(199,243,107,0.25)] ring-1 ring-[#C7F36B]"
          : isChanged
          ? "bg-[#141815] border border-[#44553D] hover:border-[#C7F36B]"
          : isImpacted
          ? "bg-[#181612] border border-[#55452D] hover:border-[#E9B96E]"
          : "bg-[#101211] border border-[#292E2A] hover:border-[#3E4540]"
      } ${data.isDimmed ? "opacity-25 grayscale" : "opacity-100"}`}
    >
      {/* Target Connection Handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-[#292E2A] !border !border-[#6E776F] hover:!bg-[#C7F36B] transition-colors"
      />

      {/* Top Header: Kind Icon, Monospace Kind Label & Status Badge */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded bg-[#1D221F]">{getKindIcon(data.kind)}</div>
          <span className="font-mono text-[9px] uppercase tracking-wider text-[#A0A79F] font-semibold">
            {data.kind}
          </span>
        </div>

        {/* Change / Impact Badge */}
        {isChanged ? (
          <span className="px-1.5 py-0.5 rounded-[2px] bg-[#C7F36B]/15 border border-[#C7F36B]/40 text-[#C7F36B] font-mono text-[9px] uppercase tracking-wider font-semibold">
            ROOT CHANGE
          </span>
        ) : isImpacted ? (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] bg-[#E9B96E]/15 border border-[#E9B96E]/40 text-[#E9B96E] font-mono text-[9px] uppercase tracking-wider font-semibold">
            <AlertTriangle size={10} />
            <span>IMPACTED</span>
          </span>
        ) : null}
      </div>

      {/* Symbol Name */}
      <div className="font-mono text-[13px] font-semibold text-[#F0F2ED] truncate" title={data.name}>
        {data.name}
      </div>

      {/* File Path & Line Reference */}
      <div className="mt-1 flex items-center justify-between text-[#6E776F] font-mono text-[10px]">
        <span className="truncate max-w-[170px]" title={data.file}>
          {data.file.split("/").pop()}
        </span>
        <span className="text-[#A0A79F] shrink-0">
          :{data.lineStart}
        </span>
      </div>

      {/* Footer Metadata: Connection counts & related findings */}
      <div className="mt-2.5 pt-2 border-t border-[#1D221F] flex items-center justify-between font-mono text-[9px] text-[#A0A79F]">
        <div className="flex items-center gap-2">
          <span>In: {data.incomingCount}</span>
          <span>•</span>
          <span>Out: {data.outgoingCount}</span>
        </div>

        {data.relatedFindingsCount && data.relatedFindingsCount > 0 ? (
          <span className="flex items-center gap-1 text-[#C7F36B] font-semibold">
            <Sparkles size={10} />
            <span>{data.relatedFindingsCount} Finding</span>
          </span>
        ) : (
          <span className="text-[#6E776F] hover:text-[#C7F36B] flex items-center gap-0.5">
            <span>Details</span>
            <ArrowRight size={9} />
          </span>
        )}
      </div>

      {/* Source Connection Handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-[#292E2A] !border !border-[#6E776F] hover:!bg-[#C7F36B] transition-colors"
      />
    </div>
  );
});

