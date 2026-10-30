"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X,
  LayoutDashboard,
  FolderGit2,
  Network,
  FileSearch,
  ShieldAlert,
  PlayCircle,
} from "lucide-react";
import { GithubIcon } from "@/components/icons/github-icon";
import { useGitHubStatus } from "@/hooks/use-devos-api";
import { useAuth } from "@/hooks/use-auth";
import { LogOut } from "lucide-react";
import { DevosLogo } from "@/components/brand/devos-logo";

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenConnectModal?: () => void;
}

export function MobileNavDrawer({
  isOpen,
  onClose,
  onOpenConnectModal,
}: MobileNavDrawerProps) {
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, logout } = useAuth();
  const { data: githubStatus } = useGitHubStatus();

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
    <div
      className="fixed inset-0 z-50 md:hidden bg-black/70 backdrop-blur-sm animate-entrance"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation"
    >
      <div
        ref={drawerRef}
        onClick={(e) => e.stopPropagation()}
        className="w-[280px] h-full bg-[#101211] border-r border-[#292E2A] p-5 flex flex-col justify-between shadow-2xl animate-entrance"
      >
        <div>
          {/* Top Logo & Close Button */}
          <div className="flex items-center justify-between pb-5 border-b border-[#1D221F]">
            <Link
              href="/"
              onClick={onClose}
              className="flex items-center text-[#F0F2ED]"
            >
              <DevosLogo size="sm" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-[#A0A79F] hover:text-[#F0F2ED]"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Groups */}
          <div className="mt-6 space-y-6">
            <div>
              <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-[#6E776F] font-semibold">
                PRIMARY
              </span>
              <nav className="mt-2 space-y-1">
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
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2 rounded-[4px] text-[13px] font-medium transition-colors ${
                        isActive
                          ? "bg-[#181D19] text-[#C7F36B] font-semibold"
                          : "text-[#A0A79F] hover:text-[#F0F2ED] hover:bg-[#151816]"
                      }`}
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div>
              <span className="font-mono text-[9px] tracking-[0.14em] uppercase text-[#6E776F] font-semibold">
                ENGINEERING
              </span>
              <nav className="mt-2 space-y-1">
                {engineeringNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center justify-between px-3 py-2 rounded-[4px] text-[13px] font-medium transition-colors ${
                        isActive
                          ? "bg-[#181D19] text-[#C7F36B] font-semibold"
                          : "text-[#A0A79F] hover:text-[#F0F2ED] hover:bg-[#151816]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </div>
                      <span className="font-mono text-[8px] text-[#6E776F] border border-[#222724] px-1.5 py-0.5 rounded-[2px]">
                        {item.phase}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* Bottom User / Account Status */}
        <div className="pt-4 border-t border-[#1D221F]">
          <div className="p-3 bg-[#151816] rounded-[4px] border border-[#222724] space-y-2.5">
            <div className="flex items-center gap-2.5">
              {isAuthenticated && user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt={user.login || "Avatar"}
                  className="w-6 h-6 rounded-full border border-[#292E2A] shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#101211] border border-[#292E2A] flex items-center justify-center text-[#A0A79F] shrink-0">
                  <GithubIcon size={12} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="block font-mono text-[11px] text-[#F0F2ED] truncate">
                  {isAuthenticated && user ? user.name || user.login : githubStatus?.user?.login || "Not connected"}
                </span>
                {isAuthenticated && user && (
                  <span className="block font-mono text-[9px] text-[#A0A79F] truncate">
                    @{user.login}
                  </span>
                )}
              </div>
            </div>

            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  logout();
                }}
                className="w-full flex items-center justify-center gap-1.5 h-[30px] rounded bg-[#F07878]/10 hover:bg-[#F07878]/20 text-[#F07878] font-mono text-[10px] tracking-wider uppercase transition-colors"
              >
                <LogOut size={12} />
                <span>Sign Out</span>
              </button>
            ) : (
              <Link
                href="/login"
                onClick={onClose}
                className="w-full flex items-center justify-center gap-1.5 h-[32px] bg-[#C7F36B] text-[#090A0A] font-mono text-[10px] font-semibold tracking-wider uppercase rounded-[3px] transition-all"
              >
                <GithubIcon size={12} />
                <span>Sign In With GitHub</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
