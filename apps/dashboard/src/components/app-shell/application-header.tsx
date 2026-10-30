"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  Menu,
  Activity,
  LogOut,
  User as UserIcon,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import { DevosLogo } from "@/components/brand/devos-logo";
import { useAuth } from "@/hooks/use-auth";
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
  const { user, isAuthenticated, isDemo, logout, exitDemo } = useAuth();
  const { isError, isLoading } = useGitHubStatus();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  // Compute breadcrumbs based on pathname
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs = [{ label: "Console", href: "/app" }];

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
      {/* Left: Mobile Toggle, Brand Icon & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileNav}
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-[4px] border border-[#292E2A] text-[#A0A79F] hover:text-[#F0F2ED] bg-[#101211] shrink-0"
          aria-label="Open navigation drawer"
        >
          <Menu size={18} />
        </button>

        <Link
          href="/app"
          className="md:hidden flex items-center text-[#F0F2ED] shrink-0"
          aria-label="DEVOS home"
        >
          <DevosLogo size="sm" showWordmark={false} />
        </Link>

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
          title="Backend API Status (Fastify on port 3001)"
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
            {isError ? "API: Awaiting Backend" : "API: Connected"}
          </span>
          <Activity size={12} className="text-[#6E776F]" />
        </div>

        {/* Authenticated User Menu or Sign In */}
        {isAuthenticated && user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 px-2.5 py-1 rounded-[4px] bg-[#151816] hover:bg-[#1D221F] border border-[#292E2A] text-[11px] font-mono text-[#F0F2ED] transition-colors"
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.login || "Avatar"}
                  className="w-5 h-5 rounded-full border border-[#292E2A]"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-[#1D221F] border border-[#292E2A] flex items-center justify-center text-[10px] text-[#C7F36B] font-semibold">
                  {(user.login || "U").slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="truncate max-w-[110px] hidden sm:inline">
                {user.login}
              </span>
              <ChevronDown size={12} className="text-[#6E776F]" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-lg bg-[#101211] border border-[#292E2A] shadow-xl p-3 z-50 text-xs font-mono animate-in fade-in duration-100">
                <div className="pb-3 border-b border-[#1D221F] space-y-1">
                  <div className="font-semibold text-[#F0F2ED] truncate">
                    {user.name || user.login}
                  </div>
                  <div className="text-[11px] text-[#A0A79F] truncate">
                    @{user.login}
                  </div>
                  {user.email && (
                    <div className="text-[10px] text-[#6E776F] truncate">
                      {user.email}
                    </div>
                  )}
                  <div className="pt-1">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[9px] uppercase font-semibold ${
                        isDemo
                          ? "bg-[#E9B96E]/15 text-[#E9B96E] border border-[#E9B96E]/30"
                          : "bg-[#C7F36B]/15 text-[#C7F36B] border border-[#C7F36B]/30"
                      }`}
                    >
                      {user.role || (isDemo ? "Demo Investigator" : "Developer")}
                    </span>
                  </div>
                </div>

                <div className="py-2 border-b border-[#1D221F] space-y-1">
                  {isDemo ? (
                    <Link
                      href="/login"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center justify-between px-2 py-1.5 rounded text-[#C7F36B] hover:bg-[#151816] transition-colors"
                    >
                      <span>Connect Real GitHub</span>
                      <ExternalLink size={12} />
                    </Link>
                  ) : (
                    <a
                      href={`https://github.com/${user.login}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between px-2 py-1.5 rounded text-[#A0A79F] hover:text-[#F0F2ED] hover:bg-[#151816] transition-colors"
                    >
                      <span>View GitHub Profile</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      if (isDemo) {
                        exitDemo();
                      } else {
                        logout();
                      }
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-[#F07878] hover:bg-[#F07878]/10 transition-colors"
                  >
                    <LogOut size={13} />
                    <span>{isDemo ? "Exit Demo Mode" : "Sign Out"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3 h-[32px] bg-[#C7F36B] text-[#090A0A] font-mono text-[10px] tracking-wider uppercase font-semibold rounded-[3px] hover:bg-[#D7FF86] transition-all active:scale-[0.98]"
            >
              <GithubIcon size={12} />
              <span>Sign in</span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
