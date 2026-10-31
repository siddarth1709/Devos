"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollReveal } from "./scroll-reveal";
import {
  GitPullRequest,
  Network,
  ShieldCheck,
  Rocket,
  CheckCircle2,
  FileCode,
  ArrowRight,
  Sparkles,
  Terminal,
} from "lucide-react";

interface WorkflowStage {
  id: string;
  stageNum: string;
  title: string;
  tagline: string;
  description: string;
  icon: typeof GitPullRequest;
  metrics: { label: string; value: string }[];
}

export function MethodSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState<number>(0);
  const [scrollProgress, setScrollProgress] = useState<number>(0);

  const stages: WorkflowStage[] = [
    {
      id: "understand",
      stageNum: "01",
      title: "UNDERSTAND",
      tagline: "Parse Changed Files & AST Symbols",
      description:
        "Inspect pull request diffs in-memory, parse modified source files across language grammars, and extract commit-aware AST symbols without cloning repositories to disk.",
      icon: GitPullRequest,
      metrics: [
        { label: "PARSED FILES", value: "6 files" },
        { label: "AST SYMBOLS", value: "24 extracted" },
        { label: "STORAGE OVERHEAD", value: "0 bytes" },
      ],
    },
    {
      id: "trace",
      stageNum: "02",
      title: "TRACE",
      tagline: "Transitive Blast Radius Mapping",
      description:
        "Traverse cross-file imports, function calls, and type definitions to trace how changes ripple through downstream modules, services, and internal APIs.",
      icon: Network,
      metrics: [
        { label: "DIRECT DEP", value: "4 modules" },
        { label: "TRANSITIVE RADIUS", value: "7 services" },
        { label: "BREAKING IMPACT", value: "0 detected" },
      ],
    },
    {
      id: "verify",
      stageNum: "03",
      title: "VERIFY",
      tagline: "Multi-Tier Evidence Collection",
      description:
        "Collect forensic proof from source unit tests, type checkers, and security heuristics. Local Gemma model evaluates findings against collected evidence in context.",
      icon: ShieldCheck,
      metrics: [
        { label: "EVIDENCE NODES", value: "18 collected" },
        { label: "TEST VERIFIED", value: "100% pass" },
        { label: "GEMMA EVALUATION", value: "Contextual" },
      ],
    },
    {
      id: "ship",
      stageNum: "04",
      title: "SHIP",
      tagline: "Deterministic Pre-Ship Guard Clearance",
      description:
        "Evaluate codified release policies, verify zero critical blockers, and assign a definitive readiness score. Green-light production merges with mathematical certainty.",
      icon: Rocket,
      metrics: [
        { label: "READINESS SCORE", value: "94 / 100" },
        { label: "RELEASE POLICY", value: "COMPLIANT" },
        { label: "ACTION STATUS", value: "READY TO SHIP" },
      ],
    },
  ];

  // Scroll listener for sticky progress calculation on desktop
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const track = trackRef.current;
          const sticky = stickyRef.current;
          if (!track || !sticky) {
            ticking = false;
            return;
          }

          const trackRect = track.getBoundingClientRect();
          const stickyHeight = sticky.offsetHeight;
          const topOffset = 96;
          const totalTravel = track.offsetHeight - stickyHeight;

          if (totalTravel <= 0) {
            ticking = false;
            return;
          }

          const currentScrolled = topOffset - trackRect.top;
          const progress = Math.min(
            1,
            Math.max(0, currentScrolled / totalTravel)
          );
          setScrollProgress(progress);

          // Assign 4 stages based on progress
          let newStage = 0;
          if (progress >= 0.78) {
            newStage = 3;
          } else if (progress >= 0.52) {
            newStage = 2;
          } else if (progress >= 0.26) {
            newStage = 1;
          } else {
            newStage = 0;
          }

          setActiveStage(newStage);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToStage = (index: number) => {
    setActiveStage(index);
    const track = trackRef.current;
    const sticky = stickyRef.current;
    if (!track || !sticky) return;
    const stickyHeight = sticky.offsetHeight;
    const topOffset = 96;
    const totalTravel = track.offsetHeight - stickyHeight;
    const targetScrollY =
      window.scrollY +
      track.getBoundingClientRect().top -
      topOffset +
      (index / 3) * totalTravel;

    window.scrollTo({
      top: targetScrollY,
      behavior: "smooth",
    });
  };

  const currentStage = stages[activeStage];

  return (
    <section
      id="method"
      className="w-full bg-[#101211] relative"
    >
      {/* SECTION HEADER (Scroll revealed) */}
      <div className="pt-20 lg:pt-28 pb-12 page-container relative z-10 border-b border-[#1D221F]">
        <ScrollReveal>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-[760px]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#C7F36B]" />
                <span className="font-mono text-[11px] tracking-[0.14em] text-[#C7F36B] uppercase font-semibold">
                  02 / THE METHOD
                </span>
              </div>
              <h2 className="mt-4 font-display font-semibold text-[36px] sm:text-[46px] lg:text-[58px] leading-[1.05] tracking-[-0.05em] text-[#F0F2ED]">
                From code change to engineering clarity.
              </h2>
              <p className="mt-4 font-body text-[15px] sm:text-[17px] leading-[1.7] text-[#A0A79F] max-w-[580px]">
                A connected four-stage workflow that transforms raw repository
                diffs into deterministic release decisions.
              </p>
            </div>

            {/* Stage Stepper Pill (desktop interactive) */}
            <div className="hidden lg:flex items-center gap-2 p-1.5 rounded-[6px] bg-[#151816] border border-[#292E2A]">
              {stages.map((st, idx) => (
                <button
                  key={st.id}
                  onClick={() => scrollToStage(idx)}
                  className={`px-3 py-1.5 rounded-[4px] font-mono text-[11px] font-semibold tracking-wider transition-all duration-200 ${
                    activeStage === idx
                      ? "bg-[#C7F36B] text-[#090A0A] shadow-sm"
                      : idx < activeStage
                      ? "text-[#79D69A] hover:bg-[#1B201C]"
                      : "text-[#6E776F] hover:text-[#A0A79F]"
                  }`}
                  aria-label={`Jump to stage ${st.stageNum}: ${st.title}`}
                >
                  {st.stageNum} {st.title}
                </button>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* DESKTOP STICKY STORYTELLING EXPERIENCE (lg and above) */}
      <div ref={trackRef} className="hidden lg:block relative w-full lg:h-[200vh]">
        <div
          ref={stickyRef}
          className="sticky top-[96px] h-[calc(100vh-120px)] max-h-[820px] flex items-center"
        >
          <div className="page-container w-full grid grid-cols-12 gap-10 items-center">
            {/* LEFT COLUMN: Stage Narration & Progress Navigation (5 cols) */}
            <div className="col-span-5 flex flex-col justify-center space-y-6">
              {/* Overall Progress Meter */}
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] tracking-widest text-[#6E776F] uppercase">
                  PROGRESS
                </span>
                <div className="flex-1 h-[2px] bg-[#1D221F] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#C7F36B] transition-all duration-150 ease-out"
                    style={{ width: `${Math.round(scrollProgress * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-[#C7F36B] font-semibold">
                  0{activeStage + 1} / 04
                </span>
              </div>

              {/* 4 Interactive Stage Accordion Items */}
              <div className="space-y-3">
                {stages.map((stage, idx) => {
                  const isActive = activeStage === idx;
                  const isCompleted = idx < activeStage;
                  const Icon = stage.icon;

                  return (
                    <div
                      key={stage.id}
                      onClick={() => scrollToStage(idx)}
                      role="button"
                      tabIndex={0}
                      className={`group p-4 rounded-[6px] border transition-all duration-300 cursor-pointer ${
                        isActive
                          ? "bg-[#151816] border-[#C7F36B]/60 shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
                          : isCompleted
                          ? "bg-[#101211]/80 border-[#292E2A]/70 hover:border-[#3A4338]"
                          : "bg-[#090A0A]/40 border-transparent hover:border-[#1D221F] opacity-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-mono text-[11px] font-bold tracking-widest px-1.5 py-0.5 rounded-[3px] ${
                              isActive
                                ? "bg-[#C7F36B] text-[#090A0A]"
                                : isCompleted
                                ? "bg-[#79D69A]/20 text-[#79D69A]"
                                : "bg-[#1D221F] text-[#6E776F]"
                            }`}
                          >
                            {stage.stageNum}
                          </span>
                          <h3
                            className={`font-display font-semibold text-[17px] tracking-[-0.02em] transition-colors ${
                              isActive
                                ? "text-[#F0F2ED]"
                                : isCompleted
                                ? "text-[#A0A79F]"
                                : "text-[#6E776F]"
                            }`}
                          >
                            {stage.title}
                          </h3>
                        </div>

                        {isCompleted ? (
                          <CheckCircle2 size={16} className="text-[#79D69A]" />
                        ) : (
                          <Icon
                            size={16}
                            className={
                              isActive ? "text-[#C7F36B]" : "text-[#6E776F]"
                            }
                          />
                        )}
                      </div>

                      {/* Expandable Active Description & Metrics */}
                      {isActive && (
                        <div className="mt-3 pt-3 border-t border-[#1D221F] space-y-3 animate-in fade-in duration-300">
                          <p className="font-body text-[13px] leading-[1.65] text-[#A0A79F]">
                            {stage.description}
                          </p>

                          {/* Stage key metrics */}
                          <div className="grid grid-cols-3 gap-2 pt-1">
                            {stage.metrics.map((m) => (
                              <div
                                key={m.label}
                                className="p-2 rounded-[3px] bg-[#090A0A] border border-[#1D221F]"
                              >
                                <span className="block font-mono text-[8px] text-[#6E776F] uppercase tracking-wider truncate">
                                  {m.label}
                                </span>
                                <span className="block font-mono text-[11px] font-semibold text-[#F0F2ED] mt-0.5 truncate">
                                  {m.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT COLUMN: Interactive Morphing Canvas (7 cols) */}
            <div className="col-span-7 h-[540px] w-full rounded-[8px] border border-[#292E2A] bg-[#090A0A] p-6 flex flex-col justify-between relative overflow-hidden shadow-2xl">
              {/* Background technical grid texture */}
              <div
                className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#F0F2ED_1px,transparent_1px)] [background-size:16px_16px]"
                aria-hidden="true"
              />

              {/* Stage Canvas Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#1D221F] relative z-10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#C7F36B] animate-pulse" />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-[#F0F2ED] font-semibold">
                    STAGE {currentStage.stageNum}: {currentStage.title}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-[#6E776F] uppercase">
                  {currentStage.tagline}
                </span>
              </div>

              {/* Dynamic Stage Canvas Center */}
              <div className="flex-1 flex items-center justify-center my-4 relative z-10">
                {/* STAGE 1 CANVAS: AST Symbol Extraction */}
                {activeStage === 0 && (
                  <div className="w-full max-w-[540px] space-y-4 animate-in fade-in zoom-in-95 duration-400">
                    <div className="p-4 rounded-[6px] bg-[#101211] border border-[#292E2A] font-mono text-[12px] space-y-2">
                      <div className="flex items-center justify-between text-[#6E776F] text-[10px] pb-2 border-b border-[#1D221F]">
                        <span>PR #142 • payment-gateway/auth.ts</span>
                        <span className="text-[#79D69A]">+184 / -42 lines</span>
                      </div>
                      <div className="text-[#A0A79F] space-y-1 font-mono text-[11px]">
                        <div className="text-[#F07878] line-through opacity-70">
                          - function verifyStripeSignature(payload, sig) &#123;
                        </div>
                        <div className="text-[#79D69A]">
                          + async function verifyStripeSignatureAsync(req, secret) &#123;
                        </div>
                        <div className="text-[#79D69A]">
                          + &nbsp;&nbsp;const hmac = crypto.createHmac(&apos;sha256&apos;, secret);
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-[4px] bg-[#151816] border border-[#C7F36B]/40">
                        <span className="font-mono text-[9px] text-[#C7F36B] uppercase font-bold tracking-wider">
                          EXTRACTED SYMBOL
                        </span>
                        <h4 className="font-mono text-[12px] text-[#F0F2ED] font-semibold mt-1">
                          verifyStripeSignatureAsync
                        </h4>
                        <span className="font-mono text-[10px] text-[#6E776F] block mt-0.5">
                          Type: FunctionDeclaration (Exported)
                        </span>
                      </div>
                      <div className="p-3 rounded-[4px] bg-[#151816] border border-[#292E2A]">
                        <span className="font-mono text-[9px] text-[#A0A79F] uppercase font-bold tracking-wider">
                          INGESTION STATUS
                        </span>
                        <h4 className="font-mono text-[12px] text-[#79D69A] font-semibold mt-1">
                          In-Memory AST Parsed
                        </h4>
                        <span className="font-mono text-[10px] text-[#6E776F] block mt-0.5">
                          SHA: 7c89f2a • Clean working copy
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* STAGE 2 CANVAS: Transitive Blast Radius Tree */}
                {activeStage === 1 && (
                  <div className="w-full max-w-[540px] space-y-4 animate-in fade-in zoom-in-95 duration-400">
                    <div className="p-4 rounded-[6px] bg-[#101211] border border-[#292E2A] space-y-3">
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#A0A79F]">
                        <span>PROPAGATION GRAPH</span>
                        <span className="text-[#C7F36B] font-semibold">
                          7 Downstream Nodes
                        </span>
                      </div>

                      {/* Visual dependency ripple */}
                      <div className="space-y-2 font-mono text-[11px]">
                        <div className="p-2.5 rounded bg-[#151816] border border-[#C7F36B] flex items-center justify-between">
                          <span className="text-[#C7F36B] font-bold">
                            auth.ts (MODIFIED)
                          </span>
                          <span className="text-[10px] text-[#C7F36B]">
                            Tier 0 Origin
                          </span>
                        </div>
                        <div className="pl-6 space-y-1.5 border-l-2 border-[#C7F36B]/40">
                          <div className="p-2 rounded bg-[#101211] border border-[#292E2A] flex items-center justify-between text-[11px]">
                            <span className="text-[#F0F2ED]">↳ session.ts</span>
                            <span className="text-[9px] text-[#A0A79F]">
                              Direct consumer
                            </span>
                          </div>
                          <div className="pl-6 space-y-1.5 border-l-2 border-[#79D69A]/40">
                            <div className="p-1.5 rounded bg-[#090A0A] border border-[#1D221F] flex items-center justify-between text-[10px]">
                              <span className="text-[#A0A79F]">
                                ↳ middleware.ts → api.ts
                              </span>
                              <span className="text-[9px] text-[#79D69A]">
                                Verified
                              </span>
                            </div>
                            <div className="p-1.5 rounded bg-[#090A0A] border border-[#1D221F] flex items-center justify-between text-[10px]">
                              <span className="text-[#A0A79F]">
                                ↳ billing.ts
                              </span>
                              <span className="text-[9px] text-[#E9B96E]">
                                Impacted
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STAGE 3 CANVAS: Forensic Evidence Matrix */}
                {activeStage === 2 && (
                  <div className="w-full max-w-[540px] space-y-3 animate-in fade-in zoom-in-95 duration-400">
                    <div className="p-3.5 rounded-[6px] bg-[#101211] border border-[#292E2A] space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-[#F0F2ED] font-semibold">
                          EVIDENCE CHECK: SEC-04
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#79D69A]/15 text-[#79D69A] text-[9px] font-bold">
                          VERIFIED
                        </span>
                      </div>
                      <p className="text-[12px] font-body text-[#A0A79F]">
                        Async HMAC digest verification prevents timing attack
                        vulnerabilities. Unit test coverage demonstrates zero
                        regression.
                      </p>
                      <div className="pt-2 border-t border-[#1D221F] flex items-center justify-between text-[10px] font-mono text-[#6E776F]">
                        <span>Source: tests/auth.test.ts:42</span>
                        <span>Confidence: 0.98</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-[6px] bg-[#101211] border border-[#292E2A] space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-[#F0F2ED] font-semibold">
                          GEMMA SYNTHESIS
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#C7F36B]/15 text-[#C7F36B] text-[9px] font-bold flex items-center gap-1">
                          <Sparkles size={10} />
                          <span>AI EVALUATION</span>
                        </span>
                      </div>
                      <p className="text-[12px] font-body text-[#A0A79F]">
                        &quot;Refactor addresses idempotency risks in webhook
                        listener without altering upstream route signatures.&quot;
                      </p>
                    </div>
                  </div>
                )}

                {/* STAGE 4 CANVAS: Pre-Ship Guard Clearance */}
                {activeStage === 3 && (
                  <div className="w-full max-w-[540px] space-y-4 animate-in fade-in zoom-in-95 duration-400">
                    <div className="p-6 rounded-[8px] bg-[#151816] border border-[#79D69A]/60 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[10px] tracking-widest text-[#79D69A] uppercase font-bold">
                          PRE-SHIP GUARD STATUS
                        </span>
                        <h3 className="font-display font-bold text-[32px] text-[#F0F2ED] tracking-tight mt-1">
                          94 <span className="text-[18px] text-[#A0A79F]">/ 100</span>
                        </h3>
                        <span className="font-mono text-[12px] text-[#79D69A] font-semibold mt-1 block">
                          SAFE TO SHIP • 0 BLOCKING ISSUES
                        </span>
                      </div>

                      <div className="w-16 h-16 rounded-full bg-[#79D69A]/15 border-2 border-[#79D69A] flex items-center justify-center text-[#79D69A]">
                        <CheckCircle2 size={32} />
                      </div>
                    </div>

                    <div className="p-3.5 rounded-[6px] bg-[#101211] border border-[#292E2A] flex items-center justify-between font-mono text-[11px]">
                      <span className="text-[#A0A79F]">
                        Release Confidence Verification:
                      </span>
                      <span className="text-[#C7F36B] font-bold">
                        DETERMINISTIC PASS
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Stage Canvas Footer */}
              <div className="pt-4 border-t border-[#1D221F] flex items-center justify-between text-[11px] font-mono text-[#6E776F] relative z-10">
                <span className="flex items-center gap-1.5">
                  <Terminal size={12} className="text-[#C7F36B]" />
                  <span>Pipeline step 0{activeStage + 1} of 04</span>
                </span>
                <span className="text-[#A0A79F]">Scroll to advance workflow</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE VERTICAL STACKED EXPERIENCE (lg:hidden) */}
      <div className="lg:hidden page-container py-12 space-y-8">
        {stages.map((stage) => {
          const Icon = stage.icon;
          return (
            <div
              key={stage.id}
              className="p-6 rounded-[8px] bg-[#151816] border border-[#292E2A] space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[#C7F36B] text-[#090A0A]">
                    {stage.stageNum}
                  </span>
                  <h3 className="font-display font-semibold text-[20px] text-[#F0F2ED]">
                    {stage.title}
                  </h3>
                </div>
                <Icon size={18} className="text-[#C7F36B]" />
              </div>

              <h4 className="font-mono text-[12px] text-[#C7F36B] font-medium">
                {stage.tagline}
              </h4>

              <p className="font-body text-[14px] leading-[1.65] text-[#A0A79F]">
                {stage.description}
              </p>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1D221F]">
                {stage.metrics.map((m) => (
                  <div
                    key={m.label}
                    className="p-2 rounded bg-[#090A0A] border border-[#1D221F]"
                  >
                    <span className="block font-mono text-[8px] text-[#6E776F] uppercase truncate">
                      {m.label}
                    </span>
                    <span className="block font-mono text-[10px] font-semibold text-[#F0F2ED] mt-0.5 truncate">
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
