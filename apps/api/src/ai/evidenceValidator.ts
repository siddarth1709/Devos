import { AnalysisEvidenceContext } from './contextBuilder.js';
import {
  AiFinding,
  AiChangeReviewResult,
  AiRiskExplanationResult,
  AiCommitResult,
  AiReleaseNotesResult,
  AiQnAResult,
} from './types.js';

export function validateFindingEvidence(
  finding: AiFinding,
  context: AnalysisEvidenceContext
): AiFinding {
  const validEvidenceIds = new Set(context.evidenceItems.map((e) => e.id));
  const validFiles = new Set([
    ...context.changedFiles.map((f) => f.path),
    ...context.evidenceItems.map((e) => e.file),
    ...context.changedSymbols.map((s) => s.file),
  ]);
  const validSymbols = new Set([
    ...context.changedSymbols.map((s) => s.name),
    ...context.changedSymbols.map((s) => s.symbolKey).filter(Boolean),
    ...context.highestRiskTargets.map((t) => t.targetKey),
  ]);

  const validatedEvidence = (finding.evidenceReferences || []).filter((id) => validEvidenceIds.has(id));
  const validatedFiles = (finding.fileReferences || []).filter((f) => {
    return Array.from(validFiles).some((vf) => vf === f || vf.endsWith('/' + f) || f.endsWith('/' + vf));
  });
  const validatedSymbols = (finding.symbolReferences || []).filter((s) => {
    return Array.from(validSymbols).some((vs) => vs === s || (vs && vs.includes(s)));
  });

  let findingType = finding.findingType || 'model_inference';
  if (findingType === 'verified_evidence' && validatedEvidence.length === 0) {
    findingType = 'model_inference';
  }

  let uncertaintyExplanation = finding.uncertaintyExplanation;
  if (findingType !== 'verified_evidence' && !uncertaintyExplanation) {
    uncertaintyExplanation = 'Model-derived inference based on code changes; requires independent developer verification.';
  }

  return {
    ...finding,
    findingType,
    evidenceReferences: validatedEvidence,
    fileReferences: validatedFiles,
    symbolReferences: validatedSymbols,
    uncertaintyExplanation,
  };
}

export function validateChangeReview(
  raw: any,
  context: AnalysisEvidenceContext,
  modelName: string
): AiChangeReviewResult {
  const findings: AiFinding[] = Array.isArray(raw.findings)
    ? raw.findings.map((f: any) => validateFindingEvidence(f, context))
    : [];

  const validFiles = new Set(context.changedFiles.map((f) => f.path));

  const behavioralChanges = Array.isArray(raw.behavioralChanges)
    ? raw.behavioralChanges.map(String).filter((s: string) => s.trim().length > 0)
    : [];

  const reviewPriorities = Array.isArray(raw.reviewPriorities)
    ? raw.reviewPriorities.map(String).filter((s: string) => s.trim().length > 0)
    : [];

  const potentialRegressions = Array.isArray(raw.potentialRegressions)
    ? raw.potentialRegressions.map(String).filter((s: string) => s.trim().length > 0)
    : [];

  const crossModuleConcerns = Array.isArray(raw.crossModuleConcerns)
    ? raw.crossModuleConcerns.map(String).filter((s: string) => s.trim().length > 0)
    : [];

  const missingEvidence = Array.isArray(raw.missingEvidence) && raw.missingEvidence.length > 0
    ? raw.missingEvidence.map(String)
    : context.missingEvidence;

  const humanReviewQuestions = Array.isArray(raw.humanReviewQuestions)
    ? raw.humanReviewQuestions.map(String).filter((s: string) => s.trim().length > 0)
    : [];

  return {
    summary: String(raw.summary || 'Summary generated from repository evidence.').trim(),
    behavioralChanges,
    reviewPriorities,
    potentialRegressions,
    crossModuleConcerns,
    findings,
    missingEvidence,
    humanReviewQuestions,
    truncated: context.truncated,
    timestamp: new Date().toISOString(),
    model: modelName,
  };
}

export function validateRiskExplanation(
  raw: any,
  context: AnalysisEvidenceContext,
  modelName: string
): AiRiskExplanationResult {
  const findings: AiFinding[] = Array.isArray(raw.findings)
    ? raw.findings.map((f: any) => validateFindingEvidence(f, context))
    : [];

  const contributingFactors = Array.isArray(raw.contributingFactorsExplanation)
    ? raw.contributingFactorsExplanation.map(String)
    : context.riskFactors;

  const affectedTargets = Array.isArray(raw.affectedTargetsExplanation)
    ? raw.affectedTargetsExplanation.map(String)
    : context.highestRiskTargets.map((t) => `${t.targetKey}: Score ${t.score} (${t.level})`);

  const missingEvidence = Array.isArray(raw.missingEvidenceSummary) && raw.missingEvidenceSummary.length > 0
    ? raw.missingEvidenceSummary.map(String)
    : context.missingEvidence;

  return {
    summary: String(raw.summary || 'Risk explanation based on deterministic model scoring.').trim(),
    scoreRationale: String(raw.scoreRationale || `Deterministic engine assigned score ${context.riskScore} (${context.riskLevel}).`).trim(),
    contributingFactorsExplanation: contributingFactors,
    affectedTargetsExplanation: affectedTargets,
    confirmedExposureSummary: String(raw.confirmedExposureSummary || `${context.directImpacts.length} direct impacts confirmed.`).trim(),
    unresolvedExposureSummary: String(raw.unresolvedExposureSummary || `${context.transitiveImpacts.length} transitive impacts tracked.`).trim(),
    missingEvidenceSummary: missingEvidence,
    uncertaintyAssessment: String(raw.uncertaintyAssessment || 'Assessment grounded in static AST and dependency topology.').trim(),
    nonFailureProbabilityNotice: 'The deterministic risk score is a heuristic blast-radius and change complexity metric, NOT an empirical failure probability.',
    immutableRiskScore: context.riskScore,
    immutableRiskLevel: context.riskLevel,
    findings,
    truncated: context.truncated,
    model: modelName,
  };
}

