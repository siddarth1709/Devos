import { z } from 'zod';

// ============================================================================
// 1. Enums
// ============================================================================

export const ReadinessStateEnum = z.enum(['safe', 'conditional', 'unsafe', 'unknown']);
export type ReadinessState = z.infer<typeof ReadinessStateEnum>;

export const ConfidenceEnum = z.enum(['Low', 'Medium', 'High', 'Very High']);
export type Confidence = z.infer<typeof ConfidenceEnum>;

export const AnalysisStatusEnum = z.enum(['queued', 'running', 'done', 'failed', 'completed', 'partial']);
export type AnalysisStatus = z.infer<typeof AnalysisStatusEnum>;

export const EvidenceTypeEnum = z.enum([
  'diff',
  'source',
  'dependency',
  'test',
  'git-history',
  'coverage',
  'runtime',
]);
export type EvidenceType = z.infer<typeof EvidenceTypeEnum>;

export const FindingSeverityEnum = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export type FindingSeverity = z.infer<typeof FindingSeverityEnum>;

export const FindingOriginEnum = z.enum(['deterministic', 'gemma']);
export type FindingOrigin = z.infer<typeof FindingOriginEnum>;

export const FindingStatusEnum = z.enum(['confirmed', 'hypothesis']);
export type FindingStatus = z.infer<typeof FindingStatusEnum>;

export const HypothesisStatusEnum = z.enum(['proposed', 'validated', 'rejected']);
export type HypothesisStatus = z.infer<typeof HypothesisStatusEnum>;

export const RecommendationPriorityEnum = z.enum(['low', 'medium', 'high', 'critical']);
export type RecommendationPriority = z.infer<typeof RecommendationPriorityEnum>;

export const ActionStatusEnum = z.enum(['pending', 'approved', 'rejected', 'executed', 'failed']);
export type ActionStatus = z.infer<typeof ActionStatusEnum>;

// ============================================================================
// 2. Error Shape
// ============================================================================

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ============================================================================
// 3. Core Entities
// ============================================================================

export const RepositorySchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  defaultBranch: z.string(),
  createdAt: z.string(),
});
export type Repository = z.infer<typeof RepositorySchema>;

export const AnalysisJobSchema = z.object({
  id: z.string(),
  repositoryId: z.string(),
  baseSha: z.string(),
  headSha: z.string(),
  status: AnalysisStatusEnum,
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  error: z.string().nullable(),
});
export type AnalysisJob = z.infer<typeof AnalysisJobSchema>;

export const EvidenceSchema = z.object({
  id: z.string(),
  type: EvidenceTypeEnum,
  sourceCommit: z.string(),
  file: z.string(),
  lineStart: z.number().int().nullable(),
  lineEnd: z.number().int().nullable(),
  symbol: z.string().nullable(),
  collector: z.string(),
  collectedAt: z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const FindingSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: FindingSeverityEnum,
  description: z.string(),
  evidenceIds: z.array(z.string()),
  origin: FindingOriginEnum,
  status: FindingStatusEnum,
  confidence: ConfidenceEnum,
});
export type Finding = z.infer<typeof FindingSchema>;

export const HypothesisSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  rationale: z.string(),
  evidenceIds: z.array(z.string()),
  status: HypothesisStatusEnum,
  confidence: ConfidenceEnum,
  createdAt: z.string(),
});
export type Hypothesis = z.infer<typeof HypothesisSchema>;

