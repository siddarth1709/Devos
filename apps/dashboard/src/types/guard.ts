import type { ReadinessState, FindingSeverity } from "./api";

export type CheckStatus =
  | "passed"
  | "failed"
  | "warning"
  | "not_run"
  | "unavailable";

export type GuardCategoryKey =
  | "change_integrity"
  | "code_quality"
  | "test_health"
  | "dependency_health"
  | "runtime_configuration"
  | "review_integrity";

export interface GuardCheck {
  id: string;
  category: GuardCategoryKey;
  name: string;
  status: CheckStatus;
  description: string;
  evidenceSource?: string;
  lastExecutedAt?: string | null;
  details?: string;
  findingId?: string;
  symbolId?: string;
  filePath?: string;
  line?: number;
}

export interface GuardBlocker {
  id: string;
  severity: FindingSeverity;
  title: string;
  explanation: string;
  filePath?: string;
  line?: number;
  evidenceIds: string[];
  findingId?: string;
  symbolId?: string;
}

export interface GuardWarning {
  id: string;
  title: string;
  explanation: string;
  impact: string;
  suggestedNextStep?: string;
  evidenceIds?: string[];
  findingId?: string;
}

export interface GuardEvaluation {
  repositoryId: string;
  pullRequestId?: string;
  revision?: string;
  readiness: ReadinessState;
  readinessReason: string;
  lastEvaluatedAt?: string | null;
  checks: GuardCheck[];
  blockers: GuardBlocker[];
  warnings: GuardWarning[];
  outstandingChecks: string[];
  isBackendConnected: boolean;
}

export interface GuardHistoricalRun {
  runId: string;
  timestamp: string;
  readiness: ReadinessState;
  blockerCount: number;
  warningCount: number;
  revision: string;
}

