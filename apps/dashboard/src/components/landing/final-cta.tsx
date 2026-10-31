"use client";

import { ArrowRight, Terminal } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";
import { ChangePropagationGraph } from "./change-propagation-graph";

export function FinalCTA() {
  return (
    <section className="relative w-full bg-[#C7F36B] text-[#090A0A] min-h-[650px] py-16 lg:py-24 px-6 sm:px-8 lg:px-12 xl:px-16 2xl:px-[88px] flex items-center overflow-hidden border-t border-[#090A0A]/10">
      {/* Background ambient radial highlight */}
      <div
        className="absolute -top-32 -right-32 w-[600px] h-[600px] bg-[#D7FF86] rounded-full blur-[140px] pointer-events-none opacity-70"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-[#B5E950] rounded-full blur-[130px] pointer-events-none opacity-40"
        aria-hidden="true"
      />

      <div className="w-full max-w-[1720px] mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 xl:gap-14 2xl:gap-16 items-center">
          {/* LEFT COLUMN: Editorial Headline & Actions (~46-48% width) */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col items-start justify-center text-left">
            <ScrollReveal>
              {/* Eyebrow Label */}
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 bg-[#090A0A] inline-block shrink-0" />
                <span className="font-mono text-[12px] sm:text-[13px] tracking-[0.14em] font-bold uppercase text-[#090A0A]">
                  DEVOS / ENGINEERING INTELLIGENCE
                </span>
              </div>

              {/* Massive Editorial Headline */}
              <h2 className="mt-5 font-display font-bold text-[40px] sm:text-[56px] md:text-[64px] lg:text-[68px] xl:text-[76px] 2xl:text-[84px] leading-[0.98] tracking-[-0.05em] text-[#090A0A]">
                Know what your code touches.
              </h2>

              {/* Supporting Text */}
              <p className="mt-6 font-body text-[17px] sm:text-[19px] 2xl:text-[21px] leading-[1.5] text-[#141815] max-w-[540px] font-normal">
                Make every change easier to understand and review before it reaches production.
              </p>

              {/* Primary CTA Button & Terminal Tag */}
              <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                <a
                  href="#method"
                  className="group relative inline-flex items-center justify-center gap-3 h-[52px] px-8 bg-[#090A0A] text-[#C7F36B] font-mono text-[12px] tracking-[0.08em] font-bold uppercase rounded-[4px] hover:bg-[#151816] hover:text-[#D7FF86] active:scale-[0.97] transition-all duration-[200ms] shadow-lg hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#090A0A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#C7F36B]"
                >
                  <span>EXPLORE THE METHOD</span>
                  <ArrowRight
                    size={16}
                    className="transition-transform duration-[220ms] ease-out group-hover:translate-x-1.5"
                  />
                </a>

                <div className="hidden sm:inline-flex items-center gap-2.5 px-3.5 py-3 border border-[#090A0A]/25 hover:border-[#090A0A]/50 bg-[#090A0A]/5 rounded-[4px] font-mono text-[11px] text-[#090A0A] tracking-wider transition-colors duration-150">
                  <Terminal size={13} className="text-[#090A0A]/80" />
                  <span>$ git push origin feature/clarity</span>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* RIGHT COLUMN: Custom Engineering Change Propagation Visualization (~52-54% width) */}
          <div className="lg:col-span-7 xl:col-span-7 w-full flex items-center justify-center">
            <ScrollReveal delayMs={100} className="w-full">
              <ChangePropagationGraph />
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
