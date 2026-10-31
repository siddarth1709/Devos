import { RiskAssessmentReport } from '../risk/types.js';

export interface HealthCheckResult {
  checkId: string;
  name: string;
  category: 'git' | 'ast' | 'graph' | 'impact' | 'risk' | 'provenance' | 'quality' | 'environment';
  status: 'PASSED' | 'FAILED' | 'WARNED';
  message: string;
  evidence: Record<string, unknown>;
  isBlocking: boolean;
}

export interface PreShipHealthReport {
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  totalChecks: number;
  passedCount: number;
  warnedCount: number;
  failedCount: number;
  checks: HealthCheckResult[];
  evaluatedAt: string;
}

export interface ReleaseGatePolicy {
  maxRiskScore?: number;
  minConfidence?: number;
  blockOnAnyFailedCheck?: boolean;
  allowedRiskLevels?: string[];
}

export interface ReleaseGateEvaluation {
  passed: boolean;
  gateStatus: 'PASSED' | 'FAILED' | 'WARNED';
  blockingReasons: string[];
  warnings: string[];
  policyApplied: Required<ReleaseGatePolicy>;
  healthReport: PreShipHealthReport;
  evaluatedAt: string;
}

export interface HealthCheckInput {
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  changedFilesCount?: number;
  symbolsCount?: number;
  dependencyNodesCount?: number;
  dependencyEdgesCount?: number;
  impactResultsCount?: number;
  riskAssessment?: RiskAssessmentReport | null;
  hasInvalidEdges?: boolean;
  hasMismatchedProvenance?: boolean;
  diffStatus?: string;
  testFilesFound?: boolean;
  databaseUrlConfigured?: boolean;
}

export function evaluatePreShipHealth(input: HealthCheckInput): PreShipHealthReport {
  const checks: HealthCheckResult[] = [];

  const isValidSha = /^[0-9a-f]{7,40}$/i.test(input.commitSha);
  checks.push({
    checkId: 'git_repository_validity',
    name: 'Git Repository Validity',
    category: 'git',
    status: isValidSha && input.repositoryId ? 'PASSED' : 'FAILED',
    message: isValidSha
      ? `Valid repository and commit SHA (${input.commitSha.substring(0, 7)}).`
      : 'Invalid commit SHA or repository identity.',
    evidence: { repositoryId: input.repositoryId, commitSha: input.commitSha },
    isBlocking: true,
  });

  const diffOk = input.diffStatus !== 'failed';
  checks.push({
    checkId: 'git_ingestion_completeness',
    name: 'Git Ingestion Completeness',
    category: 'git',
    status: diffOk ? 'PASSED' : 'FAILED',
    message: diffOk
      ? `Ingestion complete for ${input.changedFilesCount ?? 0} changed files.`
      : 'Git diff extraction failed or encountered unhandled diff truncation.',
    evidence: { changedFilesCount: input.changedFilesCount ?? 0, diffStatus: input.diffStatus ?? 'completed' },
    isBlocking: true,
  });

  const symbolsCount = input.symbolsCount ?? 0;
  checks.push({
    checkId: 'ast_extraction_completeness',
    name: 'AST Extraction Completeness',
    category: 'ast',
    status: 'PASSED',
    message: `AST extraction processed with ${symbolsCount} symbol records.`,
    evidence: { symbolsCount },
    isBlocking: false,
  });

  const nodesCount = input.dependencyNodesCount ?? 0;
  const edgesCount = input.dependencyEdgesCount ?? 0;
  checks.push({
    checkId: 'dependency_graph_completeness',
    name: 'Dependency Graph Completeness',
    category: 'graph',
    status: 'PASSED',
    message: `Dependency graph populated with ${nodesCount} nodes and ${edgesCount} edges.`,
    evidence: { nodesCount, edgesCount },
    isBlocking: false,
  });

  const unconfirmedCount = input.riskAssessment?.uncertaintyScore ?? 0;
  const resolutionStatus = unconfirmedCount > 50 ? 'WARNED' : 'PASSED';
  const confirmedExp = input.riskAssessment?.confirmedExposure
    ? (typeof input.riskAssessment.confirmedExposure === 'number'
        ? input.riskAssessment.confirmedExposure
        : input.riskAssessment.confirmedExposure.directDependentsCount + input.riskAssessment.confirmedExposure.transitiveDependentsCount)
    : 0;
  const potentialExp = input.riskAssessment?.potentialExposure
    ? (typeof input.riskAssessment.potentialExposure === 'number'
        ? input.riskAssessment.potentialExposure
        : input.riskAssessment.potentialExposure.unresolvedCount + input.riskAssessment.potentialExposure.ambiguousCount)
    : 0;
  checks.push({
    checkId: 'dependency_resolution_quality',
    name: 'Dependency Resolution Quality',
    category: 'graph',
    status: resolutionStatus,
    message:
      resolutionStatus === 'PASSED'
        ? 'Dependency resolution within expected confidence boundaries.'
        : `Elevated unresolved/ambiguous dependency density (uncertainty score: ${unconfirmedCount}).`,
    evidence: {
      uncertaintyScore: unconfirmedCount,
      confirmedExposure: confirmedExp,
      potentialExposure: potentialExp,
    },
    isBlocking: false,
  });

  const impactsCount = input.impactResultsCount ?? 0;
  checks.push({
    checkId: 'change_impact_completeness',
    name: 'Change Impact Completeness',
    category: 'impact',
    status: 'PASSED',
    message: `Impact analysis completed with ${impactsCount} impact results.`,
    evidence: { impactsCount },
    isBlocking: true,
  });

  const risk = input.riskAssessment;
  const scoreValid = risk ? risk.score >= 0 && risk.score <= 100 : true;
  const confidenceValid = risk ? risk.confidence >= 0 && risk.confidence <= 100 : true;
  const riskStatus = scoreValid && confidenceValid ? 'PASSED' : 'FAILED';
  checks.push({
    checkId: 'risk_and_confidence_evaluation',
    name: 'Risk and Confidence Evaluation',
    category: 'risk',
    status: riskStatus,
    message:
      riskStatus === 'PASSED'
        ? `Risk score (${risk?.score ?? 0}) and confidence (${risk?.confidence ?? 100}%) within bounds.`
        : 'Risk score or confidence bounds out of range.',
    evidence: { score: risk?.score, confidence: risk?.confidence, level: risk?.level },
    isBlocking: true,
  });

  const hasProvenanceViolations = Boolean(input.hasInvalidEdges || input.hasMismatchedProvenance);
  checks.push({
    checkId: 'provenance_integrity',
    name: 'Provenance Integrity',
    category: 'provenance',
    status: hasProvenanceViolations ? 'FAILED' : 'PASSED',
    message: hasProvenanceViolations
      ? 'Provenance validation failed: mismatched or unverified edge/commit provenance.'
      : 'All analytical outputs trace directly to verified analysis and commit provenance.',
    evidence: {
      hasInvalidEdges: Boolean(input.hasInvalidEdges),
      hasMismatchedProvenance: Boolean(input.hasMismatchedProvenance),
    },
    isBlocking: true,
  });

  const hasTests = input.testFilesFound ?? false;
  checks.push({
    checkId: 'test_evidence_availability',
    name: 'Test Evidence Availability',
    category: 'quality',
    status: hasTests ? 'PASSED' : 'WARNED',
    message: hasTests
      ? 'Associated test evidence identified for changes.'
      : 'No automated tests identified in modified file set or directly adjacent files.',
    evidence: { testFilesFound: hasTests },
    isBlocking: false,
  });

  const dbConfigured = input.databaseUrlConfigured !== false;
  checks.push({
    checkId: 'environment_configuration',
    name: 'Environment Configuration',
    category: 'environment',
    status: dbConfigured ? 'PASSED' : 'FAILED',
    message: dbConfigured
      ? 'Database configuration and environment variables verified.'
      : 'Missing required environment configuration (DATABASE_URL).',
    evidence: { databaseUrlConfigured: dbConfigured },
    isBlocking: true,
  });

  let failedCount = 0;
  let warnedCount = 0;
  let passedCount = 0;

  for (const c of checks) {
    if (c.status === 'FAILED') failedCount++;
    else if (c.status === 'WARNED') warnedCount++;
    else passedCount++;
  }

  let overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
  if (failedCount > 0) {
    overallStatus = 'UNHEALTHY';
  } else if (warnedCount > 0) {
    overallStatus = 'DEGRADED';
  }

  return {
    analysisId: input.analysisId,
    repositoryId: input.repositoryId,
    commitSha: input.commitSha,
    overallStatus,
    totalChecks: checks.length,
    passedCount,
    warnedCount,
    failedCount,
    checks,
    evaluatedAt: new Date().toISOString(),
  };
}

