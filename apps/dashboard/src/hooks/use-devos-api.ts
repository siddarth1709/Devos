"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  GitHubConnectionState,
  Repository,
  Branch,
  PullRequest,
  ChangedFile,
  FileDiffData,
  AnalysisJob,
  ApiError,
} from "@/types/api";

export const queryKeys = {
  githubStatus: ["auth", "github", "status"] as const,
  repositories: (query?: string) => ["repositories", { query }] as const,
  repository: (id: string) => ["repositories", id] as const,
  branches: (repoId: string) => ["repositories", repoId, "branches"] as const,
  pullRequests: (repoId: string) => ["repositories", repoId, "pulls"] as const,
  pullRequest: (repoId: string, prId: string) =>
    ["repositories", repoId, "pulls", prId] as const,
  changedFiles: (repoId: string, prId: string) =>
    ["repositories", repoId, "pulls", prId, "files"] as const,
  diff: (repoId: string, prId: string, path: string) =>
    ["repositories", repoId, "pulls", prId, "diff", path] as const,
  analysis: (jobId: string) => ["analysis", jobId] as const,
};

export function useGitHubStatus() {
  return useQuery<GitHubConnectionState, ApiError>({
    queryKey: queryKeys.githubStatus,
    queryFn: () => api.getGitHubStatus(),
    retry: false, // Don't spam if backend is not yet started
    staleTime: 60_000,
  });
}

export function useRepositories(searchQuery?: string) {
  return useQuery<Repository[], ApiError>({
    queryKey: queryKeys.repositories(searchQuery),
    queryFn: async () => {
      const repos = await api.getRepositories();
      if (!searchQuery || searchQuery.trim() === "") return repos;
      const q = searchQuery.toLowerCase();
      return repos.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.owner.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q)
      );
    },
    retry: false,
    staleTime: 30_000,
  });
}

export function useRepository(repoId: string) {
  return useQuery<Repository, ApiError>({
    queryKey: queryKeys.repository(repoId),
    queryFn: () => api.getRepository(repoId),
    enabled: Boolean(repoId),
    retry: false,
  });
}

export function useBranches(repoId: string) {
  return useQuery<Branch[], ApiError>({
    queryKey: queryKeys.branches(repoId),
    queryFn: () => api.getBranches(repoId),
    enabled: Boolean(repoId),
    retry: false,
  });
}

export function usePullRequests(repoId: string) {
  return useQuery<PullRequest[], ApiError>({
    queryKey: queryKeys.pullRequests(repoId),
    queryFn: () => api.getPullRequests(repoId),
    enabled: Boolean(repoId),
    retry: false,
  });
}

export function usePullRequest(repoId: string, prId: string) {
  return useQuery<PullRequest, ApiError>({
    queryKey: queryKeys.pullRequest(repoId, prId),
    queryFn: () => api.getPullRequest(repoId, prId),
    enabled: Boolean(repoId) && Boolean(prId),
    retry: false,
  });
}

export function useChangedFiles(repoId: string, prId: string) {
  return useQuery<ChangedFile[], ApiError>({
    queryKey: queryKeys.changedFiles(repoId, prId),
    queryFn: () => api.getChangedFiles(repoId, prId),
    enabled: Boolean(repoId) && Boolean(prId),
    retry: false,
  });
}

export function useFileDiff(repoId: string, prId: string, filePath: string) {
  return useQuery<FileDiffData, ApiError>({
    queryKey: queryKeys.diff(repoId, prId, filePath),
    queryFn: () => api.getFileDiff(repoId, prId, filePath),
    enabled: Boolean(repoId) && Boolean(prId) && Boolean(filePath),
    retry: false,
  });
}

export function useTriggerAnalysis(repoId: string, prId: string) {
  const queryClient = useQueryClient();

  return useMutation<AnalysisJob, ApiError>({
    mutationFn: () => api.triggerAnalysis(repoId, prId),
    onSuccess: (job) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.pullRequest(repoId, prId),
      });
      queryClient.setQueryData(queryKeys.analysis(job.jobId), job);
    },
  });
}

