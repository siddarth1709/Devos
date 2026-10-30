/**
 * DEVOS API Contracts & Data Types
 * Aligned with Builder 2 specifications.
 */

export type UserRole = "developer" | "reviewer" | "admin";

export interface UserProfile {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
  role: UserRole;
}

export type GitHubAuthStatus = "connected" | "not_connected" | "authorizing" | "expired" | "unavailable";

export interface GitHubConnectionState {
  status: GitHubAuthStatus;
  connectedAt?: string;
  scope?: string[];
  installedOrganizations?: string[];
  user?: UserProfile;
}

export interface Repository {
  id: string;
  name: string;
  owner: string;
  fullName: string;
  visibility: "public" | "private" | "internal";
  defaultBranch: string;
  pushedAt?: string;
  updatedAt?: string;
  openIssuesCount?: number;
  openPullRequestsCount?: number;
  isMonorepo?: boolean;
  webhookConfigured?: boolean;
}

export interface Branch {
  name: string;
  isDefault: boolean;
  commitSha: string;
  protected?: boolean;
}

export type PullRequestState = "open" | "closed" | "merged" | "draft";

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  description?: string;
  author: {
    login: string;
    avatarUrl?: string;
  };
  state: PullRequestState;
  sourceBranch: string;
  targetBranch: string;
  createdAt: string;
  updatedAt: string;
  changedFilesCount?: number;
  additionsCount?: number;
  deletionsCount?: number;
  analysisStatus?: "none" | "pending" | "running" | "completed" | "failed";
}

export type FileChangeType = "modified" | "added" | "deleted" | "renamed";

export interface ChangedFile {
  sha: string;
  filename: string;
  status: FileChangeType;
  additions: number;
  deletions: number;
  changes: number;
  rawUrl?: string;
  patch?: string;
  isBinary?: boolean;
}

export interface DiffLine {
  type: "context" | "addition" | "deletion" | "header";
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface FileDiffData {
  filename: string;
  status: FileChangeType;
  additions: number;
  deletions: number;
  isBinary: boolean;
  hunks: DiffHunk[];
  rawPatch?: string;
}

export type AnalysisJobStatus = "queued" | "running" | "completed" | "failed";

export interface AnalysisJob {
  jobId: string;
  repositoryId: string;
  pullRequestId: string;
  status: AnalysisJobStatus;
  progressPercent: number;
  currentStep?: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status: number;
  details?: unknown;
}

