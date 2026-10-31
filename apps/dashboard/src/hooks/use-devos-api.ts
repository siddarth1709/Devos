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
  DependencyGraphData,
  AnalysisReport,
  Evidence,
  Recommendation,
  ApiError,
} from "@/types/api";
import type { ActionRequest, ActionResult } from "@/types/actions";
import type {
  BackendImpactReport,
  BackendPreShipHealthReport,
  BackendReleaseGateEvaluation,
} from "@/lib/api-adapters";

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
  impact: (analysisId: string) => ["analysis", analysisId, "impact"] as const,
  review: (analysisId: string) => ["analysis", analysisId, "review"] as const,
  preShipHealth: (analysisId: string) => ["analysis", analysisId, "health"] as const,
  releaseGate: (analysisId: string) => ["analysis", analysisId, "gate"] as const,
  dependencyGraph: (repoId: string, analysisId?: string) =>
    ["repositories", repoId, "graph", analysisId || "latest"] as const,
  analysisReport: (analysisId: string) => ["analysis", analysisId, "report"] as const,
  evidence: (evidenceId: string) => ["evidence", evidenceId] as const,
  recommendations: (analysisId: string) =>
    ["analysis", analysisId, "recommendations"] as const,
  actions: (repoId?: string) => ["actions", repoId || "all"] as const,
};

export function useGitHubStatus() {
  return useQuery<GitHubConnectionState, ApiError>({
    queryKey: queryKeys.githubStatus,
    queryFn: () => api.getGitHubStatus(),
    retry: false,
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
          (r.owner && r.owner.toLowerCase().includes(q)) ||
          (r.path && r.path.toLowerCase().includes(q))
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

export function useCreateRepository() {
  const queryClient = useQueryClient();

  return useMutation<
    Repository,
    ApiError,
    { name?: string; path: string; defaultBranch?: string }
  >({
    mutationFn: (payload) => api.createRepository(payload),
    onSuccess: (newRepo) => {
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      queryClient.setQueryData(queryKeys.repository(newRepo.id), newRepo);
    },
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

export function useCreateAnalysis() {
  const queryClient = useQueryClient();

  return useMutation<
    AnalysisJob,
    ApiError,
    { repositoryId: string; baseSha: string; headSha: string }
  >({
    mutationFn: (payload) => api.createAnalysis(payload),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ["analysis"] });
      queryClient.setQueryData(queryKeys.analysis(job.id || (job as { id?: string; jobId?: string }).jobId || ""), job);
    },
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
      queryClient.setQueryData(queryKeys.analysis(job.id || (job as { id?: string; jobId?: string }).jobId || ""), job);
    },
  });
}

export function useAnalysisStatus(jobId?: string) {
  return useQuery<{ job: AnalysisJob; report: AnalysisReport | null }, ApiError>({
    queryKey: queryKeys.analysis(jobId || ""),
    queryFn: () => api.getAnalysisStatus(jobId!),
    enabled: Boolean(jobId),
    retry: false,
    staleTime: 10_000,
  });
}

export function useImpactReport(analysisId?: string) {
  return useQuery<BackendImpactReport, ApiError>({
    queryKey: queryKeys.impact(analysisId || ""),
    queryFn: () => api.getImpactReport(analysisId!),
    enabled: Boolean(analysisId),
    retry: false,
    staleTime: 30_000,
  });
}

export function useChangeReview(analysisId?: string) {
  return useQuery<Record<string, unknown>, ApiError>({
    queryKey: queryKeys.review(analysisId || ""),
    queryFn: () => api.getChangeReview(analysisId!),
    enabled: Boolean(analysisId),
    retry: false,
    staleTime: 30_000,
  });
}

export function usePreShipHealth(analysisId?: string) {
  return useQuery<BackendPreShipHealthReport, ApiError>({
    queryKey: queryKeys.preShipHealth(analysisId || ""),
    queryFn: () => api.getPreShipHealth(analysisId!),
    enabled: Boolean(analysisId),
    retry: false,
    staleTime: 30_000,
  });
}

export function useReleaseGateStatus(analysisId?: string) {
  return useQuery<BackendReleaseGateEvaluation, ApiError>({
    queryKey: queryKeys.releaseGate(analysisId || ""),
    queryFn: () => api.evaluateReleaseGate(analysisId!),
    enabled: Boolean(analysisId),
    retry: false,
    staleTime: 30_000,
  });
}

export function useEvaluateReleaseGate(analysisId?: string) {
  const queryClient = useQueryClient();

  return useMutation<
    BackendReleaseGateEvaluation,
    ApiError,
    { policy?: Record<string, unknown> } | void
  >({
    mutationFn: (vars) => api.evaluateReleaseGate(analysisId!, vars?.policy),
    onSuccess: (evaluation) => {
      queryClient.setQueryData(queryKeys.releaseGate(analysisId!), evaluation);
      queryClient.invalidateQueries({ queryKey: queryKeys.preShipHealth(analysisId!) });
    },
  });
}

export function useDependencyGraph(repoId: string, analysisId?: string) {
  return useQuery<DependencyGraphData, ApiError>({
    queryKey: queryKeys.dependencyGraph(repoId, analysisId),
    queryFn: () => api.getDependencyGraph(repoId, analysisId),
    enabled: Boolean(repoId),
    retry: false,
    staleTime: 30_000,
  });
}

export function useAnalysisReport(analysisId: string) {
  return useQuery<AnalysisReport, ApiError>({
    queryKey: queryKeys.analysisReport(analysisId),
    queryFn: () => api.getAnalysisReport(analysisId),
    enabled: Boolean(analysisId),
    retry: false,
    staleTime: 60_000,
  });
}

export function useEvidence(evidenceId: string) {
  return useQuery<Evidence, ApiError>({
    queryKey: queryKeys.evidence(evidenceId),
    queryFn: () => api.getEvidence(evidenceId),
    enabled: Boolean(evidenceId),
    retry: false,
    staleTime: 120_000,
  });
}

export function useRecommendations(analysisId: string) {
  return useQuery<Recommendation[], ApiError>({
    queryKey: queryKeys.recommendations(analysisId),
    queryFn: () => api.getRecommendations(analysisId),
    enabled: Boolean(analysisId),
    retry: false,
    staleTime: 60_000,
  });
}

export function useActions(repoId?: string) {
  return useQuery<ActionRequest[], ApiError>({
    queryKey: queryKeys.actions(repoId),
    queryFn: () => api.getActions(repoId),
    retry: false,
    staleTime: 10_000,
  });
}

export function useCreateAction() {
  const queryClient = useQueryClient();

  return useMutation<
    ActionRequest,
    ApiError,
    { type: string; target: string; params?: Record<string, unknown>; requestedBy?: string }
  >({
    mutationFn: (payload) => api.createAction(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
    },
  });
}

export function useApproveAction() {
  const queryClient = useQueryClient();

  return useMutation<
    { action: ActionRequest; result: ActionResult | null },
    ApiError,
    { actionId: string; approved: boolean; reason?: string }
  >({
    mutationFn: ({ actionId, approved, reason }) =>
      api.approveAction(actionId, { approved, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
    },
  });
}
