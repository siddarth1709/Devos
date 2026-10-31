import path from "node:path";
import {
  resolveRef as localResolveRef,
  getRepoInfo as localGetRepoInfo,
  listBranches as localListBranches,
  getCommit as localGetCommit,
  getHistory as localGetHistory,
  getFileAtCommit as localGetFileAtCommit,
  getDiff as localGetDiff,
  ChangeType,
} from "./ops.js";

export interface RepoIdentity {
  id: string;
  name: string;
  defaultBranch: string;
  isRemote: boolean;
  remoteOwner?: string;
  remoteRepo?: string;
  localPath?: string;
}

export interface RepoBranch {
  name: string;
  commitSha: string;
  isDefault: boolean;
}

export interface RepoCommit {
  sha: string;
  author: string;
  date: string;
  parents: string[];
  message: string;
}

export interface RepoChangedFile {
  path: string;
  oldPath: string | null;
  changeType: ChangeType;
  binary: boolean;
  additions?: number;
  deletions?: number;
}

export interface RepoCompareResult {
  baseSha: string;
  headSha: string;
  files: RepoChangedFile[];
  diff: string;
}

export interface IRepositoryProvider {
  getIdentity(): Promise<RepoIdentity>;
  listBranches(): Promise<RepoBranch[]>;
  resolveRef(ref: string): Promise<string>;
  getCommit(ref: string): Promise<RepoCommit>;
  getHistory(limit?: number, filePath?: string): Promise<RepoCommit[]>;
  getChangedFiles(baseSha: string, headSha: string): Promise<RepoChangedFile[]>;
  getFileContent(ref: string, filePath: string): Promise<string>;
  compare(baseSha: string, headSha: string): Promise<RepoCompareResult>;
}

export class LocalGitProvider implements IRepositoryProvider {
  constructor(private readonly repoPath: string, private readonly repoId?: string) {}

  async getIdentity(): Promise<RepoIdentity> {
    const info = await localGetRepoInfo(this.repoPath);
    return {
      id: this.repoId || path.basename(this.repoPath),
      name: info.name,
      defaultBranch: info.defaultBranch,
      isRemote: false,
      localPath: this.repoPath,
    };
  }

  async listBranches(): Promise<RepoBranch[]> {
    const branches = await localListBranches(this.repoPath);
    const info = await localGetRepoInfo(this.repoPath);
    const result: RepoBranch[] = [];
    for (const b of branches) {
      try {
        const sha = await localResolveRef(this.repoPath, b);
        result.push({
          name: b,
          commitSha: sha,
          isDefault: b === info.defaultBranch,
        });
      } catch {
        result.push({
          name: b,
          commitSha: "",
          isDefault: b === info.defaultBranch,
        });
      }
    }
    return result;
  }

  async resolveRef(ref: string): Promise<string> {
    return localResolveRef(this.repoPath, ref);
  }

  async getCommit(ref: string): Promise<RepoCommit> {
    return localGetCommit(this.repoPath, ref);
  }

  async getHistory(limit = 50, filePath?: string): Promise<RepoCommit[]> {
    return localGetHistory(this.repoPath, limit, filePath);
  }

  async getChangedFiles(baseSha: string, headSha: string): Promise<RepoChangedFile[]> {
    const diffFiles = await localGetDiff(this.repoPath, baseSha, headSha);
    return diffFiles.map((d) => ({
      path: d.path,
      oldPath: d.oldPath,
      changeType: d.changeType,
      binary: d.binary,
    }));
  }

  async getFileContent(ref: string, filePath: string): Promise<string> {
    return localGetFileAtCommit(this.repoPath, ref, filePath);
  }

  async compare(baseSha: string, headSha: string): Promise<RepoCompareResult> {
    const files = await this.getChangedFiles(baseSha, headSha);
    return {
      baseSha,
      headSha,
      files,
      diff: "",
    };
  }
}

