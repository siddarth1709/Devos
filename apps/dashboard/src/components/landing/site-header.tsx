"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X, ArrowUpRight } from "lucide-react";

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { label: "Impact", href: "#impact-trace" },
    { label: "Product", href: "#product" },
    { label: "Method", href: "#method" },
    { label: "Principles", href: "#principles" },
  ];

  // Track active section and scroll offset
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      const scrollY = window.scrollY + 140;
      const sections = ["principles", "method", "product", "impact-trace", "top"];

      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          if (scrollY >= top) {
            setActiveSection(`#${sectionId}`);
            return;
          }
        }
      }
      setActiveSection("");
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Prevent background scrolling and handle Escape key for mobile menu
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <header
      className={`sticky top-0 z-50 w-full h-[76px] transition-all duration-[300ms] ${
        isScrolled
          ? "bg-[#090A0A]/92 backdrop-blur-md border-b border-[#292E2A] shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
          : "bg-[#090A0A]/70 backdrop-blur-sm border-b border-[#1D221F]"
      }`}
    >
      <div className="page-container h-full flex items-center justify-between">
        {/* Left: DEVOS Wordmark */}
        <Link
          href="/"
          className="group flex items-center gap-[7px] text-[#F0F2ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7F36B] transition-transform duration-200 hover:scale-[1.01]"
          aria-label="DEVOS homepage"
        >
          <span className="font-display text-[23px] font-bold tracking-[-1.4px]">
            DEVOS
          </span>
          <span
            className="w-[7px] h-[7px] bg-[#C7F36B] inline-block shrink-0 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-45"
            aria-hidden="true"
          />
        </Link>

        {/* Center: Desktop Navigation */}
        <nav
          className="hidden md:flex items-center gap-8"
          aria-label="Main Navigation"
        >
          {navLinks.map((link) => {
            const isActive = activeSection === link.href;
            return (
              <a
                key={link.href}
                href={link.href}
                className={`group relative py-1 text-[12px] font-medium tracking-wide transition-colors duration-[200ms] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C7F36B] ${
                  isActive ? "text-[#F0F2ED]" : "text-[#A0A79F] hover:text-[#F0F2ED]"
                }`}
              >
                {link.label}
                {/* Animated underline / active indicator */}
                <span
                  className={`absolute -bottom-1 left-0 w-full h-[1.5px] bg-[#C7F36B] transition-all duration-[240ms] ease-out origin-left ${
                    isActive
                      ? "opacity-100 scale-x-100"
                      : "opacity-0 scale-x-0 group-hover:opacity-70 group-hover:scale-x-100"
                  }`}
                  aria-hidden="true"
                />
              </a>
            );
          })}
        </nav>

        {/* Right: Desktop CTA */}
        <div className="hidden md:flex items-center">
          <a
            href="#product"
            className="group relative inline-flex items-center gap-1.5 h-[38px] px-4 border border-[#3A4338] bg-transparent text-[#C7F36B] font-mono text-[10px] tracking-[0.06em] uppercase rounded-[3px] hover:bg-[#C7F36B] hover:text-[#090A0A] hover:border-[#C7F36B] transition-all duration-[220ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7F36B] active:scale-[0.98] shadow-sm hover:shadow-[0_0_16px_rgba(199,243,107,0.25)]"
          >
            <span>EXPLORE DEVOS</span>
            <ArrowUpRight
              size={12}
              className="transition-transform duration-[200ms] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        </div>

        {/* Mobile: Menu Toggle Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden flex items-center justify-center w-10 h-10 shrink-0 border border-[#292E2A] rounded-[4px] text-[#F0F2ED] bg-[#101211] hover:border-[#6E776F] active:bg-[#151816] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7F36B]"
          aria-expanded={isOpen}
          aria-controls="mobile-nav-panel"
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {isOpen ? (
            <X size={18} className="transition-transform duration-200 rotate-90" />
          ) : (
            <Menu size={18} className="transition-transform duration-200" />
          )}
        </button>
      </div>

      {/* Mobile Dropdown Panel with Smooth Animated Container */}
      <div
        id="mobile-nav-panel"
        ref={menuRef}
        className={`md:hidden absolute top-[76px] left-0 w-full bg-[#101211] border-b border-[#292E2A] shadow-2xl z-50 overflow-hidden transition-all duration-[350ms] ${
          isOpen
            ? "max-h-[340px] opacity-100 pointer-events-auto"
            : "max-h-0 opacity-0 pointer-events-none"
        }`}
        style={{
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="page-container py-4 flex flex-col divide-y divide-[#1D221F]">
          {navLinks.map((link, idx) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className={`flex items-center h-12 text-[14px] font-medium transition-all duration-200 ${
                activeSection === link.href ? "text-[#C7F36B] pl-1 font-semibold" : "text-[#A0A79F] hover:text-[#F0F2ED]"
              } ${isOpen ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}
              style={{
                transitionDelay: `${idx * 45 + 50}ms`,
              }}
            >
              {link.label}
            </a>
          ))}
          <div
            className={`pt-4 pb-2 transition-all duration-200 ${
              isOpen ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
            }`}
            style={{
              transitionDelay: `${navLinks.length * 45 + 50}ms`,
            }}
          >
            <a
              href="#product"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 w-full h-[44px] border border-[#3A4338] bg-transparent text-[#C7F36B] font-mono text-[11px] tracking-[0.06em] uppercase rounded-[4px] hover:bg-[#C7F36B] hover:text-[#090A0A] hover:border-[#C7F36B] active:scale-[0.99] transition-all duration-200"
            >
              <span>EXPLORE DEVOS</span>
              <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
