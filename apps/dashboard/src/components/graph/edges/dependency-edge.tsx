"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import type { DependencyEdgeData } from "@/lib/graph-transform";

export const DependencyEdge = memo(function DependencyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}: EdgeProps & { data?: DependencyEdgeData }) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  });

  const isHighlighted = data?.isHighlighted;
  const isDimmed = data?.isDimmed;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: isHighlighted
            ? "#C7F36B"
            : isDimmed
            ? "#1D221F"
            : "#3A4338",
          strokeWidth: isHighlighted ? 2.5 : 1.5,
          opacity: isDimmed ? 0.2 : 1,
          transition: "stroke 300ms, stroke-width 300ms, opacity 300ms",
        }}
      />

      {data?.kind && !isDimmed && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className={`px-1.5 py-0.5 rounded-[2px] font-mono text-[8px] uppercase tracking-wider font-semibold border transition-all ${
              isHighlighted
                ? "bg-[#181D19] border-[#C7F36B] text-[#C7F36B] shadow-[0_0_8px_rgba(199,243,107,0.3)]"
                : "bg-[#101211] border-[#292E2A] text-[#6E776F] hover:text-[#A0A79F]"
            }`}
          >
            {data.kind}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

