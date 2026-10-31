export interface EvidenceBundleItem {
  id: string;
  type: string;
  file: string;
  lineStart?: number | null;
  lineEnd?: number | null;
  symbol?: string | null;
  sourceCommit: string;
}

export interface AnalysisEvidenceContext {
  analysisId: string;
  repositoryName: string;
  baseSha: string;
  headSha: string;
  changedFiles: Array<{ path: string; changeType: string }>;
  changedSymbols: Array<{ name: string; kind: string; file: string; isExported: boolean; symbolKey?: string }>;
  directImpacts: Array<{ source: string; target: string; relationship: string }>;
  transitiveImpacts: Array<{ target: string; depth: number; path: string }>;
  riskScore: number;
  riskLevel: string;
  riskFactors: string[];
  highestRiskTargets: Array<{ targetKey: string; score: number; level: string }>;
  missingEvidence: string[];
  limitations: string[];
  evidenceItems: EvidenceBundleItem[];
  diffSnippet?: string;
  truncated: boolean;
  rawPromptContext: string;
}

export function sanitizeUntrustedText(input: string): string {
  if (!input) return '';
  return input
    .replace(/<system>/gi, '[system_filtered]')
    .replace(/<\/system>/gi, '[/system_filtered]')
    .replace(/<instructions>/gi, '[instructions_filtered]')
    .replace(/<\/instructions>/gi, '[/instructions_filtered]')
    .replace(/ignore (all )?(previous|prior) instructions/gi, '[filtered_injection_attempt]')
    .replace(/disregard (all )?(previous|prior) instructions/gi, '[filtered_injection_attempt]')
    .replace(/you are now in (developer|dan|jailbreak) mode/gi, '[filtered_injection_attempt]');
}

