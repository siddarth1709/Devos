"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { GithubIcon } from "@/components/icons/github-icon";
import { ShieldCheck, AlertCircle, ArrowLeft, Lock, Sparkles } from "lucide-react";
import { DevosLogo } from "@/components/brand/devos-logo";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/app";
  const errorParam = searchParams.get("error");
  const { login, enterDemo, isLoading: isAuthChecking, isAuthenticated } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthChecking && isAuthenticated) {
      router.replace(returnTo);
    }
  }, [isAuthChecking, isAuthenticated, returnTo, router]);

  const handleGitHubLogin = () => {
    setIsSubmitting(true);
    login(returnTo);
  };

  const getErrorMessage = (err: string | null) => {
    if (!err) return null;
    if (err.includes("github_oauth_not_configured") || err.includes("not_configured")) {
      return "GitHub OAuth credentials are not set. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to apps/api/.env (see docs/github-oauth-setup.md).";
    }
    if (err.includes("invalid_or_expired_state") || err.includes("invalid_state")) {
      return "Authentication session timed out or state was invalid. Please try signing in again.";
    }
    if (err.includes("cancelled") || err.includes("access_denied")) {
      return "GitHub sign-in was cancelled. You must grant read authorization to continue.";
    }
    if (err.includes("missing_code_or_state")) {
      return "GitHub response was incomplete. Please retry.";
    }
    return `Unable to sign in: ${decodeURIComponent(err)}`;
  };

  const errorMessage = getErrorMessage(errorParam);

  return (
    <div className="min-h-screen bg-[#090A0A] flex flex-col justify-between p-4 sm:p-10 select-none overflow-x-hidden max-w-full">
      {/* Top Navigation */}
      <div className="flex items-center justify-between max-w-5xl mx-auto w-full">
        <Link
          href="/"
          className="group flex items-center text-[#F0F2ED] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C7F36B]"
          aria-label="Return to DEVOS homepage"
        >
          <DevosLogo size="md" />
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#A0A79F] hover:text-[#F0F2ED] transition-colors"
        >
          <ArrowLeft size={13} />
          <span>Back to Home</span>
        </Link>
      </div>

      {/* Main Authentication Panel */}
      <div className="max-w-[440px] w-full mx-auto my-auto py-6 space-y-6 min-w-0">
        {/* Error Notification if returned from callback failure */}
        {errorMessage && (
          <div
            role="alert"
            className="p-4 rounded-lg bg-[#F07878]/10 border border-[#F07878]/30 flex items-start gap-3 text-[#F07878] text-xs font-mono animate-in fade-in duration-200"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span className="break-words">{errorMessage}</span>
          </div>
        )}

        <div className="p-6 sm:p-10 rounded-xl bg-[#101211] border border-[#292E2A] shadow-2xl space-y-6 min-w-0">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#C7F36B] font-mono text-[10px] tracking-[0.12em] uppercase font-semibold">
              <Lock size={12} />
              <span>SECURE ACCESS</span>
            </div>
            <h1 className="font-display font-semibold text-[22px] sm:text-[28px] text-[#F0F2ED] tracking-[-0.03em] leading-[1.25] break-words">
              Engineering clarity starts here.
            </h1>
            <p className="font-body text-[13px] text-[#A0A79F] leading-[1.6] pt-1 break-words">
              Connect your GitHub account to understand code changes, investigate dependencies, and ship with confidence.
            </p>
          </div>

          {/* Primary GitHub CTA Button */}
          <div className="pt-2">
            <button
              onClick={handleGitHubLogin}
              disabled={isSubmitting || isAuthChecking}
              className="w-full flex items-center justify-center gap-3 h-[48px] bg-[#C7F36B] hover:bg-[#D7FF86] active:scale-[0.99] text-[#090A0A] font-mono text-[12px] font-semibold uppercase tracking-wider rounded-[6px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7F36B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101211] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-[#C7F36B]/5"
            >
              {isSubmitting || isAuthChecking ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#090A0A] border-t-transparent rounded-full animate-spin" />
                  <span>Connecting to GitHub...</span>
                </>
              ) : (
                <>
                  <GithubIcon size={18} />
                  <span>Continue with GitHub</span>
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#1D221F]"></div>
            <span className="flex-shrink mx-3 text-[#6E776F] font-mono text-[10px] uppercase tracking-wider">
              or instant evaluation
            </span>
            <div className="flex-grow border-t border-[#1D221F]"></div>
          </div>

          {/* Instant Demo Access Button */}
          <div>
            <button
              type="button"
              onClick={() => enterDemo()}
              disabled={isSubmitting || isAuthChecking}
              className="w-full flex items-center justify-center gap-2.5 h-[46px] bg-[#151816] hover:bg-[#1D221F] border border-[#E9B96E]/40 hover:border-[#E9B96E] text-[#E9B96E] font-mono text-[11px] font-semibold uppercase tracking-wider rounded-[6px] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9B96E] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm"
            >
              <Sparkles size={15} className="text-[#E9B96E]" />
              <span>Explore Instant Demo Mode</span>
            </button>
            <p className="mt-2 text-center font-mono text-[10px] text-[#6E776F]">
              Direct access with pre-loaded engineering graph and code review.
            </p>
          </div>

          {/* Privacy & Zero-Code Storage Pledge */}
          <div className="pt-4 border-t border-[#1D221F] space-y-2.5">
            <div className="flex items-start gap-2.5 text-[#6E776F] font-mono text-[11px] leading-[1.5]">
              <ShieldCheck size={14} className="text-[#79D69A] shrink-0 mt-0.5" />
              <span className="break-words">
                <strong>Zero Source Code Retention:</strong> DEVOS inspects diff ASTs in ephemeral memory. Your repository source code is never stored in persistent databases.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-5xl mx-auto w-full text-center text-[#6E776F] font-mono text-[10px] sm:text-[11px] px-2 py-4">
        DEVOS Engineering Intelligence System &middot; Production Release
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090A0A] flex items-center justify-center text-neutral-400 font-mono text-xs">
          Loading sign-in...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