export const RecommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  findingIds: z.array(z.string()),
  priority: RecommendationPriorityEnum,
  suggestedAction: z.string().nullable().optional(),
  rationale: z.string().nullable().optional(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const ActionRequestSchema = z.object({
  id: z.string(),
  type: z.string(),
  target: z.string(),
  params: z.record(z.unknown()),
  requestedBy: z.string(),
  requestedAt: z.string(),
  status: ActionStatusEnum,
});
export type ActionRequest = z.infer<typeof ActionRequestSchema>;

export const ActionResultSchema = z.object({
  actionRequestId: z.string(),
  success: z.boolean(),
  output: z.unknown(),
  error: z.string().nullable(),
  executedAt: z.string(),
});
export type ActionResult = z.infer<typeof ActionResultSchema>;

export const AnalysisReportSchema = z.object({
  jobId: z.string(),
  summary: z.string(),
  findings: z.array(FindingSchema),
  changedSymbols: z.array(z.string()),
  impact: z.string(),
  readiness: ReadinessStateEnum,
  confidence: ConfidenceEnum,
  limitations: z.array(z.string()),
  missingEvidence: z.array(z.string()),
  trustMeter: z.number().min(0).max(100),
  claimsVerified: z.number().int().min(0),
  claimsRejected: z.number().int().min(0),
});
export type AnalysisReport = z.infer<typeof AnalysisReportSchema>;

// ============================================================================
// 4. Endpoint Request / Response Schemas
// ============================================================================

// --- GET /api/health ---
export const HealthResponseSchema = z.object({
  status: z.string(),
  version: z.string(),
  uptime: z.number(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// --- GET /api/repositories ---
export const GetRepositoriesResponseSchema = z.object({
  repositories: z.array(RepositorySchema),
});
export type GetRepositoriesResponse = z.infer<typeof GetRepositoriesResponseSchema>;

// --- POST /api/repositories ---
export const CreateRepositoryRequestSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  defaultBranch: z.string().min(1).default('main').optional(),
});
export type CreateRepositoryRequest = z.infer<typeof CreateRepositoryRequestSchema>;

export const CreateRepositoryResponseSchema = RepositorySchema;
export type CreateRepositoryResponse = z.infer<typeof CreateRepositoryResponseSchema>;

// --- POST /api/analyses ---
export const CreateAnalysisRequestSchema = z.object({
  repositoryId: z.string().min(1),
  baseSha: z.string().min(1),
  headSha: z.string().min(1),
});
export type CreateAnalysisRequest = z.infer<typeof CreateAnalysisRequestSchema>;

export const CreateAnalysisResponseSchema = AnalysisJobSchema;
export type CreateAnalysisResponse = z.infer<typeof CreateAnalysisResponseSchema>;

// --- GET /api/analyses/:id ---
export const GetAnalysisParamsSchema = z.object({
  id: z.string().min(1),
});
export type GetAnalysisParams = z.infer<typeof GetAnalysisParamsSchema>;

export const GetAnalysisResponseSchema = z.object({
  job: AnalysisJobSchema,
  report: AnalysisReportSchema.nullable().optional(),
});
export type GetAnalysisResponse = z.infer<typeof GetAnalysisResponseSchema>;

// --- POST /api/analyses/:id/review ---
export const ReviewAnalysisParamsSchema = z.object({
  id: z.string().min(1),
});
export type ReviewAnalysisParams = z.infer<typeof ReviewAnalysisParamsSchema>;

export const ReviewFindingItemSchema = z.object({
  findingId: z.string().min(1),
  status: z.enum(['confirmed', 'hypothesis', 'rejected']),
  notes: z.string().optional(),
});
export type ReviewFindingItem = z.infer<typeof ReviewFindingItemSchema>;

export const ReviewAnalysisRequestSchema = z.object({
  findingsReview: z.array(ReviewFindingItemSchema).optional(),
  comments: z.string().optional(),
});
export type ReviewAnalysisRequest = z.infer<typeof ReviewAnalysisRequestSchema>;

export const ReviewAnalysisResponseSchema = z.object({
  jobId: z.string(),
  reviewedAt: z.string(),
  status: z.enum(['reviewed', 'pending_revision']),
  comments: z.string().nullable().optional(),
});
export type ReviewAnalysisResponse = z.infer<typeof ReviewAnalysisResponseSchema>;

// --- GET /api/analyses/:id/export ---
export const ExportAnalysisParamsSchema = z.object({
  id: z.string().min(1),
});
export type ExportAnalysisParams = z.infer<typeof ExportAnalysisParamsSchema>;

export const ExportAnalysisQuerySchema = z.object({
  format: z.enum(['json', 'markdown']).default('json').optional(),
});
export type ExportAnalysisQuery = z.infer<typeof ExportAnalysisQuerySchema>;

export const ExportAnalysisResponseSchema = z.object({
  jobId: z.string(),
  format: z.enum(['json', 'markdown']),
  exportedAt: z.string(),
  content: z.string(),
});
export type ExportAnalysisResponse = z.infer<typeof ExportAnalysisResponseSchema>;

// --- POST /api/actions ---
export const CreateActionRequestSchema = z.object({
  type: z.string().min(1),
  target: z.string().min(1),
  params: z.record(z.unknown()).default({}),
  requestedBy: z.string().min(1).default('system').optional(),
});
export type CreateActionRequest = z.infer<typeof CreateActionRequestSchema>;

export const CreateActionResponseSchema = ActionRequestSchema;
export type CreateActionResponse = z.infer<typeof CreateActionResponseSchema>;

// --- POST /api/actions/:id/approve ---
export const ApproveActionParamsSchema = z.object({
  id: z.string().min(1),
});
export type ApproveActionParams = z.infer<typeof ApproveActionParamsSchema>;

export const ApproveActionRequestSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
});
export type ApproveActionRequest = z.infer<typeof ApproveActionRequestSchema>;

export const ApproveActionResponseSchema = z.object({
  action: ActionRequestSchema,
  result: ActionResultSchema.nullable().optional(),
});
export type ApproveActionResponse = z.infer<typeof ApproveActionResponseSchema>;