export class GitHubRepositoryProvider implements IRepositoryProvider {
  constructor(
    private readonly owner: string,
    private readonly repo: string,
    private readonly token?: string,
    private readonly baseUrl: string = "https://api.github.com"
  ) {}

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
      const body = await res.text().catch(() => "");
      throw new Error(`GitHub API request to ${endpoint} failed (${res.status}): ${body}`);
    }

    return res.json() as Promise<T>;
  }

  async getIdentity(): Promise<RepoIdentity> {
    const data = await this.request<any>(`/repos/${this.owner}/${this.repo}`);
    return {
      id: `${this.owner}/${this.repo}`,
      name: data.name,
      defaultBranch: data.default_branch || "main",
      isRemote: true,
      remoteOwner: this.owner,
      remoteRepo: this.repo,
    };
  }

  async listBranches(): Promise<RepoBranch[]> {
    const branches = await this.request<any[]>(`/repos/${this.owner}/${this.repo}/branches`);
    const identity = await this.getIdentity();
    return branches.map((b) => ({
      name: b.name,
      commitSha: b.commit?.sha || "",
      isDefault: b.name === identity.defaultBranch,
    }));
  }

  async resolveRef(ref: string): Promise<string> {
    if (/^[0-9a-f]{40}$/i.test(ref)) {
      return ref;
    }
    try {
      const commit = await this.request<any>(`/repos/${this.owner}/${this.repo}/commits/${ref}`);
      return commit.sha;
    } catch {
      const branch = await this.request<any>(`/repos/${this.owner}/${this.repo}/branches/${ref}`);
      return branch.commit.sha;
    }
  }

  async getCommit(ref: string): Promise<RepoCommit> {
    const data = await this.request<any>(`/repos/${this.owner}/${this.repo}/commits/${ref}`);
    return {
      sha: data.sha,
      author: data.commit?.author?.name || "Unknown",
      date: data.commit?.author?.date || new Date().toISOString(),
      parents: (data.parents || []).map((p: any) => p.sha),
      message: data.commit?.message || "",
    };
  }

  async getHistory(limit = 50): Promise<RepoCommit[]> {
    const commits = await this.request<any[]>(`/repos/${this.owner}/${this.repo}/commits?per_page=${Math.min(limit, 100)}`);
    return commits.map((c) => ({
      sha: c.sha,
      author: c.commit?.author?.name || "Unknown",
      date: c.commit?.author?.date || new Date().toISOString(),
      parents: (c.parents || []).map((p: any) => p.sha),
      message: c.commit?.message || "",
    }));
  }

  async getChangedFiles(baseSha: string, headSha: string): Promise<RepoChangedFile[]> {
    const comparison = await this.request<any>(`/repos/${this.owner}/${this.repo}/compare/${baseSha}...${headSha}`);
    return (comparison.files || []).map((f: any) => {
      let changeType: ChangeType = "modified";
      if (f.status === "added") changeType = "added";
      else if (f.status === "removed") changeType = "deleted";
      else if (f.status === "renamed") changeType = "renamed";
      return {
        path: f.filename,
        oldPath: f.previous_filename || null,
        changeType,
        binary: !f.patch && f.changes === 0,
        additions: f.additions,
        deletions: f.deletions,
      };
    });
  }

  async getFileContent(ref: string, filePath: string): Promise<string> {
    const data = await this.request<any>(`/repos/${this.owner}/${this.repo}/contents/${filePath}?ref=${ref}`);
    if (data.content && data.encoding === "base64") {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return "";
  }

  async compare(baseSha: string, headSha: string): Promise<RepoCompareResult> {
    const comparison = await this.request<any>(`/repos/${this.owner}/${this.repo}/compare/${baseSha}...${headSha}`);
    const files = (comparison.files || []).map((f: any) => {
      let changeType: ChangeType = "modified";
      if (f.status === "added") changeType = "added";
      else if (f.status === "removed") changeType = "deleted";
      else if (f.status === "renamed") changeType = "renamed";
      return {
        path: f.filename,
        oldPath: f.previous_filename || null,
        changeType,
        binary: !f.patch && f.changes === 0,
        additions: f.additions,
        deletions: f.deletions,
      };
    });
    const patchParts = (comparison.files || []).map((f: any) => f.patch || "").filter(Boolean);
    return {
      baseSha,
      headSha,
      files,
      diff: patchParts.join("\n"),
    };
  }
}

