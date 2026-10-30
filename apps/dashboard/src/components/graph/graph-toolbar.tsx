"use client";

import { memo } from "react";
import {
  Search,
  Maximize2,
  RotateCcw,
  Flame,
  Activity,
  X,
} from "lucide-react";

interface GraphToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterKind: string;
  onFilterKindChange: (kind: string) => void;
  filterChange: string;
  onFilterChangeChange: (change: string) => void;
  isolationMode: boolean;
  onToggleIsolationMode: () => void;
  onFitView: () => void;
  onResetView: () => void;
  stats: {
    totalNodes: number;
    totalEdges: number;
    changedCount: number;
    impactedCount: number;
  };
}

export const GraphToolbar = memo(function GraphToolbar({
  searchQuery,
  onSearchChange,
  filterKind,
  onFilterKindChange,
  filterChange,
  onFilterChangeChange,
  isolationMode,
  onToggleIsolationMode,
  onFitView,
  onResetView,
  stats,
}: GraphToolbarProps) {
  return (
    <div className="p-3 bg-[#101211]/90 backdrop-blur-md border border-[#292E2A] rounded-[6px] shadow-xl flex flex-wrap items-center justify-between gap-3">
      {/* Left: Search & Filter dropdowns */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Node Search Input */}
        <div className="relative w-[180px] sm:w-[220px]">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6E776F]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search symbol / file..."
            className="w-full h-[32px] pl-7 pr-7 bg-[#151816] border border-[#292E2A] rounded-[4px] font-mono text-[11px] text-[#F0F2ED] placeholder:text-[#6E776F] focus:outline-none focus:border-[#C7F36B] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6E776F] hover:text-[#F0F2ED]"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filter Symbol Kind */}
        <div className="flex items-center gap-1 bg-[#151816] border border-[#292E2A] rounded-[4px] p-0.5 font-mono text-[10px]">
          <button
            type="button"
            onClick={() => onFilterKindChange("all")}
            className={`px-2 py-1 rounded-[2px] transition-colors ${
              filterKind === "all"
                ? "bg-[#292E2A] text-[#F0F2ED] font-semibold"
                : "text-[#A0A79F] hover:text-[#F0F2ED]"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onFilterKindChange("functions")}
            className={`px-2 py-1 rounded-[2px] transition-colors ${
              filterKind === "functions"
                ? "bg-[#292E2A] text-[#C7F36B] font-semibold"
                : "text-[#A0A79F] hover:text-[#F0F2ED]"
            }`}
          >
            Functions
          </button>
          <button
            type="button"
            onClick={() => onFilterKindChange("classes")}
            className={`px-2 py-1 rounded-[2px] transition-colors ${
              filterKind === "classes"
                ? "bg-[#292E2A] text-[#79D69A] font-semibold"
                : "text-[#A0A79F] hover:text-[#F0F2ED]"
            }`}
          >
            Classes
          </button>
          <button
            type="button"
            onClick={() => onFilterKindChange("files")}
            className={`px-2 py-1 rounded-[2px] transition-colors ${
              filterKind === "files"
                ? "bg-[#292E2A] text-[#84C2F5] font-semibold"
                : "text-[#A0A79F] hover:text-[#F0F2ED]"
            }`}
          >
            Files
          </button>
        </div>

        {/* Change State Filter */}
        <div className="flex items-center gap-1 bg-[#151816] border border-[#292E2A] rounded-[4px] p-0.5 font-mono text-[10px]">
          <button
            type="button"
            onClick={() => onFilterChangeChange("all")}
            className={`px-2 py-1 rounded-[2px] transition-colors ${
              filterChange === "all"
                ? "bg-[#292E2A] text-[#F0F2ED] font-semibold"
                : "text-[#A0A79F] hover:text-[#F0F2ED]"
            }`}
          >
            Every Node
          </button>
          <button
            type="button"
            onClick={() => onFilterChangeChange("changed")}
            className={`px-2 py-1 rounded-[2px] transition-colors ${
              filterChange === "changed"
                ? "bg-[#C7F36B]/20 text-[#C7F36B] font-semibold"
                : "text-[#A0A79F] hover:text-[#C7F36B]"
            }`}
          >
            Changes ({stats.changedCount})
          </button>
          <button
            type="button"
            onClick={() => onFilterChangeChange("impacted")}
            className={`px-2 py-1 rounded-[2px] transition-colors ${
              filterChange === "impacted"
                ? "bg-[#E9B96E]/20 text-[#E9B96E] font-semibold"
                : "text-[#A0A79F] hover:text-[#E9B96E]"
            }`}
          >
            Impacted ({stats.impactedCount})
          </button>
        </div>

        {/* Blast Radius Isolation Mode Toggle */}
        <button
          type="button"
          onClick={onToggleIsolationMode}
          className={`h-[32px] px-3 rounded-[4px] font-mono text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1.5 transition-all border ${
            isolationMode
              ? "bg-[#E9B96E]/15 border-[#E9B96E] text-[#E9B96E] shadow-[0_0_12px_rgba(233,185,110,0.25)]"
              : "bg-[#151816] border-[#292E2A] text-[#A0A79F] hover:text-[#F0F2ED] hover:border-[#3E4540]"
          }`}
          title="Isolate changed and impacted blast radius"
        >
          <Flame size={12} className={isolationMode ? "text-[#E9B96E]" : "text-[#6E776F]"} />
          <span>Blast Radius Mode</span>
        </button>
      </div>

      {/* Right: View controls and stats */}
      <div className="flex items-center gap-2">
        {/* Node / Edge stats */}
        <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 bg-[#151816] border border-[#222724] rounded-[3px] font-mono text-[10px] text-[#A0A79F]">
          <Activity size={12} className="text-[#C7F36B]" />
          <span>
            {stats.totalNodes} Nodes, {stats.totalEdges} Edges
          </span>
        </div>

        <button
          type="button"
          onClick={onFitView}
          className="p-1.5 h-[32px] px-2.5 rounded-[4px] bg-[#151816] border border-[#292E2A] text-[#A0A79F] hover:text-[#F0F2ED] hover:border-[#3E4540] font-mono text-[10px] flex items-center gap-1 transition-colors"
          title="Fit view to canvas"
        >
          <Maximize2 size={12} />
          <span className="hidden sm:inline">Fit</span>
        </button>

        <button
          type="button"
          onClick={onResetView}
          className="p-1.5 h-[32px] px-2.5 rounded-[4px] bg-[#151816] border border-[#292E2A] text-[#A0A79F] hover:text-[#F0F2ED] hover:border-[#3E4540] font-mono text-[10px] flex items-center gap-1 transition-colors"
          title="Reset canvas"
        >
          <RotateCcw size={12} />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>
    </div>
  );
});
