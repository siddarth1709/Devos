import { RiskAssessmentReport } from '../risk/types.js';

export interface ReleaseNoteItem {
  category: 'feature' | 'bugfix' | 'refactor' | 'breaking' | 'performance' | 'chore' | 'other';
  title: string;
  description: string;
  affectedFiles: string[];
  impactedComponents: string[];
  riskLevel: string;
}

export interface ReleaseNotesReport {
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  version?: string;
  generatedAt: string;
  markdown: string;
  structured: {
    summary: string;
    breakingChanges: ReleaseNoteItem[];
    features: ReleaseNoteItem[];
    bugfixes: ReleaseNoteItem[];
    refactors: ReleaseNoteItem[];
    other: ReleaseNoteItem[];
    blastRadius: {
      totalChangedFiles: number;
      totalImpactedFiles: number;
      confirmedExposure: number;
      potentialExposure: number;
      overallRiskScore: number;
      overallRiskLevel: string;
    };
    suggestedTestingAreas: string[];
  };
}

export interface ReleaseNotesInput {
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  version?: string;
  commitMessage?: string;
  changedFiles: Array<{
    path: string;
    changeType: string;
    oldPath?: string | null;
  }>;
  changedSymbols?: Array<{
    name: string;
    kind: string;
    file: string;
    isExported?: boolean;
  }>;
  riskAssessment?: RiskAssessmentReport | null;
}

