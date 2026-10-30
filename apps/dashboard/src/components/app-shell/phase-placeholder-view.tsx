"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck, LucideIcon } from "lucide-react";

export function PhasePlaceholderView({
  title,
  icon: Icon,
  description,
  prerequisite,
  phaseNumber,
}: {
  title: string;
  icon: LucideIcon;
  description: string;
  prerequisite: string;
  phaseNumber: string;
}) {
  return (
    <div className="max-w-[800px] mx-auto py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-[#151816] border border-[#292E2A] flex items-center justify-center text-[#C7F36B] mx-auto mb-5 shadow-lg">
        <Icon size={28} />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[2px] bg-[#181D19] border border-[#3A4338] text-[#C7F36B] font-mono text-[10px] tracking-wider uppercase font-semibold mb-3">
        <span>{phaseNumber} DELIVERABLE</span>
      </div>

      <h1 className="font-display font-semibold text-[26px] sm:text-[32px] text-[#F0F2ED] tracking-[-0.03em]">
        {title}
      </h1>

      <p className="mt-3 font-body text-[14px] sm:text-[15px] leading-[1.7] text-[#A0A79F] max-w-[560px] mx-auto">
        {description}
      </p>

      <div className="mt-8 p-4 rounded-[4px] bg-[#101211] border border-[#222724] max-w-[500px] mx-auto text-left font-mono text-[11px] space-y-2">
        <div className="flex items-center gap-2 text-[#79D69A]">
          <ShieldCheck size={14} />
          <span className="font-semibold uppercase tracking-wider">Prerequisite Status</span>
        </div>
        <p className="text-[#A0A79F] leading-[1.6]">
          {prerequisite}
        </p>
      </div>

      <div className="mt-8 flex items-center justify-center gap-4">
        <Link
          href="/app/repositories"
          className="inline-flex items-center gap-2 px-5 h-[42px] bg-[#C7F36B] text-[#090A0A] font-mono text-[11px] font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#D7FF86] transition-all"
        >
          <span>Select Repository & PR</span>
          <ArrowRight size={14} />
        </Link>
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 px-4 h-[42px] border border-[#292E2A] text-[#F0F2ED] font-mono text-[11px] uppercase tracking-wider rounded-[4px] hover:bg-[#151816] transition-colors"
        >
          <ArrowLeft size={13} />
          <span>Console Overview</span>
        </Link>
      </div>
    </div>
  );
}

