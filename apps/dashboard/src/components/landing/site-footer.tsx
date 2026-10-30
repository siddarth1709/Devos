"use client";

import Link from "next/link";
import { ArrowUp } from "lucide-react";

export function SiteFooter() {
  const scrollToTop = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="w-full bg-[#090A0A] border-t border-[#292E2A] py-[44px]">
      <div className="page-container flex flex-col gap-8">
        {/* Main Footer Row */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          {/* Left: Brand */}
          <div className="flex flex-col items-start">
            <Link
              href="/"
              className="group flex items-center gap-[7px] text-[#F0F2ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7F36B] transition-transform duration-200 hover:scale-[1.01]"
              aria-label="DEVOS homepage"
            >
              <span className="font-display text-[21px] font-bold tracking-[-1.2px]">
                DEVOS
              </span>
              <span
                className="w-[6px] h-[6px] bg-[#C7F36B] inline-block shrink-0 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-45"
                aria-hidden="true"
              />
            </Link>
            <span className="mt-1 font-body text-[13px] text-[#A0A79F]">
              Engineering Intelligence
            </span>
          </div>

          {/* Right: Quick Links */}
          <nav
            className="flex flex-wrap items-center gap-6 md:gap-8 font-mono text-[11px] text-[#A0A79F]"
            aria-label="Footer Navigation"
          >
            <a
              href="#top"
              onClick={scrollToTop}
              className="group inline-flex items-center gap-1 hover:text-[#F0F2ED] transition-colors duration-[180ms] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C7F36B]"
            >
              <span>Back to top</span>
              <ArrowUp size={11} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
            </a>
            <a
              href="#method"
              className="hover:text-[#F0F2ED] transition-colors duration-[180ms] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C7F36B]"
            >
              Method
            </a>
            <a
              href="#product"
              className="hover:text-[#F0F2ED] transition-colors duration-[180ms] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C7F36B]"
            >
              Product
            </a>
            <a
              href="#principles"
              className="hover:text-[#F0F2ED] transition-colors duration-[180ms] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C7F36B]"
            >
              Principles
            </a>
          </nav>
        </div>

        {/* Bottom Metadata */}
        <div className="pt-6 border-t border-[#1D221F] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 font-mono text-[9px] tracking-[0.1em] text-[#6E776F] uppercase">
          <span>&copy; DEVOS</span>
          <span>BUILT FOR DEVELOPERS — ZERO UNNECESSARY ABSTRACTION</span>
        </div>
      </div>
    </footer>
  );
}
