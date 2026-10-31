export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskFactor {
  dimension: 'change_magnitude' | 'dependency_exposure' | 'structural_importance' | 'uncertainty';
  name: string;
  contribution: number;
  description: string;
  evidence: string[];
}

export interface ContributingSourceEvidence {
  sourceChangeKey: string;
  sourceChangeFile: string;
  impactPaths: string[][];
  edgeKeys: string[];
}

export interface RiskTargetComponent {
  targetKey: string;
  targetType: 'file' | 'symbol' | 'module';
  targetFile: string | null;
  targetSymbol: string | null;
  score: number;
  level: RiskLevel;
  severity: number;
  likelihood: number;
  confidence: number;
  isConfirmed: boolean;
  reasons: string[];
  evidence: {
    impactPaths: string[][];
    edgeKeys: string[];
    classification: string;
    depth: number;
    sourceChangeKey?: string;
    sourceChangeFile?: string;
    contributingSources?: ContributingSourceEvidence[];
    scoringSignals?: {
      magnitudeSignal: number;
      exposureSignal: number;
      structuralSignal: number;
      uncertaintySignal: number;
    };
  };
  unresolvedLimitations: string[];
}

export interface ConfirmedExposureMetrics {
  directDependentsCount: number;
  transitiveDependentsCount: number;
  maxDepthReached: number;
  distinctImpactedFiles: number;
  distinctImpactedSymbols: number;
}

export interface PotentialExposureMetrics {
  unresolvedCount: number;
  ambiguousCount: number;
  unresolvedTargetKeys: string[];
  ambiguousTargetKeys: string[];
}

export interface RiskAssessmentReport {
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  modelVersion: string;
  score: number;
  level: RiskLevel;
  severity: number;
  likelihood: number;
  confidence: number;
  uncertaintyScore: number;
  uncertaintyAdjustment: number;
  evidenceCompleteness: number;
  factors: RiskFactor[];
  highestRiskTargets: RiskTargetComponent[];
  confirmedExposure: ConfirmedExposureMetrics;
  potentialExposure: PotentialExposureMetrics;
  supportingEvidence: {
    totalChangedFiles: number;
    totalChangedSymbols: number;
    totalDirectImpacts: number;
    totalTransitiveImpacts: number;
    maxImpactDepth: number;
    unresolvedCount: number;
    ambiguousCount: number;
  };
  limitations: string[];
  missingEvidence: string[];
  metadata: Record<string, unknown>;
  timestamp: string;
  stage: string;
}

export interface ChangedSymbolInfo {
  symbolKey: string;
  name: string;
  kind: string;
  file: string;
  lineStart?: number;
  lineEnd?: number;
  changeType?: string;
  isExported?: boolean;
  isReExport?: boolean;
}

export interface RiskScoringInput {
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  changedFiles: Array<{
    path: string;
    changeType: string;
    oldPath?: string | null;
  }>;
  changedSymbols: ChangedSymbolInfo[];
  impactResults: Array<{
    resultKey: string;
    targetKey: string;
    targetType: string;
    targetFile: string | null;
    targetSymbol: string | null;
    sourceChangeKey: string;
    sourceChangeFile: string;
    sourceChangeSymbol: string | null;
    classification: string;
    depth: number;
    path: string[];
    relationshipTypes: string[];
    edgeKeys: string[];
    resolutionStatus: string;
    provenanceError?: string;
  }>;
  investigations: Array<{
    stage: string;
    status: string;
    error?: string | null;
  }>;
  hasDiffHunks: boolean;
  isVerifiedEmptyDiff?: boolean;
  gitDiffStatus?: 'complete' | 'empty' | 'partial' | 'failed' | 'unavailable';
  validEdgeKeys?: Set<string>;
  extraLimitations?: string[];
}
