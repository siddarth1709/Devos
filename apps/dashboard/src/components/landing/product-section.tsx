"use client";

import { ScrollReveal } from "./scroll-reveal";
import { GitCommit, Network, ShieldCheck, ArrowRight } from "lucide-react";

export function ProductSection() {
  const capabilities = [
    {
      number: "01",
      icon: GitCommit,
      title: "Trace the change",
      description:
        "Start with the actual code diff and identify the symbols, dependencies, and files involved in the pull request.",
      tag: "DIFF & AST PARSING",
    },
    {
      number: "02",
      icon: Network,
      title: "Understand the impact",
      description:
        "Follow dependency relationships transitively to discover distant areas and shared services affected by a change.",
      tag: "BLAST RADIUS GRAPH",
    },
    {
      number: "03",
      icon: ShieldCheck,
      title: "Evaluate the evidence",
      description:
        "Bring tests, source references, and deterministic engineering checks into one reviewable picture before deployment.",
      tag: "VERIFICATION CHECKS",
    },
  ];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  return (
    <section
      id="product"
      className="w-full py-20 lg:py-[130px] border-t border-b border-[#292E2A] bg-[#090A0A] relative"
    >
      <div className="page-container relative z-10">
        {/* Header 12-Column Grid */}
        <ScrollReveal>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-start">
            {/* Left Column (Cols 1-5) */}
            <div className="lg:col-span-5 flex flex-col items-start">
              <span className="font-mono text-[10px] tracking-[0.14em] text-[#C7F36B] uppercase font-medium">
                01 / THE PROBLEM
              </span>
              <h2 className="mt-4 font-display font-semibold text-[36px] sm:text-[44px] lg:text-[52px] leading-[1.05] tracking-[-0.06em] text-[#F0F2ED] max-w-[510px]">
                Code changes don&apos;t happen in isolation.
              </h2>
            </div>

            {/* Spacer (Col 6) */}
            <div className="hidden lg:block lg:col-span-1" />

            {/* Right Column (Cols 7-12) */}
            <div className="lg:col-span-6 lg:pt-[52px]">
              <p className="font-body text-[15px] sm:text-[16px] leading-[1.8] text-[#A0A79F] max-w-[460px]">
                A small edit can affect distant modules, shared dependencies,
                tests, and release behaviour. Understanding that impact often
                means jumping between tools and reconstructing the story
                manually.
              </p>
            </div>
          </div>
        </ScrollReveal>

        {/* Three Capability Interactive Cards */}
        <div className="mt-16 lg:mt-[88px] grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {capabilities.map((cap, idx) => {
            const IconComponent = cap.icon;
            return (
              <ScrollReveal key={cap.number} delayMs={idx * 120}>
                <div
                  onMouseMove={handleMouseMove}
                  className="spotlight-card group relative border border-[#222724] bg-[#101211]/80 rounded-[4px] p-6 sm:p-7 min-h-[260px] flex flex-col justify-between transition-all duration-[300ms] hover:border-[#44553D] hover:bg-[#151816] hover:shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
                >
                  {/* Top Bar with Number and Icon */}
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-[#1D221F]">
                      <span className="font-mono text-[12px] font-semibold text-[#C7F36B] transition-transform duration-200 group-hover:translate-x-0.5">
                        {cap.number}
                      </span>
                      <div className="w-8 h-8 rounded-[3px] bg-[#151816] border border-[#292E2A] flex items-center justify-center text-[#A0A79F] group-hover:text-[#C7F36B] group-hover:border-[#44553D] transition-all duration-200">
                        <IconComponent size={15} />
                      </div>
                    </div>

                    <h3 className="mt-5 font-display text-[22px] font-semibold text-[#F0F2ED] tracking-[-0.02em] group-hover:text-white transition-colors duration-200">
                      {cap.title}
                    </h3>
                    <p className="mt-3 font-body text-[14px] leading-[1.8] text-[#A0A79F] group-hover:text-[#CBD1CA] transition-colors duration-200">
                      {cap.description}
                    </p>
                  </div>

                  {/* Bottom Indicator */}
                  <div className="pt-6 mt-4 flex items-center justify-between border-t border-[#1D221F]/80">
                    <span className="font-mono text-[8px] tracking-[0.1em] text-[#6E776F] uppercase group-hover:text-[#A0A79F] transition-colors">
                      {cap.tag}
                    </span>
                    <ArrowRight
                      size={14}
                      className="text-[#6E776F] transition-all duration-[240ms] group-hover:text-[#C7F36B] group-hover:translate-x-1.5"
                    />
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
