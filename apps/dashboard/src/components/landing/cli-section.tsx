"use client";

import { useState } from "react";
import { ScrollReveal } from "./scroll-reveal";
import {
  Terminal,
  Download,
  Copy,
  Check,
  FolderArchive,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
} from "lucide-react";

export function CliSection() {
  const [activeTab, setActiveTab] = useState<"install" | "commands">("install");
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const installCode = `unzip devos-cli.zip -d devos-cli
cd devos-cli
python3 -m venv .venv
source .venv/bin/activate
pip install -e .`;

  const commands = [
    {
      cmd: "devos init <project>",
      desc: "Initialize a local project workspace for change intelligence.",
    },
    {
      cmd: "devos analyze",
      desc: "Parse AST symbols, discover dependency imports, and map blast radius.",
    },
    {
      cmd: "devos review",
      desc: "Run deterministic risk assessment and inspect collected evidence.",
    },
    {
      cmd: "devos diagnose",
      desc: "Perform comprehensive deep dependency and boundary health diagnostics.",
    },
    {
      cmd: "devos git status",
      desc: "Inspect active working tree status through change intelligence filters.",
    },
    {
      cmd: "devos ask \"Explain this change\"",
      desc: "Query repository context and evidence using local intelligence.",
    },
  ];

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch {
      setCopiedSnippet(false);
    }
  };

  return (
    <section
      id="cli"
      className="w-full py-20 lg:py-28 bg-[#090A0A] relative border-t border-[#292E2A]"
    >
      <div className="page-container relative z-10">
        <ScrollReveal>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-start">
            <div className="lg:col-span-6 flex flex-col items-start">
              <span className="font-mono text-[10px] tracking-[0.14em] text-[#C7F36B] uppercase font-medium">
                04 / COMMAND LINE INTERFACE
              </span>
              <h2 className="mt-4 font-display font-semibold text-[34px] sm:text-[42px] lg:text-[48px] leading-[1.05] tracking-[-0.055em] text-[#F0F2ED]">
                Local-first intelligence at your fingertips.
              </h2>
            </div>
            <div className="lg:col-span-6 lg:pt-10">
              <p className="font-body text-[15px] sm:text-[16px] leading-[1.8] text-[#A0A79F] max-w-[500px]">
                Operate DEVOS entirely from your terminal. Parse AST symbols, traverse dependency
                graphs, and inspect change evidence directly on your local machine with zero external telemetry.
              </p>
            </div>
          </div>
        </ScrollReveal>

        <div className="mt-14 lg:mt-18 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-8 bg-[#101211] border border-[#222724] rounded-[4px]">
            <div>
              <div className="flex items-center justify-between pb-5 border-b border-[#1D221F]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[3px] bg-[#151816] border border-[#292E2A] flex items-center justify-center text-[#C7F36B]">
                    <FolderArchive size={18} />
                  </div>
                  <div>
                    <h3 className="font-mono text-[14px] font-semibold text-[#F0F2ED]">
                      devos-cli.zip
                    </h3>
                    <span className="font-mono text-[10px] text-[#A0A79F]">
                      Release Package &bull; 6.1 KB
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-[2px] bg-[#C7F36B]/10 border border-[#C7F36B]/30 font-mono text-[9px] text-[#C7F36B] uppercase font-semibold">
                  Ready
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-[2px] bg-[#151816] border border-[#222724] flex items-center justify-center text-[#79D69A] shrink-0 mt-0.5">
                    <ShieldCheck size={12} />
                  </div>
                  <div className="text-[13px]">
                    <span className="font-semibold text-[#F0F2ED]">Pure Local Execution:</span>{" "}
                    <span className="text-[#A0A79F]">
                      No source files are modified during analyze or review workflows.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-[2px] bg-[#151816] border border-[#222724] flex items-center justify-center text-[#79D69A] shrink-0 mt-0.5">
                    <Cpu size={12} />
                  </div>
                  <div className="text-[13px]">
                    <span className="font-semibold text-[#F0F2ED]">Python 3.10+ Native:</span>{" "}
                    <span className="text-[#A0A79F]">
                      Built on Typer and Rich with instant terminal responsiveness.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-[2px] bg-[#151816] border border-[#222724] flex items-center justify-center text-[#79D69A] shrink-0 mt-0.5">
                    <Layers size={12} />
                  </div>
                  <div className="text-[13px]">
                    <span className="font-semibold text-[#F0F2ED]">Modular Intelligence:</span>{" "}
                    <span className="text-[#A0A79F]">
                      Engineered to integrate seamlessly with the DEVOS platform.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#1D221F] flex flex-col sm:flex-row items-center gap-3">
              <a
                href="/devos-cli.zip"
                download="devos-cli.zip"
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2.5 h-[46px] px-6 bg-[#C7F36B] hover:bg-[#D7FF86] text-[#090A0A] font-mono text-[11px] font-bold tracking-[0.08em] uppercase rounded-[4px] transition-all duration-200 active:scale-[0.98] shadow-md"
              >
                <Download size={14} />
                <span>Download devos-cli.zip</span>
              </a>
              <button
                type="button"
                onClick={() => handleCopy("curl -O https://devos.app/devos-cli.zip")}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-[46px] px-4 bg-[#151816] hover:bg-[#1D221F] border border-[#292E2A] text-[#A0A79F] hover:text-[#F0F2ED] font-mono text-[11px] rounded-[4px] transition-colors"
                title="Copy curl command"
              >
                <Copy size={13} />
                <span>curl</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 bg-[#050606] border border-[#222724] rounded-[4px] overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between px-4 py-3 bg-[#0C0E0D] border-b border-[#1D221F]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3A3F3B]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3A3F3B]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3A3F3B]" />
                  <span className="ml-2 font-mono text-[11px] text-[#6E776F] flex items-center gap-1.5">
                    <Terminal size={12} />
                    <span>terminal &mdash; devos</span>
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-[#101211] p-0.5 rounded-[3px] border border-[#1D221F]">
                  <button
                    type="button"
                    onClick={() => setActiveTab("install")}
                    className={`px-2.5 py-1 font-mono text-[10px] rounded-[2px] uppercase transition-colors ${
                      activeTab === "install"
                        ? "bg-[#1D221F] text-[#C7F36B] font-semibold"
                        : "text-[#A0A79F] hover:text-[#F0F2ED]"
                    }`}
                  >
                    Quick Setup
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("commands")}
                    className={`px-2.5 py-1 font-mono text-[10px] rounded-[2px] uppercase transition-colors ${
                      activeTab === "commands"
                        ? "bg-[#1D221F] text-[#C7F36B] font-semibold"
                        : "text-[#A0A79F] hover:text-[#F0F2ED]"
                    }`}
                  >
                    Commands
                  </button>
                </div>
              </div>

              {activeTab === "install" ? (
                <div className="p-5 font-mono text-[12px] sm:text-[13px] leading-relaxed">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#151816]">
                    <span className="text-[10px] uppercase tracking-wider text-[#6E776F]">
                      Installation Commands
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(installCode)}
                      className="inline-flex items-center gap-1.5 text-[10px] text-[#A0A79F] hover:text-[#C7F36B] transition-colors"
                    >
                      {copiedSnippet ? <Check size={12} className="text-[#79D69A]" /> : <Copy size={12} />}
                      <span>{copiedSnippet ? "COPIED" : "COPY SCRIPT"}</span>
                    </button>
                  </div>
                  <pre className="text-[#A0A79F] whitespace-pre-wrap overflow-x-auto">
                    <code>
                      <span className="text-[#6E776F]">$ </span>
                      <span className="text-[#F0F2ED]">unzip </span>
                      <span className="text-[#C7F36B]">devos-cli.zip</span>
                      <span className="text-[#F0F2ED]"> -d devos-cli</span>
                      {"\n"}
                      <span className="text-[#6E776F]">$ </span>
                      <span className="text-[#F0F2ED]">cd devos-cli</span>
                      {"\n"}
                      <span className="text-[#6E776F]">$ </span>
                      <span className="text-[#F0F2ED]">python3 -m venv .venv</span>
                      {"\n"}
                      <span className="text-[#6E776F]">$ </span>
                      <span className="text-[#F0F2ED]">source .venv/bin/activate</span>
                      {"\n"}
                      <span className="text-[#6E776F]">$ </span>
                      <span className="text-[#F0F2ED]">pip install -e .</span>
                      {"\n"}
                      {"\n"}
                      <span className="text-[#6E776F]">$ </span>
                      <span className="text-[#C7F36B]">devos --help</span>
                    </code>
                  </pre>
                </div>
              ) : (
                <div className="p-4 sm:p-5 divide-y divide-[#151816] max-h-[290px] overflow-y-auto">
                  {commands.map((c) => (
                    <div
                      key={c.cmd}
                      className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 sm:gap-4"
                    >
                      <button
                        type="button"
                        onClick={() => handleCopy(c.cmd)}
                        className="group flex items-center gap-2 font-mono text-[12px] text-[#C7F36B] hover:text-[#D7FF86] text-left"
                      >
                        <span className="text-[#6E776F] group-hover:text-[#A0A79F]">$</span>
                        <span className="font-semibold">{c.cmd}</span>
                      </button>
                      <span className="font-mono text-[11px] text-[#A0A79F]">
                        {c.desc}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-[#0A0C0B] border-t border-[#1D221F] flex items-center justify-between text-[11px] font-mono text-[#6E776F]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#79D69A]" />
                <span>Compatible with Linux, macOS &amp; Windows WSL</span>
              </div>
              <a
                href="/devos-cli.zip"
                download="devos-cli.zip"
                className="inline-flex items-center gap-1 text-[#C7F36B] hover:underline"
              >
                <span>Get Package</span>
                <ArrowRight size={11} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
