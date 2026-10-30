"use client";

import { ScrollReveal } from "./scroll-reveal";
import { ImpactVisual } from "./impact-visual";
import { Network, Activity, ArrowUpRight } from "lucide-react";

export function ImpactSection() {
  return (
    <section
      id="impact-trace"
      className="w-full py-20 lg:py-[120px] bg-[#0B0D0C] border-t border-[#292E2A] relative overflow-hidden"
    >
      {/* Subtle ambient background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[#C7F36B]/[0.02] rounded-full blur-[140px] pointer-events-none"
        aria-hidden="true"
      />

      <div className="page-container relative z-10">
        {/* Section Header */}
        <ScrollReveal>
          <div className="max-w-[800px] mb-12 lg:mb-16">
            <div className="flex items-center gap-2 text-[#C7F36B] font-mono text-[10px] tracking-[0.14em] uppercase font-medium">
              <Network size={13} />
              <span>DEPENDENCY GRAPH / BLAST RADIUS TRACE</span>
            </div>
            <h2 className="mt-4 font-display font-semibold text-[32px] sm:text-[42px] lg:text-[50px] leading-[1.05] tracking-[-0.05em] text-[#F0F2ED]">
              Trace the chain reaction before you deploy.
            </h2>
            <p className="mt-4 font-body text-[15px] sm:text-[16px] leading-[1.8] text-[#A0A79F] max-w-[580px]">
              Every commit initiates a transitive dependency cascade. Hover over any node in the interactive dependency map below to inspect connected modules, blast radius paths, and regression boundaries.
            </p>
          </div>
        </ScrollReveal>

        {/* Visual Graph Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 flex justify-center">
            <ScrollReveal delayMs={100} className="w-full">
              <ImpactVisual />
            </ScrollReveal>
          </div>

          {/* Interactive Inspection Callouts */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <ScrollReveal delayMs={180}>
              <div className="p-5 bg-[#101211] border border-[#292E2A] rounded-[4px] hover:border-[#44553D] transition-colors">
                <div className="flex items-center justify-between pb-3 border-b border-[#1D221F]">
                  <span className="font-mono text-[9px] tracking-[0.12em] text-[#C7F36B] uppercase font-medium">
                    CHANGE DETECTION
                  </span>
                  <Activity size={13} className="text-[#C7F36B]" />
                </div>
                <h3 className="mt-3 font-display text-[16px] font-semibold text-[#F0F2ED]">
                  Deterministic Source Diff
                </h3>
                <p className="mt-1.5 font-body text-[13px] leading-[1.7] text-[#A0A79F]">
                  AST parsing detects modified exports in <code className="text-[#C7F36B] font-mono text-[11px]">auth.ts</code> and computes immediate blast zones.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={260}>
              <div className="p-5 bg-[#101211] border border-[#292E2A] rounded-[4px] hover:border-[#44553D] transition-colors">
                <div className="flex items-center justify-between pb-3 border-b border-[#1D221F]">
                  <span className="font-mono text-[9px] tracking-[0.12em] text-[#79D69A] uppercase font-medium">
                    TRANSITIVE CASCADE
                  </span>
                  <span className="w-2 h-2 rounded-full bg-[#79D69A] animate-pulse" />
                </div>
                <h3 className="mt-3 font-display text-[16px] font-semibold text-[#F0F2ED]">
                  4 Downstream Services
                </h3>
                <p className="mt-1.5 font-body text-[13px] leading-[1.7] text-[#A0A79F]">
                  Propagates through <code className="text-[#F0F2ED] font-mono text-[11px]">session.ts</code> &rarr; <code className="text-[#F0F2ED] font-mono text-[11px]">middleware.ts</code> to safeguard public <code className="text-[#F0F2ED] font-mono text-[11px]">api.ts</code> endpoints.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delayMs={340}>
              <div className="p-5 bg-[#101211] border border-[#292E2A] rounded-[4px] hover:border-[#44553D] transition-colors">
                <div className="flex items-center justify-between pb-3 border-b border-[#1D221F]">
                  <span className="font-mono text-[9px] tracking-[0.12em] text-[#A0A79F] uppercase font-medium">
                    VERIFICATION
                  </span>
                  <ArrowUpRight size={13} className="text-[#A0A79F]" />
                </div>
                <h3 className="mt-3 font-display text-[16px] font-semibold text-[#F0F2ED]">
                  Automated Regression Check
                </h3>
                <p className="mt-1.5 font-body text-[13px] leading-[1.7] text-[#A0A79F]">
                  Links directly to unit and integration suites to ensure test coverage covers the touched radius.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}