export function generateReleaseNotesReport(input: ReleaseNotesInput): ReleaseNotesReport {
  const breakingChanges: ReleaseNoteItem[] = [];
  const features: ReleaseNoteItem[] = [];
  const bugfixes: ReleaseNoteItem[] = [];
  const refactors: ReleaseNoteItem[] = [];
  const other: ReleaseNoteItem[] = [];

  const rawMsg = input.commitMessage?.trim() ?? '';
  const isBreakingCommit = rawMsg.includes('BREAKING CHANGE') || /^[a-z]+(\([a-z0-9_-]+\))?!:/.test(rawMsg);

  const targets = input.riskAssessment?.highestRiskTargets ?? [];
  const overallRiskScore = input.riskAssessment?.score ?? 0;
  const overallRiskLevel = (input.riskAssessment?.level ?? 'low').toUpperCase();
  const confirmedExposure = input.riskAssessment?.confirmedExposure
    ? input.riskAssessment.confirmedExposure.directDependentsCount + input.riskAssessment.confirmedExposure.transitiveDependentsCount
    : 0;
  const potentialExposure = input.riskAssessment?.potentialExposure
    ? input.riskAssessment.potentialExposure.unresolvedCount + input.riskAssessment.potentialExposure.ambiguousCount
    : 0;

  const impactedFilesSet = new Set<string>();
  for (const t of targets) {
    impactedFilesSet.add(t.targetKey.split('::')[0]);
  }

  const fileGroups = new Map<string, typeof input.changedFiles>();
  for (const f of input.changedFiles) {
    const dir = f.path.split('/')[0] || 'root';
    const list = fileGroups.get(dir) ?? [];
    list.push(f);
    fileGroups.set(dir, list);
  }

  let determinedCategory: 'feature' | 'bugfix' | 'refactor' | 'breaking' | 'performance' | 'chore' | 'other' = 'other';
  if (isBreakingCommit) {
    determinedCategory = 'breaking';
  } else if (/^feat(\([a-z0-9_-]+\))?:/i.test(rawMsg)) {
    determinedCategory = 'feature';
  } else if (/^fix(\([a-z0-9_-]+\))?:/i.test(rawMsg)) {
    determinedCategory = 'bugfix';
  } else if (/^refactor(\([a-z0-9_-]+\))?:/i.test(rawMsg)) {
    determinedCategory = 'refactor';
  } else if (/^perf(\([a-z0-9_-]+\))?:/i.test(rawMsg)) {
    determinedCategory = 'performance';
  } else if (/^(chore|test|docs|build|ci)(\([a-z0-9_-]+\))?:/i.test(rawMsg)) {
    determinedCategory = 'chore';
  } else {
    const hasAdditions = input.changedFiles.some((f) => f.changeType === 'added');
    const hasDeletions = input.changedFiles.some((f) => f.changeType === 'deleted');
    const allTests = input.changedFiles.length > 0 && input.changedFiles.every((f) => f.path.includes('.test.') || f.path.includes('.spec.'));

    if (allTests) {
      determinedCategory = 'chore';
    } else if (hasAdditions && !hasDeletions) {
      determinedCategory = 'feature';
    } else if (hasDeletions) {
      determinedCategory = 'refactor';
    } else {
      determinedCategory = 'other';
    }
  }

  const primaryTitle = rawMsg ? rawMsg.split('\n')[0] : `Changes in ${input.changedFiles.length} file(s)`;
  const primaryItem: ReleaseNoteItem = {
    category: determinedCategory,
    title: primaryTitle,
    description: `Applied ${input.changedFiles.length} file modifications across repository components.`,
    affectedFiles: input.changedFiles.map((f) => f.path),
    impactedComponents: targets.slice(0, 5).map((t) => t.targetKey),
    riskLevel: overallRiskLevel,
  };

  if (determinedCategory === 'breaking') {
    breakingChanges.push(primaryItem);
  } else if (determinedCategory === 'feature') {
    features.push(primaryItem);
  } else if (determinedCategory === 'bugfix') {
    bugfixes.push(primaryItem);
  } else if (determinedCategory === 'refactor' || determinedCategory === 'performance') {
    refactors.push(primaryItem);
  } else {
    other.push(primaryItem);
  }

  const deletedFiles = input.changedFiles.filter((f) => f.changeType === 'deleted');
  if (deletedFiles.length > 0 && determinedCategory !== 'breaking') {
    breakingChanges.push({
      category: 'breaking',
      title: `Removal of ${deletedFiles.length} file(s)`,
      description: `Files removed: ${deletedFiles.map((f) => f.path).join(', ')}. Downstream imports may break.`,
      affectedFiles: deletedFiles.map((f) => f.path),
      impactedComponents: targets.filter((t) => deletedFiles.some((df) => t.targetKey.startsWith(df.path))).map((t) => t.targetKey),
      riskLevel: 'HIGH',
    });
  }

  const suggestedTestingAreas: string[] = [];
  for (const t of targets) {
    if (t.score >= 40) {
      suggestedTestingAreas.push(`${t.targetKey} (${t.level.toUpperCase()} Risk - score: ${t.score})`);
    }
  }
  for (const f of input.changedFiles) {
    if (!suggestedTestingAreas.some((a) => a.startsWith(f.path))) {
      suggestedTestingAreas.push(f.path);
    }
  }

  const summary = `Release includes ${input.changedFiles.length} changed file(s) with ${confirmedExposure} confirmed impacted component(s). Overall risk: ${overallRiskLevel} (score: ${overallRiskScore}).`;

  const mdSections: string[] = [];
  mdSections.push(`# Release Notes - ${input.version ?? input.commitSha.substring(0, 8)}`);
  mdSections.push(`\n## Summary\n${summary}\n`);

  if (breakingChanges.length > 0) {
    mdSections.push(`## Breaking Changes`);
    for (const item of breakingChanges) {
      mdSections.push(`- **${item.title}**: ${item.description}`);
    }
    mdSections.push('');
  }

  if (features.length > 0) {
    mdSections.push(`## Features`);
    for (const item of features) {
      mdSections.push(`- **${item.title}**: ${item.description}`);
    }
    mdSections.push('');
  }

  if (bugfixes.length > 0) {
    mdSections.push(`## Bug Fixes`);
    for (const item of bugfixes) {
      mdSections.push(`- **${item.title}**: ${item.description}`);
    }
    mdSections.push('');
  }

  if (refactors.length > 0) {
    mdSections.push(`## Refactoring & Improvements`);
    for (const item of refactors) {
      mdSections.push(`- **${item.title}**: ${item.description}`);
    }
    mdSections.push('');
  }

  if (other.length > 0) {
    mdSections.push(`## Other Changes`);
    for (const item of other) {
      mdSections.push(`- **${item.title}**: ${item.description}`);
    }
    mdSections.push('');
  }

  mdSections.push(`## Blast Radius & Risk Assessment`);
  mdSections.push(`- **Changed Files**: ${input.changedFiles.length}`);
  mdSections.push(`- **Impacted Files**: ${impactedFilesSet.size}`);
  mdSections.push(`- **Confirmed Impact Exposure**: ${confirmedExposure}`);
  mdSections.push(`- **Potential Exposure (Uncertain/Unresolved)**: ${potentialExposure}`);
  mdSections.push(`- **Overall Risk Score**: ${overallRiskScore} (${overallRiskLevel})`);
  mdSections.push('');

  if (suggestedTestingAreas.length > 0) {
    mdSections.push(`## Recommended Testing Areas`);
    for (const area of suggestedTestingAreas.slice(0, 10)) {
      mdSections.push(`- ${area}`);
    }
    mdSections.push('');
  }

  return {
    analysisId: input.analysisId,
    repositoryId: input.repositoryId,
    commitSha: input.commitSha,
    version: input.version,
    generatedAt: new Date().toISOString(),
    markdown: mdSections.join('\n').trim() + '\n',
    structured: {
      summary,
      breakingChanges,
      features,
      bugfixes,
      refactors,
      other,
      blastRadius: {
        totalChangedFiles: input.changedFiles.length,
        totalImpactedFiles: impactedFilesSet.size,
        confirmedExposure,
        potentialExposure,
        overallRiskScore,
        overallRiskLevel,
      },
      suggestedTestingAreas: suggestedTestingAreas.slice(0, 10),
    },
  };
}
