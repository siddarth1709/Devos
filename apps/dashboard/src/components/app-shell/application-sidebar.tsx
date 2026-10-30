"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderGit2,
  Network,
  FileSearch,
  ShieldAlert,
  PlayCircle,
  ExternalLink,
} from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import { useGitHubStatus } from "@/hooks/use-devos-api";
import { useAuth } from "@/hooks/use-auth";
import { DevosLogo } from "@/components/brand/devos-logo";

interface ApplicationSidebarProps {
  onOpenConnectModal?: () => void;
}

export function ApplicationSidebar({ onOpenConnectModal }: ApplicationSidebarProps) {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const { data: githubStatus, isError } = useGitHubStatus();

  const primaryNav = [
    { label: "Overview", href: "/app", icon: LayoutDashboard },
    { label: "Repositories", href: "/app/repositories", icon: FolderGit2 },
  ];

  const engineeringNav = [
    { label: "Dependency Graph", href: "/app/graph", icon: Network, phase: "Phase 2" },
    { label: "Code Review", href: "/app/review", icon: FileSearch, phase: "Phase 2" },
    { label: "Pre-ship Guard", href: "/app/guard", icon: ShieldAlert, phase: "Phase 2" },
    { label: "Actions", href: "/app/actions", icon: PlayCircle, phase: "Phase 2" },
  ];

  return (
    <aside
      className="hidden md:flex flex-col w-[248px] h-screen sticky top-0 shrink-0 bg-[#101211] border-r border-[#292E2A] z-40 select-none"
      aria-label="Application Sidebar"
    >
      {/* Top Logo */}
      <div className="h-[64px] px-5 flex items-center justify-between border-b border-[#1D221F]">
        <Link
          href="/"
          className="group flex items-center text-[#F0F2ED] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C7F36B]"
          aria-label="Return to DEVOS landing page"
        >
          <DevosLogo size="sm" />
        </Link>
        <span className="px-1.5 py-0.5 rounded-[2px] bg-[#151816] border border-[#292E2A] font-mono text-[8px] tracking-[0.08em] text-[#A0A79F] uppercase">
          CONSOLE
        </span>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-6 space-y-7">
        {/* PRIMARY Group */}
        <div>
          <span className="px-3 font-mono text-[9px] tracking-[0.14em] uppercase text-[#6E776F] font-semibold">
            PRIMARY
          </span>
          <nav className="mt-2 space-y-1" aria-label="Primary Navigation">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/app"
                  ? pathname === "/app"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center gap-3 px-3 py-2 rounded-[4px] text-[13px] font-medium transition-all duration-[180ms] ${
                    isActive
                      ? "bg-[#181D19] text-[#F0F2ED] font-semibold"
                      : "text-[#A0A79F] hover:text-[#F0F2ED] hover:bg-[#151816]"
                  }`}
                >
                  {/* Active Indicator Strip */}
                  <span
                    className={`absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-[#C7F36B] transition-opacity duration-200 ${
                      isActive ? "opacity-100" : "opacity-0"
                    }`}
                    aria-hidden="true"
                  />
                  <Icon
                    size={16}
                    className={`shrink-0 transition-colors ${
                      isActive ? "text-[#C7F36B]" : "text-[#6E776F] group-hover:text-[#A0A79F]"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* ENGINEERING Group */}
        <div>
          <span className="px-3 font-mono text-[9px] tracking-[0.14em] uppercase text-[#6E776F] font-semibold">
            ENGINEERING
          </span>
          <nav className="mt-2 space-y-1" aria-label="Engineering Navigation">
            {engineeringNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center justify-between px-3 py-2 rounded-[4px] text-[13px] font-medium transition-all duration-[180ms] ${
                    isActive
                      ? "bg-[#181D19] text-[#F0F2ED] font-semibold"
                      : "text-[#A0A79F] hover:text-[#F0F2ED] hover:bg-[#151816]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      size={16}
                      className={`shrink-0 transition-colors ${
                        isActive ? "text-[#C7F36B]" : "text-[#6E776F] group-hover:text-[#A0A79F]"
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  <span className="font-mono text-[8px] tracking-[0.06em] text-[#6E776F] border border-[#222724] px-1.5 py-0.5 rounded-[2px] shrink-0">
                    {item.phase}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User / Account Status Card at Bottom */}
      <div className="p-3 border-t border-[#1D221F]">
        <div className="p-3 bg-[#151816] border border-[#222724] rounded-[4px] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[8px] tracking-[0.1em] text-[#6E776F] uppercase">
              GITHUB INTEGRATION
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                isAuthenticated || githubStatus?.status === "connected"
                  ? "bg-[#79D69A] shadow-[0_0_8px_rgba(121,214,154,0.5)]"
                  : isError
                  ? "bg-[#E9B96E]"
                  : "bg-[#6E776F]"
              }`}
              title={
                isAuthenticated || githubStatus?.status === "connected"
                  ? "Connected to GitHub"
                  : "Not Connected"
              }
            />
          </div>

          <div className="flex items-center gap-2.5">
            {isAuthenticated && user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.login || "Avatar"}
                className="w-7 h-7 rounded-full border border-[#292E2A] shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#101211] border border-[#292E2A] flex items-center justify-center text-[#A0A79F] shrink-0">
                <GithubIcon size={14} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="block font-display font-medium text-[12px] text-[#F0F2ED] truncate">
                {isAuthenticated && user
                  ? user.name || user.login
                  : githubStatus?.user?.login || "Local Workspace"}
              </span>
              <span className="block font-mono text-[9px] text-[#A0A79F] truncate">
                {isAuthenticated && user
                  ? `@${user.login}`
                  : githubStatus?.status === "connected"
                  ? "Authorized via GitHub"
                  : "Backend Ready"}
              </span>
            </div>
          </div>

          {!isAuthenticated && githubStatus?.status !== "connected" && (
            <Link
              href="/login"
              className="mt-1 w-full h-[28px] bg-transparent border border-[#3A4338] text-[#C7F36B] hover:bg-[#C7F36B] hover:text-[#090A0A] font-mono text-[9px] font-semibold tracking-wider uppercase rounded-[3px] transition-all flex items-center justify-center gap-1.5"
            >
              <span>Sign In</span>
              <ExternalLink size={10} />
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
