"use client";

import { useState } from "react";
import { ScrollReveal } from "./scroll-reveal";
import { ChevronDown, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";

export function EvidenceSection() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const rows = [
    {
      label: "SOURCE EVIDENCE",
      title: "Changed symbol",
      description:
        "A source location and symbol extracted from the analyzed repository revision.",
      status: "TRACEABLE",
      statusColor: "text-[#79D69A] border-[#34523C] bg-[#79D69A]/10",
      dotColor: "bg-[#79D69A]",
      icon: CheckCircle2,
      meta: {
        file: "apps/api/src/auth/session.ts",
        lines: "L42-L58",
        detector: "AST Symbol Extraction",
        confidence: "Deterministic (1.00)",
      },
    },
    {
      label: "AI INTERPRETATION",
      title: "Potential impact",
      description:
        "A contextual explanation generated from collected evidence.",
      status: "REQUIRES VALIDATION",
      statusColor: "text-[#E9B96E] border-[#594726] bg-[#E9B96E]/10",
      dotColor: "bg-[#E9B96E]",
      icon: AlertCircle,
      meta: {
        file: "apps/api/src/middleware/guard.ts",
        lines: "Transitive dependent (L12)",
        detector: "Gemma Reasoning Node",
        confidence: "Advisory Context",
      },
    },
    {
      label: "DETERMINISTIC CHECK",
      title: "Release condition",
      description:
        "A result produced by explicit checks and recorded outcomes.",
      status: "RULE-BASED",
      statusColor: "text-[#79D69A] border-[#34523C] bg-[#79D69A]/10",
      dotColor: "bg-[#79D69A]",
      icon: ShieldAlert,
      meta: {
        file: "tests/e2e/auth-flow.test.ts",
        lines: "Suite: 18 passing",
        detector: "Policy Rule: REGRESSION_PREVENT",
        confidence: "Deterministic (1.00)",
      },
    },
  ];

  const toggleRow = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  return (
    <section
      id="principles"
      className="w-full py-20 lg:py-[140px] bg-[#090A0A] relative"
    >
      <div className="page-container grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-start">
        {/* Left Side (Cols 1-5) */}
        <div className="lg:col-span-5 flex flex-col items-start">
          <ScrollReveal>
            <span className="font-mono text-[10px] tracking-[0.14em] text-[#C7F36B] uppercase font-medium">
              03 / THE PRINCIPLE
            </span>
            <h2 className="mt-4 font-display font-semibold text-[34px] sm:text-[40px] lg:text-[48px] leading-[1.06] tracking-[-0.055em] text-[#F0F2ED]">
              Reasoning should be traceable.
            </h2>
            <p className="mt-5 font-body text-[15px] sm:text-[16px] leading-[1.8] text-[#A0A79F]">
              AI can help explain what a change means. But an explanation is only
              useful when its evidence can be inspected and verified against the actual repository source.
            </p>
          </ScrollReveal>
        </div>

        {/* Right Side: Technical Evidence Panel (Cols 6-12 -> 7 cols) */}
        <div className="lg:col-span-7 w-full">
          <ScrollReveal delayMs={140}>
            <div className="w-full bg-[#101211] border border-[#292E2A] rounded-[4px] p-6 sm:p-[28px] flex flex-col justify-between shadow-2xl transition-all duration-300">
              {/* Panel Header */}
              <div>
                <div className="flex items-center justify-between pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#C7F36B] animate-pulse" />
                    <span className="font-mono text-[9px] tracking-[0.1em] text-[#A0A79F] uppercase font-medium">
                      EVIDENCE → REASONING → VALIDATION
                    </span>
                  </div>
                  <span className="font-mono text-[8px] tracking-[0.08em] text-[#6E776F] uppercase">
                    INSPECTION PANEL
                  </span>
                </div>
                <div className="h-[1px] w-full bg-[#1D221F]" />
              </div>

              {/* Three Interactive Stacked Rows */}
              <div className="divide-y divide-[#1D221F] my-2">
                {rows.map((row, idx) => {
                  const isExpanded = expandedIndex === idx;
                  return (
                    <div
                      key={row.label}
                      onClick={() => toggleRow(idx)}
                      className={`group py-5 sm:py-6 px-3 rounded-[3px] flex flex-col gap-3 transition-all duration-[240ms] cursor-pointer ${
                        isExpanded ? "bg-[#151816]/90 border-l-2 border-[#C7F36B]" : "hover:bg-[#151816]/60 border-l-2 border-transparent"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex flex-col items-start max-w-[430px]">
                          <span className="font-mono text-[8px] tracking-[0.12em] text-[#6E776F] uppercase group-hover:text-[#A0A79F] transition-colors">
                            {row.label}
                          </span>
                          <h3 className="mt-1 font-display text-[15px] font-semibold text-[#F0F2ED] group-hover:text-white transition-colors">
                            {row.title}
                          </h3>
                          <p className="mt-1 font-body text-[12px] leading-[1.7] text-[#A0A79F]">
                            {row.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] border font-mono text-[8px] tracking-[0.08em] font-medium uppercase transition-transform duration-150 ${row.statusColor}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${row.dotColor}`} />
                            <span>{row.status}</span>
                          </span>
                          <ChevronDown
                            size={14}
                            className={`text-[#6E776F] transition-transform duration-200 group-hover:text-[#F0F2ED] ${
                              isExpanded ? "rotate-180" : "rotate-0"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Expandable Evidence Inspection Detail Drawer */}
                      <div
                        className={`overflow-hidden transition-all duration-[300ms] ${
                          isExpanded ? "max-h-[160px] opacity-100 pt-3" : "max-h-0 opacity-0 pt-0"
                        }`}
                        style={{
                          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                        }}
                      >
                        <div className="p-3 bg-[#0B0D0C] border border-[#222724] rounded-[3px] grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[9px]">
                          <div>
                            <span className="text-[#6E776F] block">TARGET</span>
                            <span className="text-[#F0F2ED] font-medium truncate block mt-0.5">
                              {row.meta.file}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#6E776F] block">LOCATION</span>
                            <span className="text-[#A0A79F] block mt-0.5">{row.meta.lines}</span>
                          </div>
                          <div>
                            <span className="text-[#6E776F] block">METHOD</span>
                            <span className="text-[#A0A79F] block mt-0.5">{row.meta.detector}</span>
                          </div>
                          <div>
                            <span className="text-[#6E776F] block">VERIFICATION</span>
                            <span className="text-[#C7F36B] block mt-0.5 font-medium">{row.meta.confidence}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Panel Footer */}
              <div className="pt-3 border-t border-[#1D221F] flex items-center justify-between">
                <span className="font-mono text-[8px] tracking-[0.1em] text-[#6E776F] uppercase">
                  ILLUSTRATIVE WORKFLOW — NOT LIVE REPOSITORY DATA
                </span>
                <span className="font-mono text-[8px] text-[#A0A79F]">
                  CLICK ROW TO INSPECT
                </span>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
