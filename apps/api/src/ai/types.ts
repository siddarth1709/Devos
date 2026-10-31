export type FindingType = 'verified_evidence' | 'model_inference' | 'unverified_hypothesis';

export type ConfidenceLevel = 'Low' | 'Medium' | 'High' | 'Very High';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ModelInfo {
  name: string;
  size?: number;
  modifiedAt?: string;
  digest?: string;
  details?: Record<string, unknown>;
}

export interface AiProviderStatus {
  enabled: boolean;
  ollamaRunning: boolean;
  endpoint: string;
  configuredModel: string;
  modelInstalled: boolean;
  installedModels: string[];
  error?: string | null;
}

export interface AiFinding {
  id: string;
  title: string;
  description: string;
  findingType: FindingType;
  severity?: FindingSeverity;
  confidence: ConfidenceLevel;
  fileReferences: string[];
  symbolReferences: string[];
  evidenceReferences: string[];
  uncertaintyExplanation?: string;
}

export interface AiChangeReviewResult {
  summary: string;
  behavioralChanges: string[];
  reviewPriorities: string[];
  potentialRegressions: string[];
  crossModuleConcerns: string[];
  findings: AiFinding[];
  missingEvidence: string[];
  humanReviewQuestions: string[];
  truncated: boolean;
  timestamp: string;
  model: string;
}

export interface AiRiskExplanationResult {
  summary: string;
  scoreRationale: string;
  contributingFactorsExplanation: string[];
  affectedTargetsExplanation: string[];
  confirmedExposureSummary: string;
  unresolvedExposureSummary: string;
  missingEvidenceSummary: string[];
  uncertaintyAssessment: string;
  nonFailureProbabilityNotice: string;
  immutableRiskScore: number;
  immutableRiskLevel: string;
  findings: AiFinding[];
  truncated: boolean;
  model: string;
}

export interface AiCommitSuggestion {
  type: string;
  scope?: string;
  subject: string;
  body?: string;
  bullets: string[];
  isBreaking: boolean;
  conventionalCommit: string;
}

export interface AiCommitResult {
  suggestions: AiCommitSuggestion[];
  model: string;
}

export interface AiReleaseNotesResult {
  features: string[];
  fixes: string[];
  refactoring: string[];
  internalChanges: string[];
  breakingChanges: string[];
  compatibilityConcerns: string[];
  markdown: string;
  model: string;
}

export interface AiQnAResult {
  question: string;
  answer: string;
  fileReferences: string[];
  symbolReferences: string[];
  evidenceReferences: string[];
  confidence: ConfidenceLevel;
  sufficientEvidence: boolean;
  limitations: string[];
  model: string;
}

export interface AiServiceResponse<T> {
  success: boolean;
  aiEnabled: boolean;
  ollamaAvailable: boolean;
  model: string;
  data?: T;
  fallback?: unknown;
  error?: string;
  notice?: string;
}

