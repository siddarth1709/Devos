import type {
  GitHubConnectionState,
  Repository,
  Branch,
  PullRequest,
  ChangedFile,
  FileDiffData,
  DiffHunk,
  AnalysisJob,
  ApiError,
} from "@/types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

class DevosApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await fetch(url, {
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

        const apiError: ApiError = {
          message:
            (errorData as { message?: string })?.message ||
            `API Request failed with status ${response.status} (${response.statusText})`,
          status: response.status,
          code: (errorData as { code?: string })?.code,
          details: errorData,
        };
        throw apiError;
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      clearTimeout(timeout);
      if ((err as ApiError).status) {
        throw err;
      }

      const isAbort = (err as Error).name === "AbortError";
      const networkError: ApiError = {
        message: isAbort
          ? "Request timed out after 12s. Please check backend response time."
          : `Unable to connect to DEVOS API at ${this.baseUrl}. Ensure Builder 2's backend service is running.`,
        status: 0,
        code: isAbort ? "TIMEOUT" : "CONNECTION_REFUSED",
        details: err,
      };
      throw networkError;
    }
  }

  // --- Auth & GitHub Domain ---
  async getGitHubStatus(): Promise<GitHubConnectionState> {
    return this.request<GitHubConnectionState>("/auth/github/status");
  }

  async initiateGitHubConnect(): Promise<{ authUrl: string }> {
    return this.request<{ authUrl: string }>("/auth/github/connect", {
      method: "POST",
    });
  }

  async disconnectGitHub(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>("/auth/github/disconnect", {
      method: "POST",
    });
  }

  // --- Repositories Domain ---
  async getRepositories(): Promise<Repository[]> {
    return this.request<Repository[]>("/repositories");
  }

  async getRepository(repositoryId: string): Promise<Repository> {
    return this.request<Repository>(`/repositories/${encodeURIComponent(repositoryId)}`);
  }

  async getBranches(repositoryId: string): Promise<Branch[]> {
    return this.request<Branch[]>(`/repositories/${encodeURIComponent(repositoryId)}/branches`);
  }

  // --- Pull Requests Domain ---
  async getPullRequests(repositoryId: string): Promise<PullRequest[]> {
    return this.request<PullRequest[]>(`/repositories/${encodeURIComponent(repositoryId)}/pulls`);
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
    return this.request<ChangedFile[]>(
      `/repositories/${encodeURIComponent(repositoryId)}/pulls/${encodeURIComponent(pullRequestId)}/files`
    );
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

  // --- Analysis Domain ---
  async triggerAnalysis(
    repositoryId: string,
    pullRequestId: string
  ): Promise<AnalysisJob> {
    return this.request<AnalysisJob>(
      `/repositories/${encodeURIComponent(repositoryId)}/pulls/${encodeURIComponent(pullRequestId)}/analysis`,
      { method: "POST" }
    );
  }

  async getAnalysisStatus(jobId: string): Promise<AnalysisJob> {
    return this.request<AnalysisJob>(`/analysis/${encodeURIComponent(jobId)}`);
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
      // Context line (or leading space)
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
