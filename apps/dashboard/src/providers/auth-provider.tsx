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
  isLoading: boolean;
  isBackendOffline: boolean;
  login: (returnTo?: string) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: user = null,
    isLoading,
    isError,
    error,
    refetch,
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
      // Never retry on 401 (unauthenticated)
      if (err.status === 401) return false;
      return failureCount < 1;
    },
  });

  const isAuthenticated = Boolean(user && user.id);
  const isBackendOffline = isError && (error?.status === 0 || error?.code === "CONNECTION_REFUSED");

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

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        isBackendOffline,
        login,
        logout,
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

