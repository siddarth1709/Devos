"use client";

import { useAuth } from "@/hooks/use-auth";
import { Sparkles, LogOut, ArrowRight } from "lucide-react";
import Link from "next/link";

export function DemoBanner() {
  const { isDemo, exitDemo } = useAuth();

  if (!isDemo) return null;

  return (
    <div
      role="status"
      aria-label="Demonstration Mode Active"
      className="w-full bg-[#151816] border-b border-[#E9B96E]/30 px-4 py-2.5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs select-none animate-in fade-in duration-200"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] bg-[#E9B96E]/15 border border-[#E9B96E]/40 font-mono text-[9px] font-bold text-[#E9B96E] uppercase tracking-wider shrink-0">
          <Sparkles size={11} className="shrink-0" />
          <span>DEMO MODE</span>
        </span>
        <span className="font-body text-[#A0A79F] truncate text-[11px] sm:text-[12px]">
          You&apos;re exploring a demonstration workspace. No real GitHub repository is connected.
        </span>
      </div>

      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[3px] font-mono text-[10px] text-[#C7F36B] hover:bg-[#C7F36B]/10 border border-[#C7F36B]/30 transition-colors uppercase tracking-wider"
        >
          <span>Connect Real GitHub</span>
          <ArrowRight size={11} />
        </Link>
        <button
          type="button"
          onClick={() => exitDemo()}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[3px] font-mono text-[10px] text-[#F07878] hover:bg-[#F07878]/10 border border-[#F07878]/30 transition-colors uppercase tracking-wider"
        >
          <LogOut size={11} />
          <span>Exit Demo</span>
        </button>
      </div>
    </div>
  );
}

