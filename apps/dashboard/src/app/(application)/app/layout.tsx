"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApplicationSidebar } from "@/components/app-shell/application-sidebar";
import { ApplicationHeader } from "@/components/app-shell/application-header";
import { MobileNavDrawer } from "@/components/app-shell/mobile-nav-drawer";
import { ConnectGitHubModal } from "@/components/app-shell/connect-github-modal";
import { useAuth } from "@/hooks/use-auth";

export default function ApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const { isAuthenticated, isLoading, isBackendOffline } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isBackendOffline) {
      const returnTo = encodeURIComponent(pathname || "/app");
      router.replace(`/login?returnTo=${returnTo}`);
    }
  }, [isLoading, isAuthenticated, isBackendOffline, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#090A0A] flex flex-col items-center justify-center p-6 text-[#F0F2ED]">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <div className="h-8 w-8 border-2 border-[#292E2A] border-t-[#C7F36B] rounded-full animate-spin" />
          <div className="font-mono text-[11px] tracking-[0.14em] text-[#6E776F] uppercase">
            Verifying DEVOS Session...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !isBackendOffline) {
    return null;
  }

  return (
    <div className="min-h-screen w-full bg-[#090A0A] text-[#F0F2ED] flex flex-row overflow-x-hidden">
      {/* Desktop Persistent Sidebar */}
      <ApplicationSidebar
        onOpenConnectModal={() => setConnectModalOpen(true)}
      />

      {/* Mobile Navigation Drawer */}
      <MobileNavDrawer
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onOpenConnectModal={() => setConnectModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen overflow-x-hidden">
        {/* Top Header */}
        <ApplicationHeader
          onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
          onOpenConnectModal={() => setConnectModalOpen(true)}
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 w-full min-w-0 p-4 sm:p-6 lg:p-8 animate-entrance">
          {children}
        </main>
      </div>

      {/* Global GitHub Connection Modal */}
      <ConnectGitHubModal
        isOpen={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
      />
    </div>
  );
}

