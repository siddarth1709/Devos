"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollReveal } from "./scroll-reveal";
import { GitPullRequest, SearchCode, Sparkles, CheckCircle2 } from "lucide-react";

export function MethodSection() {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const hLineRef = useRef<HTMLDivElement>(null);
  const vLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      hLineRef.current?.classList.add("line-active");
      vLineRef.current?.classList.add("line-active");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          hLineRef.current?.classList.add("line-active");
          vLineRef.current?.classList.add("line-active");
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const steps = [
    {
      num: "01",
      icon: GitPullRequest,
      title: "Connect",
      description:
        "Connect the repository and identify the exact code changes and modified files under review.",
    },
    {
      num: "02",
      icon: SearchCode,
      title: "Analyze",
      description:
        "Parse changed files and AST symbols, then trace their transitive dependency relationships.",
    },
    {
      num: "03",
      icon: Sparkles,
      title: "Investigate",
      description:
        "Collect real engineering evidence and use Gemma to explain relevant findings in context.",
    },
    {
      num: "04",
      icon: CheckCircle2,
      title: "Assess",
      description:
        "Review impact, evidence, and deterministic checks before deciding whether to ship safely.",
    },
  ];

  return (
    <section
      ref={sectionRef}
      id="method"
      className="w-full py-20 lg:pt-[130px] lg:pb-[140px] bg-[#101211] relative overflow-hidden"
    >
      <div className="page-container relative z-10">
        {/* Header */}
        <ScrollReveal>
          <div className="max-w-[780px]">
            <span className="font-mono text-[10px] tracking-[0.14em] text-[#C7F36B] uppercase font-medium">
              02 / THE METHOD
            </span>
            <h2 className="mt-4 font-display font-semibold text-[36px] sm:text-[44px] lg:text-[54px] leading-[1.05] tracking-[-0.06em] text-[#F0F2ED]">
              From code change to engineering clarity.
            </h2>
            <p className="mt-5 font-body text-[15px] sm:text-[16px] leading-[1.8] text-[#A0A79F] max-w-[540px]">
              A connected workflow that moves from repository evidence to an
              understandable engineering assessment.
            </p>
          </div>
        </ScrollReveal>

        {/* Workflow Steps */}

        {/* Desktop Layout (4 horizontal steps with animated connecting timeline line) */}
        <div className="hidden lg:block relative mt-20">
          {/* Animated horizontal connecting line */}
          <div
            ref={hLineRef}
            className="absolute top-[20px] left-[24px] right-[24px] h-[1px] bg-[#3A4338] z-0 line-draw-h"
            aria-hidden="true"
          />

          <div className="relative z-10 grid grid-cols-4 gap-6">
            {steps.map((step, idx) => {
              const IconComp = step.icon;
              const isHovered = hoveredStep === idx;
              return (
                <ScrollReveal key={step.num} delayMs={idx * 110}>
                  <div
                    onMouseEnter={() => setHoveredStep(idx)}
                    onMouseLeave={() => setHoveredStep(null)}
                    className="group flex flex-col items-start pr-4 transition-all duration-[260ms] cursor-pointer"
                  >
                    {/* 40x40px Circular Step Indicator */}
                    <div
                      className={`w-10 h-10 rounded-full bg-[#101211] border flex items-center justify-center font-mono text-[11px] font-medium shrink-0 transition-all duration-[240ms] ${
                        isHovered
                          ? "border-[#C7F36B] text-[#C7F36B] shadow-[0_0_16px_rgba(199,243,107,0.3)] scale-110"
                          : "border-[#46513F] text-[#C7F36B] group-hover:border-[#79D69A]"
                      }`}
                    >
                      {step.num}
                    </div>

                    {/* Step Card Content */}
                    <div className="mt-6">
                      <div className="flex items-center gap-2">
                        <IconComp
                          size={16}
                          className={`transition-colors duration-200 ${
                            isHovered ? "text-[#C7F36B]" : "text-[#6E776F] group-hover:text-[#A0A79F]"
                          }`}
                        />
                        <h3 className="font-display text-[22px] font-semibold text-[#F0F2ED] tracking-[-0.02em] group-hover:text-white transition-colors">
                          {step.title}
                        </h3>
                      </div>
                      <p className="mt-3 font-body text-[14px] leading-[1.8] text-[#A0A79F] group-hover:text-[#CBD1CA] transition-colors">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>

        {/* Tablet Layout (2x2 grid) */}
        <div className="hidden md:grid lg:hidden grid-cols-2 gap-10 mt-16">
          {steps.map((step, idx) => {
            const IconComp = step.icon;
            return (
              <ScrollReveal key={step.num} delayMs={idx * 90}>
                <div className="group flex flex-col items-start pr-4">
                  <div className="w-10 h-10 rounded-full bg-[#101211] border border-[#46513F] flex items-center justify-center font-mono text-[11px] font-medium text-[#C7F36B] shrink-0 group-hover:border-[#C7F36B] transition-colors">
                    {step.num}
                  </div>
                  <div className="mt-5">
                    <div className="flex items-center gap-2">
                      <IconComp size={16} className="text-[#6E776F] group-hover:text-[#C7F36B] transition-colors" />
                      <h3 className="font-display text-[22px] font-semibold text-[#F0F2ED] tracking-[-0.02em] group-hover:text-white transition-colors">
                        {step.title}
                      </h3>
                    </div>
                    <p className="mt-2.5 font-body text-[14px] leading-[1.8] text-[#A0A79F]">
                      {step.description}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        {/* Mobile Layout (Stacked vertically with vertical animated line) */}
        <div className="md:hidden relative mt-14 pl-12 flex flex-col gap-8">
          <div
            ref={vLineRef}
            className="absolute top-4 bottom-4 left-[19px] w-[1px] bg-[#3A4338] z-0 line-draw-v"
            aria-hidden="true"
          />

          {steps.map((step, idx) => {
            const IconComp = step.icon;
            return (
              <ScrollReveal key={step.num} delayMs={idx * 75}>
                <div className="relative z-10 flex flex-col items-start">
                  <div className="absolute -left-12 top-0 w-10 h-10 rounded-full bg-[#101211] border border-[#46513F] flex items-center justify-center font-mono text-[11px] font-medium text-[#C7F36B] shrink-0">
                    {step.num}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <IconComp size={15} className="text-[#C7F36B]" />
                      <h3 className="font-display text-[20px] font-semibold text-[#F0F2ED] tracking-[-0.02em]">
                        {step.title}
                      </h3>
                    </div>
                    <p className="mt-1.5 font-body text-[14px] leading-[1.8] text-[#A0A79F]">
                      {step.description}
                    </p>
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
