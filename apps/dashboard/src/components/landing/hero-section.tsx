"use client";

import { useState, useRef } from "react";
import { ArrowRight } from "lucide-react";
import { PorousLatticeSphere } from "./porous-lattice-sphere";

export function HeroSection() {
  const [magnetPos, setMagnetPos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const primaryCtaRef = useRef<HTMLAnchorElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - (rect.left + rect.width / 2)) * 0.18;
    const y = (e.clientY - (rect.top + rect.height / 2)) * 0.18;
    setMagnetPos({ x, y });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setMagnetPos({ x: 0, y: 0 });
  };

  return (
    <section
      id="top"
      className="relative w-full min-h-[660px] lg:min-h-[780px] xl:min-h-[840px] pt-8 sm:pt-14 md:pt-16 lg:pt-[96px] pb-14 sm:pb-16 md:pb-24 lg:pb-[96px] bg-[#090A0A] overflow-hidden"
    >
      {/* Subtle ambient radial glow in background */}
      <div
        className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-[#C7F36B]/[0.035] rounded-full blur-[140px] pointer-events-none ambient-hero-glow z-0"
        aria-hidden="true"
      />
      <div
        className="absolute top-1/2 right-10 w-[500px] h-[500px] bg-[#C7F36B]/[0.025] rounded-full blur-[140px] pointer-events-none ambient-hero-glow z-0"
        style={{ animationDelay: "-4.5s" }}
        aria-hidden="true"
      />

      <div className="page-container min-w-0 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-center min-w-0">
          {/* Left Column (Content) */}
          <div className="min-w-0 lg:col-span-7 xl:col-span-6 flex flex-col items-start text-left z-10">
            {/* Technical Eyebrow */}
            <div className="animate-entrance delay-1 flex items-center gap-[10px] text-[#C7F36B] font-mono text-[10px] tracking-[0.14em] uppercase font-medium">
              <span
                className="w-[6px] h-[6px] bg-[#C7F36B] inline-block shrink-0 shadow-[0_0_8px_rgba(199,243,107,0.4)]"
                aria-hidden="true"
              />
              <span>ENGINEERING INTELLIGENCE / 001</span>
            </div>

            {/* Oversized Two-Line Headline with Masked Reveals */}
            <h1 className="mt-4 sm:mt-5 font-display font-semibold text-[26px] min-[380px]:text-[28px] sm:text-[44px] md:text-[56px] lg:text-[66px] xl:text-[76px] leading-[1.05] sm:leading-[1.0] tracking-[-0.05em] text-[#F0F2ED] max-w-[840px]">
              <span className="masked-line-wrapper">
                <span className="block animate-masked-heading-1">
                  Understand the impact.
                </span>
              </span>
              <span className="masked-line-wrapper mt-1">
                <span className="block text-[#C7F36B] animate-masked-heading-2">
                  Before you ship.
                </span>
              </span>
            </h1>

            {/* Supporting Copy */}
            <p className="animate-entrance delay-3 mt-4 sm:mt-6 font-body text-[14px] sm:text-[16px] xl:text-[17px] leading-[1.8] text-[#A0A79F] max-w-[560px]">
              DEVOS connects code changes, dependency impact, and engineering
              evidence to help developers understand what a change touches and
              what deserves attention before release.
            </p>

            {/* Hero CTAs */}
            <div className="animate-entrance delay-4 mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <a
                ref={primaryCtaRef}
                href="#impact-trace"
                onMouseMove={handleMouseMove}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                style={{
                  transform: `translate3d(${magnetPos.x}px, ${magnetPos.y}px, 0)`,
                  transition: isHovered
                    ? "transform 80ms ease-out, background-color 220ms var(--ease-interactive), box-shadow 250ms var(--ease-interactive)"
                    : "transform 350ms var(--ease-primary), background-color 220ms var(--ease-interactive), box-shadow 250ms var(--ease-interactive)",
                }}
                className="group relative inline-flex items-center justify-center gap-2 h-[46px] sm:h-[48px] px-5 sm:px-6 bg-[#C7F36B] text-[#090A0A] font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.05em] uppercase rounded-[4px] hover:bg-[#D7FF86] active:scale-[0.98] shadow-sm hover:shadow-[0_0_24px_rgba(199,243,107,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7F36B] will-change-transform"
              >
                <span>EXPLORE THE SYSTEM</span>
                <ArrowRight
                  size={14}
                  className="transition-transform duration-[220ms] group-hover:translate-x-1.5"
                />
              </a>
              <a
                href="#method"
                className="inline-flex items-center justify-center h-[46px] sm:h-[48px] px-4 sm:px-5 bg-transparent text-[#F0F2ED] font-mono text-[10px] sm:text-[11px] tracking-[0.05em] uppercase border border-[#292E2A] rounded-[4px] hover:border-[#6E776F] hover:bg-[#101211] active:scale-[0.98] transition-all duration-[200ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7F36B]"
              >
                HOW IT WORKS
              </a>
            </div>

            {/* Supporting Metadata Label */}
            <p className="animate-entrance delay-5 mt-6 sm:mt-8 font-mono text-[9px] tracking-[0.09em] text-[#6E776F] uppercase">
              BUILT AROUND CODE. GROUNDED IN EVIDENCE.
            </p>
          </div>

          {/* Right Column (Spherical 3D Element from nssanjeev/ciirc) */}
          <div className="min-w-0 lg:col-span-5 xl:col-span-6 w-full flex items-center justify-center lg:justify-end mt-4 lg:mt-0 animate-entrance delay-3 relative">
            <PorousLatticeSphere />
          </div>
        </div>
      </div>
    </section>
  );
}
