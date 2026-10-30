"use client";

import { ArrowRight, Terminal } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";

export function FinalCTA() {
  return (
    <section className="relative w-full bg-[#C7F36B] text-[#090A0A] py-[72px] px-[20px] sm:px-8 md:py-[104px] md:px-[64px] min-h-[390px] flex items-center overflow-hidden">
      {/* Background radial accent glow */}
      <div
        className="absolute -top-24 -right-24 w-96 h-96 bg-[#D7FF86] rounded-full blur-[90px] pointer-events-none opacity-60"
        aria-hidden="true"
      />

      <div className="w-full max-w-[1440px] mx-auto relative z-10">
        <ScrollReveal>
          <div className="flex flex-col items-start justify-center text-left">
            {/* Eyebrow */}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#090A0A] inline-block" />
              <span className="font-mono text-[10px] tracking-[0.14em] font-semibold uppercase text-[#090A0A]">
                DEVOS / ENGINEERING INTELLIGENCE
              </span>
            </div>

            {/* Heading */}
            <h2 className="mt-4 font-display font-semibold text-[30px] sm:text-[46px] lg:text-[64px] leading-[1.0] tracking-[-0.06em] text-[#090A0A] max-w-[800px]">
              Know what your code touches.
            </h2>

            {/* Description */}
            <p className="mt-4 font-body text-[15px] sm:text-[16px] leading-[1.7] text-[#1B201C] max-w-[520px]">
              Make every change easier to understand and review before it reaches production.
            </p>

            {/* Interactive CTA Button & Terminal Indicator */}
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <a
                href="#method"
                className="group relative inline-flex items-center justify-center gap-2 h-[48px] px-6 bg-[#090A0A] text-[#C7F36B] font-mono text-[11px] tracking-[0.06em] font-semibold uppercase rounded-[4px] hover:bg-[#1B201C] hover:text-[#D7FF86] active:scale-[0.98] transition-all duration-[220ms] shadow-lg hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#090A0A]"
              >
                <span>EXPLORE THE METHOD</span>
                <ArrowRight
                  size={14}
                  className="transition-transform duration-[220ms] group-hover:translate-x-1.5"
                />
              </a>

              <div className="hidden sm:inline-flex items-center gap-2 px-3 py-2 border border-[#090A0A]/20 rounded-[3px] font-mono text-[10px] text-[#090A0A]/80 tracking-wider">
                <Terminal size={12} />
                <span>$ git push origin feature/clarity</span>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