export function validateReleaseNotes(
  raw: any,
  context: AnalysisEvidenceContext,
  modelName: string
): AiReleaseNotesResult {
  const features = Array.isArray(raw.features) ? raw.features.map(String) : [];
  const fixes = Array.isArray(raw.fixes) ? raw.fixes.map(String) : [];
  const refactoring = Array.isArray(raw.refactoring) ? raw.refactoring.map(String) : [];
  const internalChanges = Array.isArray(raw.internalChanges) ? raw.internalChanges.map(String) : [];

  const candidateBreaking = Array.isArray(raw.breakingChanges) ? raw.breakingChanges.map(String) : [];
  const candidateCompatibility = Array.isArray(raw.compatibilityConcerns) ? raw.compatibilityConcerns.map(String) : [];

  const confirmedBreaking: string[] = [];
  const compatibilityConcerns = [...candidateCompatibility];

  for (const item of candidateBreaking) {
    const hasEvidence = context.evidenceItems.length > 0 || context.riskFactors.some((f) => f.toLowerCase().includes('breaking') || f.toLowerCase().includes('export'));
    if (hasEvidence) {
      confirmedBreaking.push(item);
    } else {
      compatibilityConcerns.push(`Possible compatibility concern (unverified): ${item}`);
    }
  }

  let markdown = typeof raw.markdown === 'string' && raw.markdown.trim().length > 0
    ? raw.markdown
    : '';

  if (!markdown) {
    const lines: string[] = ['# Release Notes', ''];
    if (features.length > 0) {
      lines.push('## Features', ...features.map((f: string) => `- ${f}`), '');
    }
    if (fixes.length > 0) {
      lines.push('## Bug Fixes', ...fixes.map((f: string) => `- ${f}`), '');
    }
    if (confirmedBreaking.length > 0) {
      lines.push('## Breaking Changes', ...confirmedBreaking.map((b: string) => `- ${b}`), '');
    }
    if (compatibilityConcerns.length > 0) {
      lines.push('## Compatibility Considerations', ...compatibilityConcerns.map((c: string) => `- ${c}`), '');
    }
    if (refactoring.length > 0) {
      lines.push('## Refactoring', ...refactoring.map((r: string) => `- ${r}`), '');
    }
    markdown = lines.join('\n');
  }

  return {
    features,
    fixes,
    refactoring,
    internalChanges,
    breakingChanges: confirmedBreaking,
    compatibilityConcerns,
    markdown,
    model: modelName,
  };
}

export function validateQnA(
  raw: any,
  context: AnalysisEvidenceContext,
  question: string,
  modelName: string
): AiQnAResult {
  const validEvidenceIds = new Set(context.evidenceItems.map((e) => e.id));
  const validFiles = new Set([
    ...context.changedFiles.map((f) => f.path),
    ...context.evidenceItems.map((e) => e.file),
    ...context.changedSymbols.map((s) => s.file),
  ]);
  const validSymbols = new Set([
    ...context.changedSymbols.map((s) => s.name),
    ...context.changedSymbols.map((s) => s.symbolKey).filter(Boolean),
    ...context.highestRiskTargets.map((t) => t.targetKey),
  ]);

  const rawEvidence = Array.isArray(raw.evidenceReferences) ? raw.evidenceReferences : [];
  const rawFiles = Array.isArray(raw.fileReferences) ? raw.fileReferences : [];
  const rawSymbols = Array.isArray(raw.symbolReferences) ? raw.symbolReferences : [];

  const evidenceReferences = rawEvidence.filter((id: string) => validEvidenceIds.has(id));
  const fileReferences = rawFiles.filter((f: string) => {
    return Array.from(validFiles).some((vf) => vf === f || vf.endsWith('/' + f) || f.endsWith('/' + vf));
  });
  const symbolReferences = rawSymbols.filter((s: string) => {
    return Array.from(validSymbols).some((vs) => vs === s || (vs && vs.includes(s)));
  });

  const limitations = Array.isArray(raw.limitations) && raw.limitations.length > 0
    ? raw.limitations.map(String)
    : context.limitations;

  let sufficientEvidence = typeof raw.sufficientEvidence === 'boolean'
    ? raw.sufficientEvidence
    : (fileReferences.length > 0 || evidenceReferences.length > 0);

  if (fileReferences.length === 0 && evidenceReferences.length === 0) {
    sufficientEvidence = false;
  }

  let confidence = raw.confidence || (sufficientEvidence ? 'Medium' : 'Low');
  if (!sufficientEvidence) {
    confidence = 'Low';
  }

  return {
    question,
    answer: String(raw.answer || 'No conclusive evidence found to answer this question.').trim(),
    fileReferences,
    symbolReferences,
    evidenceReferences,
    confidence,
    sufficientEvidence,
    limitations,
    model: modelName,
  };
}
