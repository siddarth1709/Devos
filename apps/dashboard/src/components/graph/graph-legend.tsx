"use client";

import { memo, useState } from "react";
import { HelpCircle, ChevronDown, ChevronUp } from "lucide-react";

export const GraphLegend = memo(function GraphLegend() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-[#101211]/95 backdrop-blur-md border border-[#292E2A] rounded-[6px] shadow-lg overflow-hidden text-[11px] font-mono select-none">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 flex items-center justify-between gap-3 text-[#A0A79F] hover:text-[#F0F2ED] transition-colors"
      >
        <div className="flex items-center gap-1.5 font-semibold text-[10px] uppercase tracking-wider">
          <HelpCircle size={13} className="text-[#C7F36B]" />
          <span>LATTICE LEGEND</span>
        </div>
        {isOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
      </button>

      {isOpen && (
        <div className="p-3 pt-1 border-t border-[#1D221F] space-y-2.5 text-[#A0A79F]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-[2px] bg-[#C7F36B]/20 border border-[#C7F36B] shrink-0" />
            <span>Root Changed Symbol (PR modified)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-[2px] bg-[#E9B96E]/20 border border-[#E9B96E] shrink-0" />
            <span>Downstream Impacted (Blast radius)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-[2px] bg-[#101211] border border-[#292E2A] shrink-0" />
            <span>Stable Dependency Anchor</span>
          </div>

          <div className="pt-2 border-t border-[#1D221F] text-[10px] text-[#6E776F] space-y-1">
            <p>&bull; Click any node to isolate its downstream call graph.</p>
            <p>&bull; Use scroll wheel or trackpad to pan & zoom.</p>
          </div>
        </div>
      )}
    </div>
  );
});

