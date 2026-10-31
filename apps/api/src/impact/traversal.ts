import {
  ChangedFileInput,
  ImpactClassification,
  ImpactReport,
  ImpactResolutionStatus,
  ImpactResultItem,
  ImpactSummary,
  ImpactTargetType,
  ImpactTraversalOptions,
} from './types.js';

interface QueueItem {
  currentKey: string;
  sourceChangeKey: string;
  sourceChangeFile: string;
  sourceChangeSymbol: string | null;
  depth: number;
  path: string[];
  relationshipTypes: string[];
  edgeKeys: string[];
}

function parseTargetKey(key: string): {
  type: ImpactTargetType;
  file: string | null;
  symbol: string | null;
} {
  if (key.startsWith('file:')) {
    const file = key.slice(5);
    return { type: 'file', file, symbol: null };
  }
  if (key.startsWith('symbol:')) {
    const symbolKey = key.slice(7);
    const hashIdx = symbolKey.indexOf('#');
    const file = hashIdx !== -1 ? symbolKey.slice(0, hashIdx) : null;
    return { type: 'symbol', file, symbol: symbolKey };
  }
  if (key.startsWith('module:')) {
    return { type: 'module', file: null, symbol: null };
  }
  return { type: 'file', file: key, symbol: null };
}

export function traverseImpact(options: ImpactTraversalOptions): ImpactReport {
  const {
    changedFiles,
    symbols,
    nodes,
    edges,
    analysisId,
    repositoryId,
    commitSha,
    maxDepth = 10,
  } = options;

  const nodeMap = new Map<string, (typeof nodes)[0]>();
  for (const n of nodes) {
    nodeMap.set(n.nodeKey, n);
  }

  const symbolsByFile = new Map<string, typeof symbols>();
  for (const s of symbols) {
    const list = symbolsByFile.get(s.file) ?? [];
    list.push(s);
    symbolsByFile.set(s.file, list);
  }

  const reverseEdges = new Map<string, typeof edges>();
  for (const e of edges) {
    const list = reverseEdges.get(e.to) ?? [];
    list.push(e);
    reverseEdges.set(e.to, list);
  }

  const resultsMap = new Map<string, ImpactResultItem>();
  const queue: QueueItem[] = [];

  const sortedChangedFiles = [...changedFiles].sort((a, b) => a.path.localeCompare(b.path));

  let changedFilesCount = 0;
  let changedSymbolsCount = 0;

  for (const cf of sortedChangedFiles) {
    const fileNodeKey = `file:${cf.path}`;
    changedFilesCount++;

    const changedItem: ImpactResultItem = {
      resultKey: `${fileNodeKey}->${fileNodeKey}:changed`,
      analysisId,
      repositoryId,
      commitSha,
      targetKey: fileNodeKey,
      targetType: 'file',
      targetFile: cf.path,
      targetSymbol: null,
      sourceChangeKey: fileNodeKey,
      sourceChangeFile: cf.path,
      sourceChangeSymbol: null,
      classification: 'changed',
      depth: 0,
      path: [fileNodeKey],
      relationshipTypes: [],
      edgeKeys: [],
      resolutionStatus: 'resolved',
      collector: 'change-impact-analyzer',
      metadata: {
        changeType: cf.changeType,
        oldPath: cf.oldPath ?? null,
      },
    };
    resultsMap.set(`${fileNodeKey}__${fileNodeKey}`, changedItem);

    queue.push({
      currentKey: fileNodeKey,
      sourceChangeKey: fileNodeKey,
      sourceChangeFile: cf.path,
      sourceChangeSymbol: null,
      depth: 0,
      path: [fileNodeKey],
      relationshipTypes: [],
      edgeKeys: [],
    });

    const fileSymbols = symbolsByFile.get(cf.path) ?? [];
    const relevantSymbols = fileSymbols.filter((s) => {
      if (cf.changeType === 'deleted') return false;
      if (!cf.hunks || cf.hunks.length === 0) return true;
      return cf.hunks.some((h) => {
        if (h.newLines === 0) {
          return s.lineStart <= h.newStart && s.lineEnd >= h.newStart;
        }
        const hunkEnd = h.newStart + Math.max(h.newLines - 1, 0);
        return !(s.lineEnd < h.newStart || s.lineStart > hunkEnd);
      });
    });

    const sortedSymbols = [...relevantSymbols].sort((a, b) => a.symbolKey.localeCompare(b.symbolKey));
    for (const s of sortedSymbols) {
      changedSymbolsCount++;
      const symNodeKey = `symbol:${s.symbolKey}`;

      const symChangedItem: ImpactResultItem = {
        resultKey: `${symNodeKey}->${symNodeKey}:changed`,
        analysisId,
        repositoryId,
        commitSha,
        targetKey: symNodeKey,
        targetType: 'symbol',
        targetFile: s.file,
        targetSymbol: s.symbolKey,
        sourceChangeKey: symNodeKey,
        sourceChangeFile: s.file,
        sourceChangeSymbol: s.symbolKey,
        classification: 'changed',
        depth: 0,
        path: [fileNodeKey, symNodeKey],
        relationshipTypes: ['contains'],
        edgeKeys: [],
        resolutionStatus: 'resolved',
        collector: 'change-impact-analyzer',
        metadata: {
          symbolName: s.name,
          symbolKind: s.kind,
          isExported: s.isExported ?? false,
        },
      };
      resultsMap.set(`${symNodeKey}__${symNodeKey}`, symChangedItem);

      queue.push({
        currentKey: symNodeKey,
        sourceChangeKey: symNodeKey,
        sourceChangeFile: s.file,
        sourceChangeSymbol: s.symbolKey,
        depth: 0,
        path: [fileNodeKey, symNodeKey],
        relationshipTypes: ['contains'],
        edgeKeys: [],
      });
    }
  }

  const minDepthMap = new Map<string, number>();

  while (queue.length > 0) {
    const item = queue.shift()!;
    const stateKey = `${item.sourceChangeKey}__${item.currentKey}`;
    const previousMin = minDepthMap.get(stateKey);
    if (previousMin !== undefined && previousMin < item.depth) {
      continue;
    }
    minDepthMap.set(stateKey, item.depth);

    if (item.depth >= maxDepth) {
      continue;
    }

    const incomingEdges = reverseEdges.get(item.currentKey) ?? [];
    const sortedEdges = [...incomingEdges].sort((a, b) => a.edgeKey.localeCompare(b.edgeKey));

    for (const edge of sortedEdges) {
      const consumerKey = edge.from;

      if (item.path.includes(consumerKey)) {
        continue;
      }

      const nextDepth = item.depth + 1;
      const nextPath = [...item.path, consumerKey];
      const nextRels = [...item.relationshipTypes, edge.kind];
      const nextEdgeKeys = [...item.edgeKeys, edge.edgeKey];

      let classification: ImpactClassification = item.depth === 0 ? 'direct' : 'transitive';
      let resStatus: ImpactResolutionStatus = 'resolved';

      if (edge.resolutionStatus === 'unresolved') {
        classification = 'unresolved';
        resStatus = 'unresolved';
      } else if (edge.resolutionStatus === 'ambiguous') {
        classification = 'ambiguous';
        resStatus = 'ambiguous';
      } else if (edge.resolutionStatus === 'external') {
        resStatus = 'external';
      }

      const parsedTarget = parseTargetKey(consumerKey);
      const pairKey = `${item.sourceChangeKey}__${consumerKey}`;
      const resultKey = `${item.sourceChangeKey}->${consumerKey}:${classification}`;

      const existing = resultsMap.get(pairKey);
      if (!existing || existing.depth > nextDepth) {
        resultsMap.set(pairKey, {
          resultKey,
          analysisId,
          repositoryId,
          commitSha,
          targetKey: consumerKey,
          targetType: parsedTarget.type,
          targetFile: parsedTarget.file,
          targetSymbol: parsedTarget.symbol,
          sourceChangeKey: item.sourceChangeKey,
          sourceChangeFile: item.sourceChangeFile,
          sourceChangeSymbol: item.sourceChangeSymbol,
          classification,
          depth: nextDepth,
          path: nextPath,
          relationshipTypes: nextRels,
          edgeKeys: nextEdgeKeys,
          resolutionStatus: resStatus,
          collector: 'change-impact-analyzer',
          metadata: edge.metadata ? JSON.parse(edge.metadata) : null,
        });
      }

      if (classification === 'direct' || classification === 'transitive') {
        queue.push({
          currentKey: consumerKey,
          sourceChangeKey: item.sourceChangeKey,
          sourceChangeFile: item.sourceChangeFile,
          sourceChangeSymbol: item.sourceChangeSymbol,
          depth: nextDepth,
          path: nextPath,
          relationshipTypes: nextRels,
          edgeKeys: nextEdgeKeys,
        });
      }
    }
  }

  const allResults = Array.from(resultsMap.values()).sort((a, b) => {
    if (a.sourceChangeKey !== b.sourceChangeKey) {
      return a.sourceChangeKey.localeCompare(b.sourceChangeKey);
    }
    if (a.depth !== b.depth) {
      return a.depth - b.depth;
    }
    if (a.targetKey !== b.targetKey) {
      return a.targetKey.localeCompare(b.targetKey);
    }
    return a.classification.localeCompare(b.classification);
  });

  let directImpactCount = 0;
  let transitiveImpactCount = 0;
  let unresolvedImpactCount = 0;
  let ambiguousImpactCount = 0;
  let maxDepthReached = 0;

  for (const r of allResults) {
    if (r.depth > maxDepthReached) {
      maxDepthReached = r.depth;
    }
    if (r.classification === 'direct') directImpactCount++;
    else if (r.classification === 'transitive') transitiveImpactCount++;
    else if (r.classification === 'unresolved') unresolvedImpactCount++;
    else if (r.classification === 'ambiguous') ambiguousImpactCount++;
  }

  const limitations: string[] = [];
  for (const cf of changedFiles) {
    if (cf.changeType === 'renamed' && cf.oldPath) {
      const hasOldPathEdges = reverseEdges.has(`file:${cf.oldPath}`);
      if (!hasOldPathEdges) {
        limitations.push(
          `Consumers importing renamed file old path "${cf.oldPath}" cannot be established from head dependency graph`
        );
      }
    }
  }

  const isPartial = unresolvedImpactCount > 0 || ambiguousImpactCount > 0;
  const stage = isPartial ? 'impact_analysis_partial' : 'impact_analysis_complete';

  const summary: ImpactSummary = {
    analysisId,
    repositoryId,
    commitSha,
    changedFilesCount,
    changedSymbolsCount,
    directImpactCount,
    transitiveImpactCount,
    unresolvedImpactCount,
    ambiguousImpactCount,
    maxDepthReached,
    isPartial,
    limitations: limitations.length > 0 ? limitations : undefined,
  };

  return {
    summary,
    results: allResults,
    stage,
    limitations: limitations.length > 0 ? limitations : undefined,
  };
}
