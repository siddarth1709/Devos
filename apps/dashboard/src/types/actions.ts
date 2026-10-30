export type ActionCategory =
  | "code_quality"
  | "change_management"
  | "repository_maintenance";

export type ActionAvailability =
  | "available"
  | "requires_approval"
  | "unavailable"
  | "permission_denied";

export type ActionExecutionStatus =
  | "awaiting_approval"
  | "approved"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "rejected";

export interface ActionDefinition {
  id: string;
  type: string;
  name: string;
  description: string;
  category: ActionCategory;
  requiredPermissions: string[];
  requiresApproval: boolean;
  modifiesState: boolean;
  isReversible: boolean;
  defaultParams: Record<string, unknown>;
  potentialImpact: string;
}

export interface ActionRequest {
  id: string;
  type: string;
  target: string;
  params: Record<string, unknown>;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
}

export interface ActionResult {
  actionRequestId: string;
  success: boolean;
  output: unknown;
  error: string | null;
  executedAt: string;
}

export interface ActionRecord {
  id: string;
  definitionId: string;
  name: string;
  type: string;
  target: string;
  category: ActionCategory;
  params: Record<string, unknown>;
  status: ActionExecutionStatus;
  requestedBy: string;
  requestedAt: string;
  approvedAt?: string | null;
  executedAt?: string | null;
  durationMs?: number;
  output?: unknown;
  error?: string | null;
}

