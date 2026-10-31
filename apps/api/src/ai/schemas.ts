import { z } from 'zod';

export const AiFindingSchema = z.object({
  id: z.string().default(() => `ai-finding-${Math.random().toString(36).slice(2, 9)}`),
  title: z.string(),
  description: z.string(),
  findingType: z.enum(['verified_evidence', 'model_inference', 'unverified_hypothesis']).default('model_inference'),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  confidence: z.enum(['Low', 'Medium', 'High', 'Very High']).default('Medium'),
  fileReferences: z.array(z.string()).default([]),
  symbolReferences: z.array(z.string()).default([]),
  evidenceReferences: z.array(z.string()).default([]),
  uncertaintyExplanation: z.string().optional(),
});

export const AiChangeReviewSchema = z.object({
  summary: z.string(),
  behavioralChanges: z.array(z.string()).default([]),
  reviewPriorities: z.array(z.string()).default([]),
  potentialRegressions: z.array(z.string()).default([]),
  crossModuleConcerns: z.array(z.string()).default([]),
  findings: z.array(AiFindingSchema).default([]),
  missingEvidence: z.array(z.string()).default([]),
  humanReviewQuestions: z.array(z.string()).default([]),
});

export const AiRiskExplanationSchema = z.object({
  summary: z.string(),
  scoreRationale: z.string(),
  contributingFactorsExplanation: z.array(z.string()).default([]),
  affectedTargetsExplanation: z.array(z.string()).default([]),
  confirmedExposureSummary: z.string().default(''),
  unresolvedExposureSummary: z.string().default(''),
  missingEvidenceSummary: z.array(z.string()).default([]),
  uncertaintyAssessment: z.string().default(''),
  findings: z.array(AiFindingSchema).default([]),
});

export const AiCommitSuggestionSchema = z.object({
  type: z.string(),
  scope: z.string().optional(),
  subject: z.string(),
  body: z.string().optional(),
  bullets: z.array(z.string()).default([]),
  isBreaking: z.boolean().default(false),
});

export const AiCommitAssistantSchema = z.object({
  suggestions: z.array(AiCommitSuggestionSchema).default([]),
});

export const AiReleaseNotesSchema = z.object({
  features: z.array(z.string()).default([]),
  fixes: z.array(z.string()).default([]),
  refactoring: z.array(z.string()).default([]),
  internalChanges: z.array(z.string()).default([]),
  breakingChanges: z.array(z.string()).default([]),
  compatibilityConcerns: z.array(z.string()).default([]),
  markdown: z.string().default(''),
});

export const AiQnASchema = z.object({
  answer: z.string(),
  fileReferences: z.array(z.string()).default([]),
  symbolReferences: z.array(z.string()).default([]),
  evidenceReferences: z.array(z.string()).default([]),
  confidence: z.enum(['Low', 'Medium', 'High', 'Very High']).default('Medium'),
  sufficientEvidence: z.boolean().default(true),
  limitations: z.array(z.string()).default([]),
});