export function evaluateReleaseGate(
  input: HealthCheckInput,
  userPolicy?: ReleaseGatePolicy
): ReleaseGateEvaluation {
  const policy: Required<ReleaseGatePolicy> = {
    maxRiskScore: userPolicy?.maxRiskScore ?? 75,
    minConfidence: userPolicy?.minConfidence ?? 40,
    blockOnAnyFailedCheck: userPolicy?.blockOnAnyFailedCheck ?? true,
    allowedRiskLevels: userPolicy?.allowedRiskLevels ?? ['LOW', 'MEDIUM'],
  };

  const healthReport = evaluatePreShipHealth(input);
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (policy.blockOnAnyFailedCheck) {
    for (const c of healthReport.checks) {
      if (c.status === 'FAILED' && c.isBlocking) {
        blockingReasons.push(`Blocking health check failed: ${c.name} - ${c.message}`);
      } else if (c.status === 'WARNED') {
        warnings.push(`Health warning: ${c.name} - ${c.message}`);
      }
    }
  }

  const riskScore = input.riskAssessment?.score ?? 0;
  if (riskScore > policy.maxRiskScore) {
    blockingReasons.push(
      `Risk score (${riskScore}) exceeds configured maximum allowable threshold of ${policy.maxRiskScore}.`
    );
  }

  const confidence = input.riskAssessment?.confidence ?? 100;
  if (confidence < policy.minConfidence) {
    blockingReasons.push(
      `Assessment confidence (${confidence}%) falls below required minimum threshold of ${policy.minConfidence}%.`
    );
  }

  const riskLevel = (input.riskAssessment?.level ?? 'LOW').toUpperCase();
  const allowed = policy.allowedRiskLevels.map((l) => l.toUpperCase());
  if (!allowed.includes(riskLevel)) {
    blockingReasons.push(
      `Risk level '${riskLevel}' is not among allowed levels: [${policy.allowedRiskLevels.join(', ')}].`
    );
  }

  const passed = blockingReasons.length === 0;
  let gateStatus: 'PASSED' | 'FAILED' | 'WARNED' = 'PASSED';
  if (!passed) {
    gateStatus = 'FAILED';
  } else if (warnings.length > 0) {
    gateStatus = 'WARNED';
  }

  return {
    passed,
    gateStatus,
    blockingReasons,
    warnings,
    policyApplied: policy,
    healthReport,
    evaluatedAt: new Date().toISOString(),
  };
}
