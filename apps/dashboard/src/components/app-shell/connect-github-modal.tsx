"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Lock, CheckCircle2, AlertCircle, FolderGit2 } from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import { api } from "@/lib/api-client";
import { useCreateRepository } from "@/hooks/use-devos-api";

interface ConnectGitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectGitHubModal({ isOpen, onClose }: ConnectGitHubModalProps) {
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"register" | "oauth">("register");
  
  // Registration form fields
  const [repoPath, setRepoPath] = useState("");
  const [repoName, setRepoName] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createRepoMutation = useCreateRepository();

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

  const handleOAuthConnect = async () => {
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
          "Unable to initiate GitHub OAuth. Please verify backend service is running."
      );
      setIsSubmitting(false);
    }
  };

  const handleRegisterRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoPath.trim()) {
      setErrorMsg("Repository filesystem path is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const newRepo = await createRepoMutation.mutateAsync({
        path: repoPath.trim(),
        name: repoName.trim() || undefined,
        defaultBranch: defaultBranch.trim() || "main",
      });

      onClose();
      router.push(`/app/repositories/${encodeURIComponent(newRepo.id)}`);
    } catch (err: unknown) {
      const apiErr = err as { message?: string; code?: string };
      setErrorMsg(
        apiErr.message ||
          "Failed to register repository. Ensure the directory is an accessible Git repository."
      );
    } finally {
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
        className="w-full max-w-[540px] bg-[#101211] border border-[#292E2A] rounded-[6px] shadow-2xl p-6 sm:p-7 relative select-none"
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
        <div className="flex items-center gap-3 pb-4 border-b border-[#1D221F]">
          <div className="w-10 h-10 rounded-[4px] bg-[#151816] border border-[#292E2A] flex items-center justify-center text-[#C7F36B]">
            <FolderGit2 size={20} />
          </div>
          <div>
            <h2 id="modal-title" className="font-display font-semibold text-[19px] text-[#F0F2ED]">
              Connect Repository
            </h2>
            <p className="font-body text-[12px] text-[#A0A79F]">
              Register an existing repository with DEVOS backend engine.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#1D221F] mt-4 mb-5">
          <button
            type="button"
            onClick={() => {
              setActiveTab("register");
              setErrorMsg(null);
            }}
            className={`pb-2.5 px-3 font-mono text-[11px] font-semibold tracking-wider transition-colors border-b-2 -mb-[1px] ${
              activeTab === "register"
                ? "border-[#C7F36B] text-[#C7F36B]"
                : "border-transparent text-[#6E776F] hover:text-[#A0A79F]"
            }`}
          >
            REGISTER REPOSITORY
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("oauth");
              setErrorMsg(null);
            }}
            className={`pb-2.5 px-3 font-mono text-[11px] font-semibold tracking-wider transition-colors border-b-2 -mb-[1px] ${
              activeTab === "oauth"
                ? "border-[#C7F36B] text-[#C7F36B]"
                : "border-transparent text-[#6E776F] hover:text-[#A0A79F]"
            }`}
          >
            GITHUB OAUTH
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 mb-4 rounded-[4px] bg-[#F07878]/10 border border-[#F07878]/30 flex items-start gap-2.5 text-[#F07878] font-body text-[12px]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab 1: Register Repository Form */}
        {activeTab === "register" ? (
          <form onSubmit={handleRegisterRepo} className="space-y-4">
            <div>
              <label className="block font-mono text-[10px] tracking-wider text-[#A0A79F] uppercase mb-1">
                Repository Filesystem Path <span className="text-[#C7F36B]">*</span>
              </label>
              <input
                type="text"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                placeholder="/Users/username/Projects/my-app"
                className="w-full h-[38px] px-3 bg-[#151816] border border-[#292E2A] rounded-[4px] text-[13px] font-mono text-[#F0F2ED] placeholder:text-[#6E776F] focus:outline-none focus:border-[#C7F36B]"
                required
              />
              <span className="block font-body text-[11px] text-[#6E776F] mt-1">
                Absolute path to a local Git repository accessible by the backend engine.
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[10px] tracking-wider text-[#A0A79F] uppercase mb-1">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="my-app"
                  className="w-full h-[38px] px-3 bg-[#151816] border border-[#292E2A] rounded-[4px] text-[13px] font-mono text-[#F0F2ED] placeholder:text-[#6E776F] focus:outline-none focus:border-[#C7F36B]"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] tracking-wider text-[#A0A79F] uppercase mb-1">
                  Default Branch
                </label>
                <input
                  type="text"
                  value={defaultBranch}
                  onChange={(e) => setDefaultBranch(e.target.value)}
                  placeholder="main"
                  className="w-full h-[38px] px-3 bg-[#151816] border border-[#292E2A] rounded-[4px] text-[13px] font-mono text-[#F0F2ED] placeholder:text-[#6E776F] focus:outline-none focus:border-[#C7F36B]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-[#1D221F] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 h-[38px] text-[11px] font-mono uppercase text-[#A0A79F] hover:text-[#F0F2ED]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !repoPath.trim()}
                className="inline-flex items-center justify-center gap-2 px-5 h-[38px] bg-[#C7F36B] text-[#090A0A] font-mono text-[11px] font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#D7FF86] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <span>{isSubmitting ? "Registering..." : "Register Repository"}</span>
              </button>
            </div>
          </form>
        ) : (
          /* Tab 2: GitHub OAuth Authorize */
          <div className="space-y-4">
            <div className="space-y-3 py-2">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={16} className="text-[#C7F36B] shrink-0 mt-0.5" />
                <div>
                  <span className="font-body font-medium text-[13px] text-[#F0F2ED]">
                    Read Commits, Pull Requests & Diffs
                  </span>
                  <p className="font-body text-[12px] text-[#A0A79F] leading-[1.6]">
                    Authenticates user identity and grants access to read public and authorized organization repositories.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Lock size={16} className="text-[#C7F36B] shrink-0 mt-0.5" />
                <div>
                  <span className="font-body font-medium text-[13px] text-[#F0F2ED]">
                    Zero Permanent Code Storage Policy
                  </span>
                  <p className="font-body text-[12px] text-[#A0A79F] leading-[1.6]">
                    DEVOS does not clone or store your source files permanently. AST extraction runs in-memory.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#1D221F] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 h-[38px] text-[11px] font-mono uppercase text-[#A0A79F] hover:text-[#F0F2ED]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOAuthConnect}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-5 h-[38px] bg-[#C7F36B] text-[#090A0A] font-mono text-[11px] font-semibold uppercase tracking-wider rounded-[4px] hover:bg-[#D7FF86] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <GithubIcon size={14} />
                <span>{isSubmitting ? "Connecting..." : "Authorize with GitHub"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
