import type {
  UserProfile,
  GitHubConnectionState,
  Repository,
  Branch,
  PullRequest,
  ChangedFile,
  FileDiffData,
  DiffHunk,
  AnalysisJob,
  DependencyGraphData,
  AnalysisReport,
  Evidence,
  Recommendation,
  ApiError,
} from "@/types/api";
import type { ActionRequest, ActionResult } from "@/types/actions";
import {
  adaptRepository,
  adaptRepositoriesResponse,
  adaptImpactToGraph,
  type BackendRepository,
  type BackendImpactReport,
  type BackendPreShipHealthReport,
  type BackendReleaseGateEvaluation,
} from "./api-adapters";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

class DevosApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await fetch(url, {
        credentials: "include",
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        let errorData: unknown = null;
        try {
          errorData = await response.json();
        } catch {
          // Response body was not JSON
        }

        const backendError = (errorData as { error?: { code?: string; message?: string } })?.error;
        const apiError: ApiError = {
          message:
            backendError?.message ||
            (errorData as { message?: string })?.message ||
            `API Request failed with status ${response.status} (${response.statusText})`,
          status: response.status,
          code:
            backendError?.code ||
            (errorData as { code?: string })?.code ||
            (response.status === 404 ? "NOT_FOUND" : undefined),
          details: errorData,
        };
        throw apiError;
      }

      // Empty 204 or bodyless responses
      if (response.status === 204) {
        return {} as T;
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      clearTimeout(timeout);
      if ((err as ApiError).status !== undefined) {
        throw err;
      }

      const isAbort = (err as Error).name === "AbortError";
      const networkError: ApiError = {
        message: isAbort
          ? "Request timed out after 12s. Please check backend response time."
          : `Unable to connect to DEVOS API at ${this.baseUrl}. Ensure backend service is running.`,
        status: 0,
        code: isAbort ? "TIMEOUT" : "CONNECTION_REFUSED",
        details: err,
      };
      throw networkError;
    }
  }

  // --- Auth & GitHub Domain ---
  async getCurrentUser(): Promise<UserProfile> {
    const res = await this.request<{ user: UserProfile }>("/auth/me");
    return res.user;
  }

  async logout(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  // --- Demo Mode Domain ---
  async createDemoSession(): Promise<{ sessionType: "demo"; user: UserProfile; expiresAt: string }> {
    return this.request<{ sessionType: "demo"; user: UserProfile; expiresAt: string }>(
      "/demo/session",
      { method: "POST", body: JSON.stringify({}) }
    );
  }

  async getDemoStatus(): Promise<{
    isDemo: boolean;
    sessionType: string | null;
    user: UserProfile | null;
    expiresAt?: string;
  }> {
    return this.request<{
      isDemo: boolean;
      sessionType: string | null;
      user: UserProfile | null;
      expiresAt?: string;
    }>("/demo/status");
  }

  async logoutDemo(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/demo/logout", {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async getGitHubStatus(): Promise<GitHubConnectionState> {
    return this.request<GitHubConnectionState>("/auth/github/status");
  }

  async initiateGitHubConnect(returnTo: string = "/app"): Promise<{ authUrl: string }> {
    const authUrl = `${this.baseUrl}/auth/github?returnTo=${encodeURIComponent(returnTo)}`;
    return { authUrl };
  }

  async disconnectGitHub(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/auth/github/disconnect", {
      method: "POST",
    });
  }

  // --- Repositories Domain ---
  async getRepositories(): Promise<Repository[]> {
    const raw = await this.request<unknown>("/repositories");
    return adaptRepositoriesResponse(raw);
  }

  async getRepository(repositoryId: string): Promise<Repository> {
    const raw = await this.request<BackendRepository>(
      `/repositories/${encodeURIComponent(repositoryId)}`
    );
    return adaptRepository(raw);
  }

  async createRepository(payload: {
    name?: string;
    path: string;
    defaultBranch?: string;
  }): Promise<Repository> {
    const raw = await this.request<BackendRepository>("/repositories", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return adaptRepository(raw);
  }

  async getBranches(repositoryId: string): Promise<Branch[]> {
    // If backend doesn't implement branch list, get repository to extract default branch
    try {
      return await this.request<Branch[]>(
        `/repositories/${encodeURIComponent(repositoryId)}/branches`
      );
    } catch (err) {
      if ((err as ApiError).status === 404) {
        const repo = await this.getRepository(repositoryId).catch(() => null);
        if (repo) {
          return [
            {
              name: repo.defaultBranch || "main",
              isDefault: true,
              commitSha: "HEAD",
            },
          ];
        }
      }
      throw err;
    }
  }

  // --- Pull Requests Domain ---
  async getPullRequests(repositoryId: string): Promise<PullRequest[]> {
    try {
      return await this.request<PullRequest[]>(
        `/repositories/${encodeURIComponent(repositoryId)}/pulls`
      );
    } catch (err) {
      if ((err as ApiError).status === 404) {
        return [];
      }
      throw err;
    }
  }

  async getPullRequest(
    repositoryId: string,
    pullRequestId: string
  ): Promise<PullRequest> {
    return this.request<PullRequest>(
      `/repositories/${encodeURIComponent(repositoryId)}/pulls/${encodeURIComponent(pullRequestId)}`
    );
  }

  async getChangedFiles(
    repositoryId: string,
    pullRequestId: string
  ): Promise<ChangedFile[]> {
    try {
      return await this.request<ChangedFile[]>(
        `/repositories/${encodeURIComponent(repositoryId)}/pulls/${encodeURIComponent(pullRequestId)}/files`
      );
    } catch (err) {
      if ((err as ApiError).status === 404) {
        return [];
      }
      throw err;
    }
  }

  async getFileDiff(
    repositoryId: string,
    pullRequestId: string,
    filePath: string
  ): Promise<FileDiffData> {
    const rawData = await this.request<{
      filename: string;
      status: ChangedFile["status"];
      additions: number;
      deletions: number;
      isBinary?: boolean;
      patch?: string;
    }>(
      `/repositories/${encodeURIComponent(repositoryId)}/pulls/${encodeURIComponent(pullRequestId)}/diff?path=${encodeURIComponent(filePath)}`
    );

    return {
      filename: rawData.filename,
      status: rawData.status,
      additions: rawData.additions,
      deletions: rawData.deletions,
      isBinary: Boolean(rawData.isBinary),
      rawPatch: rawData.patch,
      hunks: parseUnifiedDiffPatch(rawData.patch || ""),
    };
  }

  // --- Analysis Domain (Real Backend Lifecycle) ---
  async createAnalysis(payload: {
    repositoryId: string;
    baseSha: string;
    headSha: string;
  }): Promise<AnalysisJob> {
    return this.request<AnalysisJob>("/analyses", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async triggerAnalysis(
    repositoryId: string,
    _pullRequestId: string
  ): Promise<AnalysisJob> {
    return this.createAnalysis({
      repositoryId,
      baseSha: "HEAD~1",
      headSha: "HEAD",
    });
  }

  async getAnalysisStatus(jobId: string): Promise<{
    job: AnalysisJob;
    report: AnalysisReport | null;
  }> {
    return this.request<{
      job: AnalysisJob;
      report: AnalysisReport | null;
    }>(`/analyses/${encodeURIComponent(jobId)}`);
  }

  async completeAnalysis(analysisId: string): Promise<{
    analysis: AnalysisJob;
    status: string;
    completedAt: string;
  }> {
    return this.request<{
      analysis: AnalysisJob;
      status: string;
      completedAt: string;
    }>(`/analyses/${encodeURIComponent(analysisId)}/complete`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async getImpactReport(analysisId: string): Promise<BackendImpactReport> {
    return this.request<BackendImpactReport>(
      `/analyses/${encodeURIComponent(analysisId)}/impact`
    );
  }

  async getChangeReview(analysisId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/analyses/${encodeURIComponent(analysisId)}/review`
    );
  }

  async getPreShipHealth(analysisId: string): Promise<BackendPreShipHealthReport> {
    return this.request<BackendPreShipHealthReport>(
      `/analyses/${encodeURIComponent(analysisId)}/health`
    );
  }

  async evaluateReleaseGate(
    analysisId: string,
    policy?: Record<string, unknown>
  ): Promise<BackendReleaseGateEvaluation> {
    return this.request<BackendReleaseGateEvaluation>(
      `/analyses/${encodeURIComponent(analysisId)}/health/gate`,
      {
        method: "POST",
        body: JSON.stringify({ policy: policy || {} }),
      }
    );
  }

  // --- Engineering Graph Domain ---
  async getDependencyGraph(
    repositoryId: string,
    analysisId?: string
  ): Promise<DependencyGraphData> {
    if (!analysisId) {
      return {
        repositoryId,
        analysisId: undefined,
        symbols: [],
        edges: [],
        changedSymbols: [],
        impactedSymbols: [],
      };
    }

    try {
      const impactReport = await this.getImpactReport(analysisId);
      const analysisData = await this.getAnalysisStatus(analysisId).catch(() => null);
      const changedSymbols = analysisData?.report?.changedSymbols || [];
      return adaptImpactToGraph(repositoryId, analysisId, impactReport, changedSymbols);
    } catch {
      return {
        repositoryId,
        analysisId,
        symbols: [],
        edges: [],
        changedSymbols: [],
        impactedSymbols: [],
      };
    }
  }

  // --- AI Code Review Domain ---
  async getAnalysisReport(analysisId: string): Promise<AnalysisReport> {
    const response = await this.getAnalysisStatus(analysisId);

    if (!response.report) {
      throw {
        message: `Analysis job ${analysisId} has not completed report generation yet.`,
        status: 404,
        code: "REPORT_NOT_READY",
      } as ApiError;
    }

    return response.report;
  }

  async getEvidence(evidenceId: string): Promise<Evidence> {
    return this.request<Evidence>(`/evidence/${encodeURIComponent(evidenceId)}`);
  }

  async getRecommendations(analysisId: string): Promise<Recommendation[]> {
    return this.request<Recommendation[]>(
      `/analyses/${encodeURIComponent(analysisId)}/recommendations`
    );
  }

  // --- Secure Actions Domain ---
  async createAction(payload: {
    type: string;
    target: string;
    params?: Record<string, unknown>;
    requestedBy?: string;
  }): Promise<ActionRequest> {
    return this.request<ActionRequest>("/actions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async approveAction(
    actionId: string,
    payload: { approved: boolean; reason?: string }
  ): Promise<{ action: ActionRequest; result: ActionResult | null }> {
    return this.request<{ action: ActionRequest; result: ActionResult | null }>(
      `/actions/${encodeURIComponent(actionId)}/approve`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  }

  async getActions(repositoryId?: string): Promise<ActionRequest[]> {
    try {
      const query = repositoryId ? `?repositoryId=${encodeURIComponent(repositoryId)}` : "";
      return await this.request<ActionRequest[]>(`/actions${query}`);
    } catch (err) {
      if ((err as ApiError).status === 404) {
        return [];
      }
      throw err;
    }
  }
}

/**
 * Parses raw unified diff patch strings (e.g. from git diff or GitHub API)
 * into structured hunks with line numbers and typed lines.
 */
export function parseUnifiedDiffPatch(patch: string): DiffHunk[] {
  if (!patch || patch.trim() === "") return [];

  const hunks: DiffHunk[] = [];
  const lines = patch.split("\n");
  let currentHunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const match = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
        currentHunk = {
          header: line,
          oldStart: oldLine,
          oldLines: 0,
          newStart: newLine,
          newLines: 0,
          lines: [],
        };
        hunks.push(currentHunk);
      }
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith("+")) {
      currentHunk.lines.push({
        type: "addition",
        newLineNumber: newLine++,
        content: line.slice(1),
      });
    } else if (line.startsWith("-")) {
      currentHunk.lines.push({
        type: "deletion",
        oldLineNumber: oldLine++,
        content: line.slice(1),
      });
    } else {
      currentHunk.lines.push({
        type: "context",
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
        content: line.startsWith(" ") ? line.slice(1) : line,
      });
    }
  }

  return hunks;
}

export const api = new DevosApiClient(API_BASE_URL);
