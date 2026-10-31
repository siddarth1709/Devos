import {
  ConfirmedExposureMetrics,
  ContributingSourceEvidence,
  PotentialExposureMetrics,
  RiskAssessmentReport,
  RiskFactor,
  RiskLevel,
  RiskScoringInput,
  RiskTargetComponent,
} from './types.js';

export const RISK_MODEL_VERSION = 'v1.1.0-deterministic';

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 25) return 'low';
  if (score <= 50) return 'medium';
  if (score <= 75) return 'high';
  return 'critical';
}

export function calculateDeterministicRisk(input: RiskScoringInput): RiskAssessmentReport {
  const {
    analysisId,
    repositoryId,
    commitSha,
    changedFiles,
    changedSymbols,
    impactResults,
    investigations,
    hasDiffHunks,
    isVerifiedEmptyDiff = true,
    gitDiffStatus = 'complete',
    validEdgeKeys,
    extraLimitations,
  } = input;

  const totalFiles = changedFiles.length;
  const totalSymbols = changedSymbols.length;

  let deletions = 0;
  let renames = 0;
  let modifications = 0;
  let additions = 0;

  for (const f of changedFiles) {
    if (f.changeType === 'deleted') deletions++;
    else if (f.changeType === 'renamed') renames++;
    else if (f.changeType === 'added') additions++;
    else modifications++;
  }

  const rawMag =
    totalFiles * 5 +
    totalSymbols * 8 +
    deletions * 10 +
    renames * 7 +
    modifications * 4 +
    additions * 2;
  const magnitudeScore = totalFiles === 0 ? 0 : Math.min(100, rawMag);

  let confirmedDirectCount = 0;
  let confirmedTransitiveCount = 0;
  let maxConfirmedDepth = 0;
  const confirmedImpactedFiles = new Set<string>();
  const confirmedImpactedSymbols = new Set<string>();

  let unresolvedCount = 0;
  let ambiguousCount = 0;
  const unresolvedTargetKeys: string[] = [];
  const ambiguousTargetKeys: string[] = [];

  const limitations: string[] = [];
  const missingEvidence: string[] = [];

  if (extraLimitations && extraLimitations.length > 0) {
    for (const lim of extraLimitations) {
      if (!limitations.includes(lim)) {
        limitations.push(lim);
      }
    }
  }

  for (const imp of impactResults) {
    const isDirectOrTransitive =
      imp.classification === 'direct' ||
      imp.classification === 'transitive' ||
      imp.depth > 0;

    const invalidEdges: string[] = [];
    if (validEdgeKeys !== undefined && isDirectOrTransitive) {
      if (imp.edgeKeys.length === 0) {
        invalidEdges.push(`(missing edge keys for depth ${imp.depth})`);
      } else {
        for (const ek of imp.edgeKeys) {
          if (!validEdgeKeys.has(ek)) {
            invalidEdges.push(ek);
          }
        }
      }
    }

    const hasInvalidEdges = invalidEdges.length > 0;

    const isResolved =
      !hasInvalidEdges &&
      !imp.provenanceError &&
      imp.resolutionStatus === 'resolved' &&
      imp.classification !== 'unresolved' &&
      imp.classification !== 'ambiguous';

    if (isResolved) {
      if (imp.depth > maxConfirmedDepth) maxConfirmedDepth = imp.depth;
      if (imp.classification === 'direct') confirmedDirectCount++;
      else if (imp.classification === 'transitive') confirmedTransitiveCount++;

      if (imp.targetFile) confirmedImpactedFiles.add(imp.targetFile);
      if (imp.targetSymbol) confirmedImpactedSymbols.add(imp.targetSymbol);
    } else {
      if (imp.classification === 'ambiguous' || imp.resolutionStatus === 'ambiguous') {
        ambiguousCount++;
        ambiguousTargetKeys.push(imp.targetKey);
      } else {
        unresolvedCount++;
        unresolvedTargetKeys.push(imp.targetKey);
      }
      if (imp.provenanceError && !limitations.includes(imp.provenanceError)) {
        limitations.push(imp.provenanceError);
      }
      if (hasInvalidEdges) {
        for (const ek of invalidEdges) {
          const limMsg = `Impact target "${imp.targetKey}" relies on unverified graph edge key "${ek}"; cannot confirm impact.`;
          if (!limitations.includes(limMsg)) {
            limitations.push(limMsg);
          }
        }
      }
    }
  }

  const rawConfirmedExposure =
    confirmedDirectCount * 15 +
    confirmedTransitiveCount * 8 +
    maxConfirmedDepth * 6 +
    confirmedImpactedFiles.size * 5;
  const exposureScore = totalFiles === 0 ? 0 : Math.min(100, rawConfirmedExposure);

  const confirmedExposure: ConfirmedExposureMetrics = {
    directDependentsCount: confirmedDirectCount,
    transitiveDependentsCount: confirmedTransitiveCount,
    maxDepthReached: maxConfirmedDepth,
    distinctImpactedFiles: confirmedImpactedFiles.size,
    distinctImpactedSymbols: confirmedImpactedSymbols.size,
  };

  const potentialExposure: PotentialExposureMetrics = {
    unresolvedCount,
    ambiguousCount,
    unresolvedTargetKeys: Array.from(new Set(unresolvedTargetKeys)),
    ambiguousTargetKeys: Array.from(new Set(ambiguousTargetKeys)),
  };

  let exportedSymbolsCount = 0;
  let reExportSymbolsCount = 0;

  for (const sym of changedSymbols) {
    if (sym.isExported) exportedSymbolsCount++;
    if (sym.isReExport) reExportSymbolsCount++;
  }

  const barrelFiles = new Set<string>();
  for (const f of changedFiles) {
    const base = f.path.split('/').pop() ?? '';
    if (base.startsWith('index.') || base.startsWith('public.') || base.startsWith('main.')) {
      barrelFiles.add(f.path);
    }
  }

  const rawStruct =
    exportedSymbolsCount * 20 +
    reExportSymbolsCount * 25 +
    barrelFiles.size * 15;
  const structuralScore = totalFiles === 0 ? 0 : Math.min(100, rawStruct);

  let confidencePenalties = 0;

  missingEvidence.push('Runtime execution telemetry and production traffic data are not available in this analysis.');
  missingEvidence.push('Test coverage and dynamic test execution results are not available in this analysis.');
  missingEvidence.push('Business criticality and operational service tier metrics are not available in this analysis.');

  const hasAstComplete = investigations.some((inv) => inv.stage === 'ast_extraction_complete');
  const hasAstPartial = investigations.some((inv) => inv.stage === 'ast_extraction_partial');
  const hasAstFailed = investigations.some((inv) => inv.stage === 'ast_extraction_failed');

  const hasGraphComplete = investigations.some((inv) => inv.stage === 'dependency_graph_complete');
  const hasGraphPartial = investigations.some((inv) => inv.stage === 'dependency_graph_partial');
  const hasGraphFailed = investigations.some((inv) => inv.stage === 'dependency_graph_failed');

  const hasImpactComplete = investigations.some((inv) => inv.stage === 'impact_analysis_complete');
  const hasImpactPartial = investigations.some((inv) => inv.stage === 'impact_analysis_partial');
  const hasImpactFailed = investigations.some((inv) => inv.stage === 'impact_analysis_failed');

  if (hasAstFailed) {
    confidencePenalties += 50;
    limitations.push('AST extraction failed; symbol tables could not be extracted.');
    missingEvidence.push('AST symbol tables could not be extracted.');
  } else if (hasAstPartial) {
    confidencePenalties += 20;
    limitations.push('AST extraction completed with partial file coverage.');
    missingEvidence.push('AST extraction skipped or failed on one or more files.');
  } else if (!hasAstComplete && totalFiles > 0) {
    confidencePenalties += 30;
    limitations.push('AST extraction records are missing; AST coverage cannot be confirmed.');
    missingEvidence.push('AST extraction was not performed or recorded for this analysis.');
  }

  if (hasGraphFailed) {
    confidencePenalties += 50;
    limitations.push('Dependency graph construction failed; graph dependency relationships are missing.');
    missingEvidence.push('Dependency graph edges and nodes could not be constructed.');
  } else if (hasGraphPartial) {
    confidencePenalties += 25;
    limitations.push('Dependency graph completed with unresolved references or partial links.');
    missingEvidence.push('Certain module imports could not be resolved to dependency graph nodes.');
  } else if (!hasGraphComplete && totalFiles > 0) {
    confidencePenalties += 40;
    limitations.push('Dependency graph records are missing; repository dependency links cannot be verified.');
    missingEvidence.push('Dependency graph was not constructed or recorded for this analysis.');
  }

  if (hasImpactFailed) {
    confidencePenalties += 50;
    limitations.push('Impact analysis failed; impact traversal could not be completed.');
    missingEvidence.push('Impact analysis traversal could not be completed.');
  } else if (hasImpactPartial) {
    confidencePenalties += 25;
    limitations.push('Change impact analysis completed with partial resolution.');
  }

  if (totalFiles === 0) {
    if (!isVerifiedEmptyDiff) {
      confidencePenalties += 60;
      limitations.push('Unverified empty diff: Git ingestion record is missing or incomplete; zero changes cannot be confirmed.');
      missingEvidence.push('Git commit diff records were not verified.');
    }
  } else {
    if (gitDiffStatus === 'failed') {
      confidencePenalties += 35;
      limitations.push('Git diff statistics extraction failed; detailed hunks were unavailable.');
      missingEvidence.push('Detailed line diff statistics were unavailable for this commit.');
    } else if (gitDiffStatus === 'unavailable') {
      confidencePenalties += 15;
      limitations.push('Git diff statistics were unavailable for this commit; line-level precision could not be established.');
      missingEvidence.push('Detailed line diff statistics were unavailable for this commit.');
    } else if (gitDiffStatus === 'partial') {
      confidencePenalties += 15;
      limitations.push('Git diff statistics were only partially available.');
      missingEvidence.push('Certain file diff hunks were unavailable for this commit.');
    } else if (!hasDiffHunks) {
      confidencePenalties += 15;
      missingEvidence.push('Detailed line diff statistics were unavailable for this commit.');
    }
  }

  if (unresolvedCount > 0) {
    const unresPenalty = Math.min(40, unresolvedCount * 10);
    confidencePenalties += unresPenalty;
    limitations.push(`Analysis contains ${unresolvedCount} unresolved dependencies recorded as potential exposure; confirmed exposure excludes them.`);
  }

  if (ambiguousCount > 0) {
    const ambigPenalty = Math.min(45, ambiguousCount * 15);
    confidencePenalties += ambigPenalty;
    limitations.push(`Analysis contains ${ambiguousCount} ambiguous dependencies with multiple candidates recorded as potential exposure.`);
  }

  const confidence =
    totalFiles === 0 && isVerifiedEmptyDiff
      ? 100
      : Math.max(10, 100 - confidencePenalties);
  const evidenceCompleteness = confidence;

  const uncertaintyScore = Math.min(
    100,
    unresolvedCount * 15 + ambiguousCount * 20 + (100 - confidence)
  );

  const uncertaintyAdjustment =
    totalFiles === 0
      ? 0
      : Math.min(50, unresolvedCount * 24 + ambiguousCount * 20);

  const baseSeverity =
    totalFiles === 0
      ? 0
      : Math.min(
          100,
          Math.round(0.3 * magnitudeScore + 0.4 * exposureScore + 0.3 * structuralScore)
        );
  const severity = Math.min(100, baseSeverity + uncertaintyAdjustment);

  const rawLikelihood =
    totalFiles === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            0.3 * structuralScore +
              0.45 * Math.min(100, confirmedDirectCount * 25) +
              0.25 * Math.min(100, deletions * 25 + modifications * 10)
          )
        );
  const likelihood = rawLikelihood;

  let overallScore = 0;
  if (totalFiles > 0) {
    const calculatedBase = Math.round(0.55 * severity + 0.45 * likelihood);
    overallScore = Math.max(1, Math.min(100, calculatedBase));
  }
  const level = getRiskLevel(overallScore);

  if (
    totalFiles > 0 &&
    overallScore <= 25 &&
    (confidence < 70 ||
      missingEvidence.length > 3 ||
      hasAstFailed ||
      hasGraphFailed ||
      !hasAstComplete ||
      !hasGraphComplete)
  ) {
    limitations.push(
      'Low observed risk cannot guarantee safety due to incomplete evidence, missing upstream stages, or unresolved dependencies.'
    );
  }

  const factors: RiskFactor[] = [
    {
      dimension: 'change_magnitude',
      name: 'Change Magnitude',
      contribution: magnitudeScore,
      description: `${totalFiles} changed files, ${totalSymbols} changed symbols (${modifications} modified, ${deletions} deleted, ${additions} added, ${renames} renamed)`,
      evidence: changedFiles.map((f) => `${f.changeType}: ${f.path}`),
    },
    {
      dimension: 'dependency_exposure',
      name: 'Confirmed Dependency Exposure',
      contribution: exposureScore,
      description: `${confirmedDirectCount} confirmed direct dependents, ${confirmedTransitiveCount} confirmed transitive dependents across ${confirmedImpactedFiles.size} distinct files (max depth ${maxConfirmedDepth})`,
      evidence: Array.from(confirmedImpactedFiles).slice(0, 10),
    },
    {
      dimension: 'structural_importance',
      name: 'Structural Importance',
      contribution: structuralScore,
      description: `${exportedSymbolsCount} exported symbols changed, ${reExportSymbolsCount} re-exports changed, ${barrelFiles.size} barrel files modified`,
      evidence: changedSymbols.filter((s) => s.isExported).map((s) => `${s.file}#${s.name}`),
    },
    {
      dimension: 'uncertainty',
      name: 'Evidence Quality and Potential Exposure',
      contribution: uncertaintyScore,
      description: `Confidence ${confidence}/100. ${unresolvedCount} unresolved and ${ambiguousCount} ambiguous dependencies recorded as potential exposure (uncertainty adjustment +${uncertaintyAdjustment})`,
      evidence: limitations,
    },
  ];

  const targetMap = new Map<
    string,
    {
      targetKey: string;
      targetType: 'file' | 'symbol' | 'module';
      targetFile: string | null;
      targetSymbol: string | null;
      directDependents: number;
      transitiveDependents: number;
      maxDepth: number;
      impactPaths: string[][];
      edgeKeys: string[];
      isExported: boolean;
      isReExport: boolean;
      unresolvedCount: number;
      ambiguousCount: number;
      changeType?: string;
      sourceChangeKey?: string;
      sourceChangeFile?: string;
      contributingSources: ContributingSourceEvidence[];
    }
  >();

  for (const f of changedFiles) {
    const key = `file:${f.path}`;
    targetMap.set(key, {
      targetKey: key,
      targetType: 'file',
      targetFile: f.path,
      targetSymbol: null,
      directDependents: 0,
      transitiveDependents: 0,
      maxDepth: 0,
      impactPaths: [],
      edgeKeys: [],
      isExported: barrelFiles.has(f.path),
      isReExport: false,
      unresolvedCount: 0,
      ambiguousCount: 0,
      changeType: f.changeType,
      sourceChangeKey: key,
      sourceChangeFile: f.path,
      contributingSources: [
        {
          sourceChangeKey: key,
          sourceChangeFile: f.path,
          impactPaths: [[key]],
          edgeKeys: [],
        },
      ],
    });
  }

  for (const s of changedSymbols) {
    const key = s.symbolKey;
    targetMap.set(key, {
      targetKey: key,
      targetType: 'symbol',
      targetFile: s.file,
      targetSymbol: s.name,
      directDependents: 0,
      transitiveDependents: 0,
      maxDepth: 0,
      impactPaths: [],
      edgeKeys: [],
      isExported: Boolean(s.isExported),
      isReExport: Boolean(s.isReExport),
      unresolvedCount: 0,
      ambiguousCount: 0,
      changeType: s.changeType ?? 'modified',
      sourceChangeKey: key,
      sourceChangeFile: s.file,
      contributingSources: [
        {
          sourceChangeKey: key,
          sourceChangeFile: s.file,
          impactPaths: [[key]],
          edgeKeys: [],
        },
      ],
    });
  }

  for (const imp of impactResults) {
    let entry = targetMap.get(imp.targetKey);
    if (!entry) {
      entry = {
        targetKey: imp.targetKey,
        targetType: (imp.targetType as any) ?? 'file',
        targetFile: imp.targetFile,
        targetSymbol: imp.targetSymbol,
        directDependents: 0,
        transitiveDependents: 0,
        maxDepth: 0,
        impactPaths: [],
        edgeKeys: [],
        isExported: false,
        isReExport: false,
        unresolvedCount: 0,
        ambiguousCount: 0,
        sourceChangeKey: imp.sourceChangeKey,
        sourceChangeFile: imp.sourceChangeFile,
        contributingSources: [],
      };
      targetMap.set(imp.targetKey, entry);
    }

    const isDirectOrTransitive =
      imp.classification === 'direct' ||
      imp.classification === 'transitive' ||
      imp.depth > 0;

    const invalidEdges: string[] = [];
    if (validEdgeKeys !== undefined && isDirectOrTransitive) {
      if (imp.edgeKeys.length === 0) {
        invalidEdges.push(`(missing edge keys for depth ${imp.depth})`);
      } else {
        for (const ek of imp.edgeKeys) {
          if (!validEdgeKeys.has(ek)) {
            invalidEdges.push(ek);
          }
        }
      }
    }

    const hasInvalidEdges = invalidEdges.length > 0;

    const isResolved =
      !hasInvalidEdges &&
      !imp.provenanceError &&
      imp.resolutionStatus === 'resolved' &&
      imp.classification !== 'unresolved' &&
      imp.classification !== 'ambiguous';

    if (isResolved) {
      if (imp.depth > entry.maxDepth) entry.maxDepth = imp.depth;
      if (imp.classification === 'direct') entry.directDependents++;
      else if (imp.classification === 'transitive') entry.transitiveDependents++;
    } else {
      if (imp.classification === 'ambiguous' || imp.resolutionStatus === 'ambiguous') {
        entry.ambiguousCount++;
      } else {
        entry.unresolvedCount++;
      }
    }

    if (imp.path && imp.path.length > 0) entry.impactPaths.push(imp.path);
    if (imp.edgeKeys && imp.edgeKeys.length > 0) entry.edgeKeys.push(...imp.edgeKeys);

    if (imp.sourceChangeKey) {
      const existing = entry.contributingSources.find(
        (cs) => cs.sourceChangeKey === imp.sourceChangeKey
      );
      if (existing) {
        if (imp.path && imp.path.length > 0) existing.impactPaths.push(imp.path);
        if (imp.edgeKeys && imp.edgeKeys.length > 0) existing.edgeKeys.push(...imp.edgeKeys);
      } else {
        entry.contributingSources.push({
          sourceChangeKey: imp.sourceChangeKey,
          sourceChangeFile: imp.sourceChangeFile,
          impactPaths: imp.path && imp.path.length > 0 ? [imp.path] : [],
          edgeKeys: imp.edgeKeys ? [...imp.edgeKeys] : [],
        });
      }
    }
  }

  if (validEdgeKeys !== undefined) {
    for (const [key, t] of targetMap.entries()) {
      for (const ek of t.edgeKeys) {
        if (!validEdgeKeys.has(ek)) {
          const limMsg = `Unknown dependency graph edge key "${ek}" not found in persisted graph records.`;
          if (!limitations.includes(limMsg)) {
            limitations.push(limMsg);
          }
        }
      }
    }
  }

  const highestRiskTargets: RiskTargetComponent[] = [];

  for (const [key, t] of targetMap.entries()) {
    const isDirectlyChanged = Boolean(t.changeType);
    const hasConfirmedImpact = t.directDependents > 0 || t.transitiveDependents > 0;
    const isConfirmed = isDirectlyChanged || hasConfirmedImpact;

    const reasons: string[] = [];
    let compSeverity = isConfirmed ? 10 : 5;
    let compLikelihood = isConfirmed ? 10 : 0;

    if (t.changeType) {
      reasons.push(`Directly changed component (${t.changeType})`);
      compSeverity += 15;
      compLikelihood += 20;
    }

    if (t.isExported) {
      reasons.push('Exported public API or barrel interface');
      compSeverity += 25;
      compLikelihood += 25;
    }

    if (t.isReExport) {
      reasons.push('Re-exported module forwarding');
      compSeverity += 20;
      compLikelihood += 20;
    }

    if (t.directDependents > 0) {
      reasons.push(`Confirmed direct dependency of ${t.directDependents} downstream components`);
      compSeverity += Math.min(35, t.directDependents * 15);
      compLikelihood += Math.min(35, t.directDependents * 15);
    }

    if (t.transitiveDependents > 0) {
      reasons.push(`Confirmed transitive impact across ${t.transitiveDependents} components (depth ${t.maxDepth})`);
      compSeverity += Math.min(25, t.transitiveDependents * 8);
    }

    if (t.unresolvedCount > 0) {
      reasons.push(`Potential exposure: ${t.unresolvedCount} unresolved downstream dependencies`);
    }

    if (t.ambiguousCount > 0) {
      reasons.push(`Potential exposure: ${t.ambiguousCount} ambiguous dependencies`);
    }

    const compConfPenalties =
      (t.unresolvedCount > 0 ? t.unresolvedCount * 15 : 0) +
      (t.ambiguousCount > 0 ? t.ambiguousCount * 20 : 0) +
      (confidence < 100 ? (100 - confidence) / 2 : 0);

    const compConfidence = Math.max(10, Math.round(100 - compConfPenalties));
    const finalSeverity = Math.min(100, compSeverity);
    const finalLikelihood = Math.min(100, compLikelihood);
    const compScore = Math.min(100, Math.round(0.55 * finalSeverity + 0.45 * finalLikelihood));
    const compLevel = getRiskLevel(compScore);

    const targetLim: string[] = [];
    if (t.unresolvedCount > 0) targetLim.push(`Unresolved dependency path from ${t.sourceChangeFile ?? 'unknown'}`);
    if (t.ambiguousCount > 0) targetLim.push(`Ambiguous candidate resolution on ${t.ambiguousCount} references`);

    if (validEdgeKeys !== undefined) {
      for (const ek of t.edgeKeys) {
        if (!validEdgeKeys.has(ek)) {
          const limMsg = `Graph edge key "${ek}" not found in persisted graph records for this analysis, repository, and commit`;
          if (!targetLim.includes(limMsg)) {
            targetLim.push(limMsg);
          }
        }
      }
    }

    const classification = t.changeType
      ? 'changed'
      : t.directDependents > 0
      ? 'direct'
      : t.transitiveDependents > 0
      ? 'transitive'
      : t.unresolvedCount > 0
      ? 'unresolved'
      : 'ambiguous';

    highestRiskTargets.push({
      targetKey: key,
      targetType: t.targetType,
      targetFile: t.targetFile,
      targetSymbol: t.targetSymbol,
      score: compScore,
      level: compLevel,
      severity: finalSeverity,
      likelihood: finalLikelihood,
      confidence: compConfidence,
      isConfirmed,
      reasons,
      evidence: {
        impactPaths: t.impactPaths.slice(0, 5),
        edgeKeys: Array.from(new Set(t.edgeKeys)).slice(0, 10),
        classification,
        depth: t.maxDepth,
        sourceChangeKey: t.sourceChangeKey,
        sourceChangeFile: t.sourceChangeFile,
        contributingSources: t.contributingSources,
        scoringSignals: {
          magnitudeSignal: t.changeType ? 25 : 0,
          exposureSignal: t.directDependents * 15 + t.transitiveDependents * 8,
          structuralSignal: t.isExported ? 25 : 0,
          uncertaintySignal: t.unresolvedCount * 10 + t.ambiguousCount * 15,
        },
      },
      unresolvedLimitations: targetLim,
    });
  }

  highestRiskTargets.sort((a, b) => b.score - a.score || a.targetKey.localeCompare(b.targetKey));

  const isDiffPartial =
    totalFiles > 0 &&
    (gitDiffStatus === 'failed' ||
      gitDiffStatus === 'unavailable' ||
      gitDiffStatus === 'partial' ||
      !hasDiffHunks);

  const isPartial =
    unresolvedCount > 0 ||
    ambiguousCount > 0 ||
    hasAstPartial ||
    hasAstFailed ||
    (!hasAstComplete && totalFiles > 0) ||
    hasGraphPartial ||
    hasGraphFailed ||
    (!hasGraphComplete && totalFiles > 0) ||
    hasImpactPartial ||
    hasImpactFailed ||
    (totalFiles === 0 && !isVerifiedEmptyDiff) ||
    isDiffPartial;

  const stage = isPartial ? 'risk_analysis_partial' : 'risk_analysis_complete';

  return {
    analysisId,
    repositoryId,
    commitSha,
    modelVersion: RISK_MODEL_VERSION,
    score: overallScore,
    level,
    severity,
    likelihood,
    confidence,
    uncertaintyScore,
    uncertaintyAdjustment,
    evidenceCompleteness,
    factors,
    highestRiskTargets,
    confirmedExposure,
    potentialExposure,
    supportingEvidence: {
      totalChangedFiles: totalFiles,
      totalChangedSymbols: totalSymbols,
      totalDirectImpacts: confirmedDirectCount,
      totalTransitiveImpacts: confirmedTransitiveCount,
      maxImpactDepth: maxConfirmedDepth,
      unresolvedCount,
      ambiguousCount,
    },
    limitations,
    missingEvidence,
    metadata: {
      modelVersion: RISK_MODEL_VERSION,
      calculatedAt: new Date().toISOString(),
      factorsCount: factors.length,
      targetsCount: highestRiskTargets.length,
      uncertaintyAdjustment,
    },
    timestamp: new Date().toISOString(),
    stage,
  };
}
