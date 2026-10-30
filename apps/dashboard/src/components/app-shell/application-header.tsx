"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Menu, Activity } from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import { useGitHubStatus } from "@/hooks/use-devos-api";

interface ApplicationHeaderProps {
  onToggleMobileNav: () => void;
  onOpenConnectModal?: () => void;
}

export function ApplicationHeader({
  onToggleMobileNav,
  onOpenConnectModal,
}: ApplicationHeaderProps) {
  const pathname = usePathname();
  const { data: githubStatus, isError, isLoading } = useGitHubStatus();

  // Compute breadcrumbs based on pathname
  const segments = pathname.split("/").filter(Boolean);
  // e.g. ["app", "repositories", "123", "pulls", "456"]
  const breadcrumbs = [
    { label: "Console", href: "/app" },
  ];

  if (segments.includes("repositories")) {
    breadcrumbs.push({ label: "Repositories", href: "/app/repositories" });
    const repoIndex = segments.indexOf("repositories") + 1;
    if (segments[repoIndex] && segments[repoIndex] !== "repositories") {
      const repoId = segments[repoIndex];
      breadcrumbs.push({
        label: repoId,
        href: `/app/repositories/${repoId}`,
      });

      const pullsIndex = segments.indexOf("pulls") + 1;
      if (segments[pullsIndex]) {
        breadcrumbs.push({
          label: `PR #${segments[pullsIndex]}`,
          href: `/app/repositories/${repoId}/pulls/${segments[pullsIndex]}`,
        });
      }
    }
  } else if (segments.includes("graph")) {
    breadcrumbs.push({ label: "Dependency Graph", href: "/app/graph" });
  } else if (segments.includes("review")) {
    breadcrumbs.push({ label: "Code Review", href: "/app/review" });
  } else if (segments.includes("guard")) {
    breadcrumbs.push({ label: "Pre-ship Guard", href: "/app/guard" });
  } else if (segments.includes("actions")) {
    breadcrumbs.push({ label: "Actions", href: "/app/actions" });
  }

  return (
    <header className="h-[64px] sticky top-0 z-30 w-full bg-[#090A0A]/85 backdrop-blur-md border-b border-[#292E2A] px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileNav}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-[4px] border border-[#292E2A] text-[#A0A79F] hover:text-[#F0F2ED] bg-[#101211] shrink-0"
          aria-label="Open navigation drawer"
        >
          <Menu size={18} />
        </button>

        {/* Dynamic Breadcrumbs */}
        <nav
          className="flex items-center gap-1.5 text-[12px] font-mono min-w-0 overflow-hidden"
          aria-label="Breadcrumb Navigation"
        >
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <div key={crumb.href} className="flex items-center gap-1.5 min-w-0">
                {idx > 0 && (
                  <ChevronRight size={13} className="text-[#6E776F] shrink-0" />
                )}
                {isLast ? (
                  <span className="font-semibold text-[#F0F2ED] truncate max-w-[140px] sm:max-w-[200px]">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-[#A0A79F] hover:text-[#F0F2ED] transition-colors truncate max-w-[100px] sm:max-w-[140px]"
                  >
                    {crumb.label}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Right: API Status & User Context */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Backend Connectivity Status Pill */}
        <div
          className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-[3px] border border-[#222724] bg-[#101211] font-mono text-[10px] text-[#A0A79F]"
          title="Backend API Status (Builder 2 at http://localhost:4000/api)"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isLoading
                ? "bg-[#6E776F] animate-pulse"
                : isError
                ? "bg-[#E9B96E]"
                : "bg-[#79D69A]"
            }`}
          />
          <span className="hidden lg:inline">
            {isError ? "API: Awaiting Backend" : "API: Operational"}
          </span>
          <Activity size={12} className="text-[#6E776F]" />
        </div>

        {/* GitHub Connection Action / Badge */}
        {githubStatus?.status === "connected" ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-[4px] bg-[#151816] border border-[#292E2A] text-[11px] font-mono text-[#F0F2ED]">
            <GithubIcon size={13} className="text-[#79D69A]" />
            <span className="truncate max-w-[100px]">
              {githubStatus.user?.login || "Connected"}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenConnectModal}
            className="inline-flex items-center gap-1.5 px-3 h-[32px] bg-transparent border border-[#3A4338] text-[#C7F36B] hover:bg-[#C7F36B] hover:text-[#090A0A] font-mono text-[10px] tracking-wider uppercase font-semibold rounded-[3px] transition-all active:scale-[0.98]"
          >
            <GithubIcon size={12} />
            <span className="hidden xs:inline">Connect GitHub</span>
          </button>
        )}
      </div>
    </header>
  );
}
