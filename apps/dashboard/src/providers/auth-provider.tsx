"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { UserProfile, ApiError } from "@/types/api";

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isDemo: boolean;
  isLoading: boolean;
  isBackendOffline: boolean;
  login: (returnTo?: string) => void;
  logout: () => Promise<void>;
  enterDemo: () => Promise<void>;
  exitDemo: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 1. Real Authenticated User Query
  const {
    data: realUser = null,
    isLoading: isLoadingReal,
    isError: isErrorReal,
    error: errorReal,
    refetch: refetchReal,
  } = useQuery<UserProfile | null, ApiError>({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        return await api.getCurrentUser();
      } catch (err: unknown) {
        const apiErr = err as ApiError;
        // 401 is normal unauthenticated state
        if (apiErr.status === 401) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 60_000,
    retry: (failureCount, err) => {
      if (err.status === 401) return false;
      return failureCount < 1;
    },
  });

  // 2. Demo Session Status Query
  const {
    data: demoStatus = null,
    isLoading: isLoadingDemo,
    refetch: refetchDemo,
  } = useQuery<{ isDemo: boolean; user: UserProfile | null }>({
    queryKey: ["demo", "status"],
    queryFn: async () => {
      try {
        return await api.getDemoStatus();
      } catch {
        return { isDemo: false, user: null };
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const isLoading = isLoadingReal || isLoadingDemo;

  // Real user takes absolute precedence over demo
  const isRealAuth = Boolean(realUser && realUser.id);
  const isDemoActive = !isRealAuth && Boolean(demoStatus?.isDemo && demoStatus?.user);

  const user = isRealAuth ? realUser : isDemoActive ? demoStatus!.user : null;
  const isAuthenticated = Boolean(user && user.id);
  const isDemo = isDemoActive;

  const isBackendOffline =
    isErrorReal && (errorReal?.status === 0 || errorReal?.code === "CONNECTION_REFUSED");

  const login = useCallback(
    (returnTo?: string) => {
      const safeReturn = returnTo && returnTo.startsWith("/") ? returnTo : "/app";
      const targetUrl = `${API_BASE_URL}/auth/github?returnTo=${encodeURIComponent(safeReturn)}`;
      window.location.href = targetUrl;
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network errors during logout
    } finally {
      queryClient.setQueryData(["auth", "me"], null);
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      router.push("/login");
    }
  }, [queryClient, router]);

  const enterDemo = useCallback(async () => {
    try {
      const res = await api.createDemoSession();
      queryClient.setQueryData(["demo", "status"], {
        isDemo: true,
        sessionType: "demo",
        user: res.user,
      });
      await queryClient.invalidateQueries();
      router.push("/app");
    } catch (err) {
      console.warn("Backend demo session creation failed, using client demo session fallback:", err);
      // Fallback: enter demo in frontend with fixture
      queryClient.setQueryData(["demo", "status"], {
        isDemo: true,
        sessionType: "demo",
        user: {
          id: "devos-demo-user",
          login: "demo-investigator",
          name: "DEVOS Demo Investigator",
          email: "demo@devos.internal",
          avatarUrl: "/brand/devos-mark.png",
          role: "Demo Investigator" as const,
          isDemo: true,
        },
      });
      await queryClient.invalidateQueries();
      router.push("/app");
    }
  }, [queryClient, router]);

  const exitDemo = useCallback(async () => {
    try {
      await api.logoutDemo();
    } catch {
      // Ignore network errors
    } finally {
      queryClient.setQueryData(["demo", "status"], {
        isDemo: false,
        sessionType: null,
        user: null,
      });
      await queryClient.invalidateQueries();
      router.push("/");
    }
  }, [queryClient, router]);

  const refresh = useCallback(async () => {
    await Promise.all([refetchReal(), refetchDemo()]);
  }, [refetchReal, refetchDemo]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isDemo,
        isLoading,
        isBackendOffline,
        login,
        logout,
        enterDemo,
        exitDemo,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

