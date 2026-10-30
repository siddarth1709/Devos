"use client";

import { useEffect, useRef } from "react";
import { X, Shield, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import { api } from "@/lib/api-client";
import { useState } from "react";

interface ConnectGitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectGitHubModal({ isOpen, onClose }: ConnectGitHubModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const { authUrl } = await api.initiateGitHubConnect();
      if (authUrl) {
        window.location.href = authUrl;
      }
    } catch (err: unknown) {
      setErrorMsg(
        (err as { message?: string })?.message ||
          "Unable to initiate GitHub OAuth. Builder 2's backend service at http://localhost:4000/api may be offline."
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-entrance"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-[520px] bg-[#101211] border border-[#292E2A] rounded-[6px] shadow-2xl p-6 sm:p-7 relative select-none"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-[#A0A79F] hover:text-[#F0F2ED] transition-colors p-1"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pb-5 border-b border-[#1D221F]">
          <div className="w-10 h-10 rounded-[4px] bg-[#151816] border border-[#292E2A] flex items-center justify-center text-[#F0F2ED]">
            <GithubIcon size={20} />
          </div>
          <div>
            <h2 id="modal-title" className="font-display font-semibold text-[19px] text-[#F0F2ED]">
              Connect GitHub Organization
            </h2>
            <p className="font-body text-[12px] text-[#A0A79F]">
              DEVOS analyzes real code changes and computes transitive blast radius.
            </p>
          </div>
        </div>

        {/* Why DEVOS Requires Access */}
        <div className="py-5 space-y-3.5">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={16} className="text-[#C7F36B] shrink-0 mt-0.5" />
            <div>
              <span className="font-body font-medium text-[13px] text-[#F0F2ED]">
                Read Pull Request Diffs & Trees
              </span>
              <p className="font-body text-[12px] text-[#A0A79F] leading-[1.6]">
                Extracts modified AST symbols, file paths, and diff hunks to trace impact across dependent services.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Shield size={16} className="text-[#79D69A] shrink-0 mt-0.5" />
            <div>
              <span className="font-body font-medium text-[13px] text-[#F0F2ED]">
                Read Commit & Branch Metadata
              </span>
              <p className="font-body text-[12px] text-[#A0A79F] leading-[1.6]">
                Identifies default branches and recent merge points to compute deterministic release readiness.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Lock size={16} className="text-[#C7F36B] shrink-0 mt-0.5" />
            <div>
              <span className="font-body font-medium text-[13px] text-[#F0F2ED]">
                Zero Code Storage Policy
              </span>
              <p className="font-body text-[12px] text-[#A0A79F] leading-[1.6]">
                DEVOS does not store your source files. Analysis occurs in-memory per job lifecycle.
              </p>
            </div>
          </div>
        </div>

        {/* Error message if backend offline */}
        {errorMsg && (
          <div className="p-3 mb-4 rounded-[4px] bg-[#F07878]/10 border border-[#F07878]/30 flex items-start gap-2.5 text-[#F07878] font-body text-[12px]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="pt-4 border-t border-[#1D221F] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-[40px] text-[12px] font-mono uppercase text-[#A0A79F] hover:text-[#F0F2ED] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConnect}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-5 h-[40px] bg-[#C7F36B] text-[#090A0A] font-mono text-[11px] font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#D7FF86] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <GithubIcon size={14} />
            <span>{isSubmitting ? "Connecting..." : "Authorize with GitHub"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
