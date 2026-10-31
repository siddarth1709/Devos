"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/app";
  const error = searchParams.get("error");
  const { refresh } = useAuth();

  useEffect(() => {
    if (error) {
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    // Refresh auth state to read newly established session cookie
    refresh().then(() => {
      const destination = returnTo && returnTo.startsWith("/") ? returnTo : "/app";
      router.replace(destination);
    });
  }, [error, returnTo, refresh, router]);

  return (
    <div className="min-h-screen bg-[#090A0A] flex flex-col items-center justify-center p-6 text-[#F0F2ED]">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center">
        <div className="w-8 h-8 border-2 border-[#C7F36B] border-t-transparent rounded-full animate-spin" />
        <div className="space-y-1">
          <h2 className="font-display text-[18px] font-semibold">
            Connecting your GitHub account...
          </h2>
          <p className="font-mono text-[12px] text-[#A0A79F]">
            Establishing secure session with DEVOS.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090A0A] flex items-center justify-center text-neutral-400 font-mono text-xs">
          Completing sign-in...
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}

