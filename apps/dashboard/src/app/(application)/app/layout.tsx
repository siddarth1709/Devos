"use client";

import { useState } from "react";
import { ApplicationSidebar } from "@/components/app-shell/application-sidebar";
import { ApplicationHeader } from "@/components/app-shell/application-header";
import { MobileNavDrawer } from "@/components/app-shell/mobile-nav-drawer";
import { ConnectGitHubModal } from "@/components/app-shell/connect-github-modal";

export default function ApplicationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

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

