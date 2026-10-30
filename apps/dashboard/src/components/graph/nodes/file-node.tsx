"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { FileNodeData } from "@/lib/graph-transform";
import { FileCode2, AlertTriangle } from "lucide-react";

export const FileNode = memo(function FileNode({
  data,
}: NodeProps & { data: FileNodeData }) {
  const isChanged = data.changeStatus !== "unchanged";
  const isImpacted = data.impactStatus === "impacted";

  return (
    <div
      className={`relative w-[280px] p-3.5 rounded-[6px] transition-all cursor-pointer select-none ${
        data.isSelected
          ? "bg-[#181D19] border-2 border-[#C7F36B] shadow-[0_0_20px_rgba(199,243,107,0.25)] ring-1 ring-[#C7F36B]"
          : isChanged
          ? "bg-[#141815] border border-[#44553D] hover:border-[#C7F36B]"
          : isImpacted
          ? "bg-[#181612] border border-[#55452D] hover:border-[#E9B96E]"
          : "bg-[#101211] border border-[#292E2A] hover:border-[#3E4540]"
      } ${data.isDimmed ? "opacity-25 grayscale" : "opacity-100"}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-[#292E2A] !border !border-[#6E776F]"
      />

      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-[#1D221F] text-[#C7F36B]">
            <FileCode2 size={14} />
          </div>
          <span className="font-mono text-[9px] uppercase tracking-wider text-[#A0A79F] font-semibold">
            FILE MODULE
          </span>
        </div>

        {isChanged ? (
          <span className="px-1.5 py-0.5 rounded-[2px] bg-[#C7F36B]/15 border border-[#C7F36B]/40 text-[#C7F36B] font-mono text-[9px] uppercase font-semibold">
            MODIFIED
          </span>
        ) : isImpacted ? (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] bg-[#E9B96E]/15 border border-[#E9B96E]/40 text-[#E9B96E] font-mono text-[9px] uppercase font-semibold">
            <AlertTriangle size={10} />
            <span>IMPACTED</span>
          </span>
        ) : null}
      </div>

      <div className="font-mono text-[12px] font-semibold text-[#F0F2ED] truncate" title={data.path}>
        {data.path.split("/").pop()}
      </div>

      <div className="mt-1 font-mono text-[10px] text-[#6E776F] truncate">
        {data.path}
      </div>

      <div className="mt-2.5 pt-2 border-t border-[#1D221F] flex items-center justify-between font-mono text-[9px] text-[#A0A79F]">
        <span>{data.symbolCount || 1} Exported Symbols</span>
        <span className="text-[#6E776F]">Inspect &rarr;</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-[#292E2A] !border !border-[#6E776F]"
      />
    </div>
  );
});

