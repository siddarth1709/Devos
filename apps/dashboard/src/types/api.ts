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
  pullRequestId?: string;
  baseSha?: string;
  headSha?: string;
  status: AnalysisJobStatus;
  progressPercent?: number;
  currentStep?: string;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  finishedAt?: string | null;
  error?: string | null;
}

// ============================================================================
// Engineering Graph Entities
// ============================================================================

export type SymbolKind =
  | "function"
  | "class"
  | "method"
  | "file"
  | "module"
  | "variable"
  | "interface";

export type SymbolChangeStatus = "unchanged" | "modified" | "added" | "deleted";
export type SymbolImpactStatus = "none" | "root_cause" | "impacted";

export interface SymbolEntity {
  id: string;
  name: string;
  kind: SymbolKind;
  file: string;
  lineStart: number;
  lineEnd: number;
  commitSha?: string;
  collector?: string;
  changeStatus?: SymbolChangeStatus;
  impactStatus?: SymbolImpactStatus;
}

export type DependencyEdgeKind =
  | "imports"
  | "calls"
  | "references"
  | "extends"
  | "implements"
  | "mutates";

export interface DependencyEdgeEntity {
  id: string;
  from: string; // source symbol id or file path
  to: string;   // target symbol id or file path
  kind: DependencyEdgeKind;
  sourceFile: string;
  sourceLine: number;
  commitSha?: string;
  collector?: string;
}

export interface DependencyGraphData {
  repositoryId: string;
  analysisId?: string;
  symbols: SymbolEntity[];
  edges: DependencyEdgeEntity[];
  changedSymbols: string[];
  impactedSymbols?: string[];
}

// ============================================================================
// AI Code Review Entities
// ============================================================================

export type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";
export type FindingOrigin = "deterministic" | "gemma";
export type FindingStatus = "confirmed" | "hypothesis";
export type ConfidenceLevel = "Low" | "Medium" | "High" | "Very High";
export type ReadinessState = "safe" | "conditional" | "unsafe" | "unknown";

export type EvidenceType =
  | "diff"
  | "source"
  | "dependency"
  | "test"
  | "git-history"
  | "coverage"
  | "runtime";

export interface Evidence {
  id: string;
  type: EvidenceType;
  sourceCommit: string;
  file: string;
  lineStart: number | null;
  lineEnd: number | null;
  symbol: string | null;
  collector: string;
  collectedAt: string;
  payload?: string | Record<string, unknown>;
}

export interface Finding {
  id: string;
  title: string;
  severity: FindingSeverity;
  description: string;
  evidenceIds: string[];
  origin: FindingOrigin;
  status: FindingStatus;
  confidence: ConfidenceLevel;
  file?: string;
  line?: number;
  symbol?: string;
  rationale?: string;
  remediation?: string;
  relatedSymbolIds?: string[];
  architecturalImpact?: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  findingIds: string[];
  priority: "low" | "medium" | "high" | "critical";
  suggestedAction?: string | null;
  rationale?: string | null;
}

export interface AnalysisReport {
  jobId: string;
  summary: string;
  findings: Finding[];
  changedSymbols: string[];
  impact: string;
  readiness: ReadinessState;
  confidence: ConfidenceLevel;
  limitations: string[];
  missingEvidence: string[];
  trustMeter: number;
  claimsVerified: number;
  claimsRejected: number;
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

