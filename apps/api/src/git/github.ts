export interface GitHubRepoSummary {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  htmlUrl: string;
  description: string | null;
  defaultBranch: string;
  updatedAt: string;
}

export interface GitHubBranchSummary {
  name: string;
  sha: string;
  isDefault: boolean;
  protected: boolean;
}

export interface GitHubCommitSummary {
  sha: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
}

export interface GitHubPullRequestSummary {
  number: number;
  title: string;
  state: string;
  draft: boolean;
  user: string;
  htmlUrl: string;
  baseRef: string;
  baseSha: string;
  headRef: string;
  headSha: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubFileChange {
  filename: string;
  status: "added" | "modified" | "removed" | "renamed";
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previousFilename?: string;
}

export interface GitHubCompareResult {
  baseSha: string;
  headSha: string;
  status: string;
  aheadBy: number;
  behindBy: number;
  totalCommits: number;
  commits: GitHubCommitSummary[];
  files: GitHubFileChange[];
}

export class GitHubService {
  constructor(
    private readonly token?: string,
    private readonly baseUrl: string = "https://api.github.com"
  ) {}

  private async fetchFromApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "DEVOS-Engine/1.0",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      const error: any = new Error(`GitHub API request failed (${res.status}): ${errorBody}`);
      error.status = res.status;
      throw error;
    }

    return res.json() as Promise<T>;
  }

  async listUserRepositories(page = 1, perPage = 30): Promise<GitHubRepoSummary[]> {
    const endpoint = this.token
      ? `/user/repos?sort=updated&page=${page}&per_page=${perPage}`
      : `/repositories?since=${(page - 1) * perPage}`;
    const data = await this.fetchFromApi<any[]>(endpoint);
    return data.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      owner: r.owner?.login || "",
      private: Boolean(r.private),
      htmlUrl: r.html_url,
      description: r.description || null,
      defaultBranch: r.default_branch || "main",
      updatedAt: r.updated_at || new Date().toISOString(),
    }));
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepoSummary> {
    const data = await this.fetchFromApi<any>(`/repos/${owner}/${repo}`);
    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      owner: data.owner?.login || owner,
      private: Boolean(data.private),
      htmlUrl: data.html_url,
      description: data.description || null,
      defaultBranch: data.default_branch || "main",
      updatedAt: data.updated_at || new Date().toISOString(),
    };
  }

  async listBranches(owner: string, repo: string): Promise<GitHubBranchSummary[]> {
    const [branches, repoInfo] = await Promise.all([
      this.fetchFromApi<any[]>(`/repos/${owner}/${repo}/branches`),
      this.getRepository(owner, repo),
    ]);
    return branches.map((b) => ({
      name: b.name,
      sha: b.commit?.sha || "",
      isDefault: b.name === repoInfo.defaultBranch,
      protected: Boolean(b.protected),
    }));
  }

  async getBranch(owner: string, repo: string, branch: string): Promise<GitHubBranchSummary> {
    const [b, repoInfo] = await Promise.all([
      this.fetchFromApi<any>(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`),
      this.getRepository(owner, repo),
    ]);
    return {
      name: b.name,
      sha: b.commit?.sha || "",
      isDefault: b.name === repoInfo.defaultBranch,
      protected: Boolean(b.protected),
    };
  }

  async listCommits(owner: string, repo: string, page = 1, perPage = 30): Promise<GitHubCommitSummary[]> {
    const data = await this.fetchFromApi<any[]>(
      `/repos/${owner}/${repo}/commits?page=${page}&per_page=${perPage}`
    );
    return data.map((c) => ({
      sha: c.sha,
      message: c.commit?.message || "",
      author: c.commit?.author?.name || c.author?.login || "Unknown",
      date: c.commit?.author?.date || new Date().toISOString(),
      parents: (c.parents || []).map((p: any) => p.sha),
    }));
  }

  async compare(owner: string, repo: string, base: string, head: string): Promise<GitHubCompareResult> {
    const data = await this.fetchFromApi<any>(
      `/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`
    );
    return {
      baseSha: data.base_commit?.sha || base,
      headSha: data.commits?.[data.commits.length - 1]?.sha || head,
      status: data.status,
      aheadBy: data.ahead_by ?? 0,
      behindBy: data.behind_by ?? 0,
      totalCommits: data.total_commits ?? (data.commits?.length || 0),
      commits: (data.commits || []).map((c: any) => ({
        sha: c.sha,
        message: c.commit?.message || "",
        author: c.commit?.author?.name || "Unknown",
        date: c.commit?.author?.date || new Date().toISOString(),
        parents: (c.parents || []).map((p: any) => p.sha),
      })),
      files: (data.files || []).map((f: any) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch,
        previousFilename: f.previous_filename,
      })),
    };
  }

  async listPullRequests(owner: string, repo: string, state: "open" | "closed" | "all" = "open"): Promise<GitHubPullRequestSummary[]> {
    const data = await this.fetchFromApi<any[]>(
      `/repos/${owner}/${repo}/pulls?state=${state}`
    );
    return data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      draft: Boolean(pr.draft),
      user: pr.user?.login || "unknown",
      htmlUrl: pr.html_url,
      baseRef: pr.base?.ref || "",
      baseSha: pr.base?.sha || "",
      headRef: pr.head?.ref || "",
      headSha: pr.head?.sha || "",
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
    }));
  }

  async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<GitHubPullRequestSummary> {
    const pr = await this.fetchFromApi<any>(
      `/repos/${owner}/${repo}/pulls/${pullNumber}`
    );
    return {
      number: pr.number,
      title: pr.title,
      state: pr.state,
      draft: Boolean(pr.draft),
      user: pr.user?.login || "unknown",
      htmlUrl: pr.html_url,
      baseRef: pr.base?.ref || "",
      baseSha: pr.base?.sha || "",
      headRef: pr.head?.ref || "",
      headSha: pr.head?.sha || "",
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
    };
  }

  async getPullRequestFiles(owner: string, repo: string, pullNumber: number): Promise<GitHubFileChange[]> {
    const files = await this.fetchFromApi<any[]>(
      `/repos/${owner}/${repo}/pulls/${pullNumber}/files`
    );
    return files.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch,
      previousFilename: f.previous_filename,
    }));
  }
}

