"use client";

import { memo } from "react";
import { Search, X, ArrowUpDown } from "lucide-react";

interface FindingFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  severityFilter: string;
  onSeverityFilterChange: (severity: string) => void;
  originFilter: string;
  onOriginFilterChange: (origin: string) => void;
  sortBy: "severity" | "confidence" | "file";
  onSortByChange: (sort: "severity" | "confidence" | "file") => void;
  matchingCount: number;
  totalCount: number;
  onClearFilters: () => void;
}

export const FindingFilters = memo(function FindingFilters({
  searchQuery,
  onSearchChange,
  severityFilter,
  onSeverityFilterChange,
  originFilter,
  onOriginFilterChange,
  sortBy,
  onSortByChange,
  matchingCount,
  totalCount,
  onClearFilters,
}: FindingFiltersProps) {
  const hasActiveFilters =
    Boolean(searchQuery) || severityFilter !== "all" || originFilter !== "all";

  return (
    <div className="p-3 bg-[#101211] border border-[#292E2A] rounded-[6px] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6E776F]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search findings by title, file, or symbol..."
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

        {/* Sort Dropdown */}
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#A0A79F]">
          <ArrowUpDown size={12} className="text-[#6E776F]" />
          <span>Sort:</span>
          <select
            value={sortBy}
            onChange={(e) =>
              onSortByChange(e.target.value as "severity" | "confidence" | "file")
            }
            className="h-[32px] px-2 bg-[#151816] border border-[#292E2A] rounded-[4px] font-mono text-[11px] text-[#F0F2ED] focus:outline-none focus:border-[#C7F36B]"
          >
            <option value="severity">Severity (Critical First)</option>
            <option value="confidence">Confidence (High First)</option>
            <option value="file">File Path (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Filter Row: Severity Tabs & Origin Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#1D221F]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Severity Tabs */}
          <div className="flex items-center gap-1 bg-[#151816] border border-[#292E2A] rounded-[4px] p-0.5 font-mono text-[10px]">
            {["all", "critical", "high", "medium", "low", "info"].map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => onSeverityFilterChange(sev)}
                className={`px-2 py-0.5 rounded-[2px] uppercase transition-colors ${
                  severityFilter === sev
                    ? "bg-[#292E2A] text-[#F0F2ED] font-semibold"
                    : "text-[#A0A79F] hover:text-[#F0F2ED]"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Origin Tabs */}
          <div className="flex items-center gap-1 bg-[#151816] border border-[#292E2A] rounded-[4px] p-0.5 font-mono text-[10px]">
            <button
              type="button"
              onClick={() => onOriginFilterChange("all")}
              className={`px-2 py-0.5 rounded-[2px] transition-colors ${
                originFilter === "all"
                  ? "bg-[#292E2A] text-[#F0F2ED] font-semibold"
                  : "text-[#A0A79F] hover:text-[#F0F2ED]"
              }`}
            >
              All Origins
            </button>
            <button
              type="button"
              onClick={() => onOriginFilterChange("gemma")}
              className={`px-2 py-0.5 rounded-[2px] transition-colors ${
                originFilter === "gemma"
                  ? "bg-[#292E2A] text-[#C7F36B] font-semibold"
                  : "text-[#A0A79F] hover:text-[#C7F36B]"
              }`}
            >
              Gemma AI
            </button>
            <button
              type="button"
              onClick={() => onOriginFilterChange("deterministic")}
              className={`px-2 py-0.5 rounded-[2px] transition-colors ${
                originFilter === "deterministic"
                  ? "bg-[#292E2A] text-[#79D69A] font-semibold"
                  : "text-[#A0A79F] hover:text-[#79D69A]"
              }`}
            >
              Deterministic
            </button>
          </div>
        </div>

        {/* Results Count & Clear Button */}
        <div className="flex items-center gap-3 font-mono text-[11px] text-[#A0A79F]">
          <span>
            Showing <strong className="text-[#F0F2ED]">{matchingCount}</strong> of{" "}
            {totalCount} findings
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-[#C7F36B] hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