export function buildAnalysisContext(options: {
  analysisId: string;
  repositoryName: string;
  baseSha: string;
  headSha: string;
  changedFiles: Array<{ path: string; changeType: string }>;
  symbols?: Array<{ name: string; kind: string; file: string; isExported?: boolean; symbolKey?: string }>;
  edges?: Array<{ from: string; to: string; kind: string }>;
  impactResults?: Array<{ targetKey: string; depth: number; path: string; classification: string }>;
  riskAssessment?: {
    score: number;
    level: string;
    factors: string;
    highestRiskTargets: string;
    missingEvidence: string;
    limitations: string;
  } | null;
  evidences?: Array<{
    id: string;
    type: string;
    file: string;
    lineStart?: number | null;
    lineEnd?: number | null;
    symbol?: string | null;
    sourceCommit: string;
  }>;
  diffText?: string;
  maxChars?: number;
}): AnalysisEvidenceContext {
  const {
    analysisId,
    repositoryName,
    baseSha,
    headSha,
    changedFiles,
    symbols = [],
    edges = [],
    impactResults = [],
    riskAssessment,
    evidences = [],
    diffText,
    maxChars = 16000,
  } = options;

  let truncated = false;
  let remainingChars = maxChars;

  const sortedFiles = [...changedFiles].sort((a, b) => a.path.localeCompare(b.path));
  const sortedSymbols = [...symbols].sort((a, b) => (a.symbolKey || a.name).localeCompare(b.symbolKey || b.name));

  const directImpacts = impactResults
    .filter((r) => r.classification === 'direct')
    .sort((a, b) => a.targetKey.localeCompare(b.targetKey))
    .slice(0, 30)
    .map((r) => ({ source: r.path.split(' -> ')[0] || '', target: r.targetKey, relationship: 'impact' }));

  const transitiveImpacts = impactResults
    .filter((r) => r.classification === 'transitive')
    .sort((a, b) => b.depth - a.depth || a.targetKey.localeCompare(b.targetKey))
    .slice(0, 30)
    .map((r) => ({ target: r.targetKey, depth: r.depth, path: r.path }));

  let factorsList: string[] = [];
  try {
    if (riskAssessment?.factors) {
      factorsList = JSON.parse(riskAssessment.factors);
    }
  } catch {
    factorsList = [];
  }

  let targetsList: Array<{ targetKey: string; score: number; level: string }> = [];
  try {
    if (riskAssessment?.highestRiskTargets) {
      targetsList = JSON.parse(riskAssessment.highestRiskTargets);
    }
  } catch {
    targetsList = [];
  }

  let missingEvidenceList: string[] = [];
  try {
    if (riskAssessment?.missingEvidence) {
      missingEvidenceList = JSON.parse(riskAssessment.missingEvidence);
    }
  } catch {
    missingEvidenceList = [];
  }

  let limitationsList: string[] = [];
  try {
    if (riskAssessment?.limitations) {
      limitationsList = JSON.parse(riskAssessment.limitations);
    }
  } catch {
    limitationsList = [];
  }

  const evidenceItems: EvidenceBundleItem[] = evidences
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 50)
    .map((e) => ({
      id: e.id,
      type: e.type,
      file: e.file,
      lineStart: e.lineStart,
      lineEnd: e.lineEnd,
      symbol: e.symbol,
      sourceCommit: e.sourceCommit,
    }));

  let diffSnippet = '';
  if (diffText) {
    const sanitized = sanitizeUntrustedText(diffText);
    if (sanitized.length > 4000) {
      diffSnippet = sanitized.slice(0, 4000) + '\n[... diff truncated for token limit ...]';
      truncated = true;
    } else {
      diffSnippet = sanitized;
    }
  }

  const sections: string[] = [];

  sections.push(`ANALYSIS CONTEXT:
Repository: ${repositoryName}
Base SHA: ${baseSha}
Head SHA: ${headSha}
Deterministic Risk: ${riskAssessment ? `${riskAssessment.score}/100 (${riskAssessment.level.toUpperCase()})` : 'UNASSESSED'}`);

  sections.push(`CHANGED FILES (${sortedFiles.length}):
${sortedFiles.map((f) => `- [${f.changeType.toUpperCase()}] ${f.path}`).join('\n')}`);

  if (sortedSymbols.length > 0) {
    sections.push(`CHANGED SYMBOLS (${sortedSymbols.length}):
${sortedSymbols.slice(0, 40).map((s) => `- ${s.name} (${s.kind}) in ${s.file}${s.isExported ? ' [EXPORTED]' : ''}`).join('\n')}`);
    if (sortedSymbols.length > 40) {
      truncated = true;
    }
  }

  if (directImpacts.length > 0 || transitiveImpacts.length > 0) {
    sections.push(`DEPENDENCY IMPACT BLAST RADIUS:
Direct impacts (${directImpacts.length}):
${directImpacts.slice(0, 15).map((d) => `  - ${d.source} -> ${d.target}`).join('\n')}
Transitive impacts (${transitiveImpacts.length}):
${transitiveImpacts.slice(0, 15).map((t) => `  - ${t.target} (depth ${t.depth}) via ${t.path}`).join('\n')}`);
  }

  if (factorsList.length > 0 || targetsList.length > 0) {
    sections.push(`DETERMINISTIC RISK FACTORS & TARGETS:
Factors: ${factorsList.join('; ') || 'None'}
Highest Risk Targets:
${targetsList.slice(0, 10).map((t) => `  - ${t.targetKey}: Score ${t.score} (${t.level})`).join('\n')}`);
  }

  if (evidenceItems.length > 0) {
    sections.push(`VERIFIED PERSISTED EVIDENCE IDS:
${evidenceItems.map((e) => `- ID: ${e.id} [${e.type}] file: ${e.file}${e.lineStart ? `:${e.lineStart}` : ''}${e.symbol ? ` (${e.symbol})` : ''}`).join('\n')}`);
  }

  if (missingEvidenceList.length > 0 || limitationsList.length > 0) {
    sections.push(`LIMITATIONS & MISSING EVIDENCE:
Missing evidence: ${missingEvidenceList.join('; ') || 'None'}
Limitations: ${limitationsList.join('; ') || 'None'}`);
  }

  if (diffSnippet) {
    sections.push(`DIFF CONTENT (UNTRUSTED REPOSITORY DATA):
<untrusted_repository_content>
${diffSnippet}
</untrusted_repository_content>`);
  }

  let rawPromptContext = sections.join('\n\n');
  if (rawPromptContext.length > remainingChars) {
    rawPromptContext = rawPromptContext.slice(0, remainingChars) + '\n\n[CONTEXT TRUNCATED DUE TO SIZE LIMIT]';
    truncated = true;
  }

  return {
    analysisId,
    repositoryName,
    baseSha,
    headSha,
    changedFiles: sortedFiles,
    changedSymbols: sortedSymbols.map((s) => ({
      name: s.name,
      kind: s.kind,
      file: s.file,
      isExported: s.isExported ?? false,
      symbolKey: s.symbolKey,
    })),
    directImpacts,
    transitiveImpacts,
    riskScore: riskAssessment?.score ?? 0,
    riskLevel: riskAssessment?.level ?? 'unknown',
    riskFactors: factorsList,
    highestRiskTargets: targetsList,
    missingEvidence: missingEvidenceList,
    limitations: limitationsList,
    evidenceItems,
    diffSnippet,
    truncated,
    rawPromptContext,
  };
}

