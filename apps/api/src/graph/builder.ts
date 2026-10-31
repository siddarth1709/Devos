import path from 'node:path';
import {
  DependencyEdgeKind,
  DependencyGraphResult,
  GraphEdge,
  GraphMetrics,
  GraphNode,
} from './types.js';
import {
  resolveExportedSymbol,
  resolveModuleSpecifier,
  SymbolRecord,
} from './resolver.js';
import { prisma } from '../db.js';
import {
  createDependencyEdges,
  createDependencyNodes,
  deleteDependencyEdgesByAnalysis,
  deleteDependencyNodesByAnalysis,
  createInvestigation,
} from '../repo/index.js';

export interface BuildGraphOptions {
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  trackedFiles: string[];
  symbols: SymbolRecord[];
}

export function constructDependencyGraph(options: BuildGraphOptions): DependencyGraphResult {
  const { analysisId, trackedFiles, symbols } = options;

  const allTrackedFiles = new Set(trackedFiles);
  const symbolsByFile = new Map<string, SymbolRecord[]>();
  const symbolsByKey = new Map<string, SymbolRecord>();

  for (const s of symbols) {
    if (!symbolsByFile.has(s.file)) {
      symbolsByFile.set(s.file, []);
    }
    symbolsByFile.get(s.file)!.push(s);
    symbolsByKey.set(s.symbolKey, s);
  }

  const nodesMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const edgeKeySet = new Set<string>();

  function addNode(node: GraphNode): void {
    if (!nodesMap.has(node.nodeKey)) {
      nodesMap.set(node.nodeKey, node);
    }
  }

  function addEdge(edge: GraphEdge): void {
    if (!edgeKeySet.has(edge.edgeKey)) {
      edgeKeySet.add(edge.edgeKey);
      edges.push(edge);
    }
  }

  for (const file of trackedFiles) {
    addNode({
      nodeKey: `file:${file}`,
      nodeType: 'file',
      name: path.posix.basename(file),
      path: file,
      symbolKey: null,
      metadata: null,
    });
  }

  for (const s of symbols) {
    addNode({
      nodeKey: `symbol:${s.symbolKey}`,
      nodeType: 'symbol',
      name: s.name,
      path: s.file,
      symbolKey: s.symbolKey,
      metadata: {
        kind: s.kind,
        isExported: s.isExported,
        containerName: s.containerName ?? null,
      },
    });

    let parentNodeKey = `file:${s.file}`;
    if (s.containerName) {
      const containerSymbols = symbolsByFile.get(s.file) ?? [];
      const parentSymbol = containerSymbols.find((cs) => cs.name === s.containerName);
      if (parentSymbol) {
        parentNodeKey = `symbol:${parentSymbol.symbolKey}`;
      }
    }

    const containsEdgeKey = `${parentNodeKey}->symbol:${s.symbolKey}:contains:${s.lineStart}:${s.colStart ?? 1}`;
    addEdge({
      edgeKey: containsEdgeKey,
      from: parentNodeKey,
      to: `symbol:${s.symbolKey}`,
      kind: 'contains',
      sourceFile: s.file,
      sourceLine: s.lineStart,
      sourceCol: s.colStart ?? null,
      resolutionStatus: 'resolved',
      metadata: {
        containedKind: s.kind,
      },
    });
  }

  const filesWithResolvedImportsSet = new Set<string>();

  for (const s of symbols) {
    if (s.kind === 'import' && s.moduleSpecifier) {
      const modRes = resolveModuleSpecifier(s.file, s.moduleSpecifier, allTrackedFiles);

      let targetModuleNodeKey: string;
      if (modRes.status === 'resolved' && modRes.targetFile) {
        targetModuleNodeKey = `file:${modRes.targetFile}`;
      } else {
        targetModuleNodeKey = `module:${s.moduleSpecifier}`;
        addNode({
          nodeKey: targetModuleNodeKey,
          nodeType: 'module',
          name: s.moduleSpecifier,
          path: null,
          symbolKey: null,
          metadata: {
            external: modRes.status === 'external',
          },
        });
      }

      const modEdgeKey = `file:${s.file}->${targetModuleNodeKey}:imports_module:${s.lineStart}:${s.colStart ?? 1}`;
      addEdge({
        edgeKey: modEdgeKey,
        from: `file:${s.file}`,
        to: targetModuleNodeKey,
        kind: 'imports_module',
        sourceFile: s.file,
        sourceLine: s.lineStart,
        sourceCol: s.colStart ?? null,
        resolutionStatus: modRes.status,
        metadata: {
          specifier: s.moduleSpecifier,
          importKind: s.importKind,
          reason: modRes.reason ?? null,
        },
      });

      if (modRes.status === 'resolved') {
        filesWithResolvedImportsSet.add(s.file);
      }

      if (s.importKind !== 'side-effect') {
        let symTargetKey: string;
        let symResStatus: 'resolved' | 'unresolved' | 'ambiguous' | 'external';
        let symMetadata: Record<string, unknown> | null = null;

        if (modRes.status === 'external') {
          symTargetKey = `module:${s.moduleSpecifier}`;
          symResStatus = 'external';
          symMetadata = {
            importedName: s.importedName,
            localName: s.localName,
            specifier: s.moduleSpecifier,
          };
        } else if (modRes.status === 'unresolved' || !modRes.targetFile) {
          symTargetKey = `module:${s.moduleSpecifier}`;
          symResStatus = 'unresolved';
          symMetadata = {
            importedName: s.importedName,
            localName: s.localName,
            specifier: s.moduleSpecifier,
            reason: modRes.reason ?? 'MODULE_UNRESOLVED',
          };
        } else if (s.importKind === 'namespace' || s.importedName === '*') {
          symTargetKey = `file:${modRes.targetFile}`;
          symResStatus = 'resolved';
          symMetadata = {
            importKind: 'namespace',
            localName: s.localName,
            specifier: s.moduleSpecifier,
          };
        } else {
          const symRes = resolveExportedSymbol(
            modRes.targetFile,
            s.importedName ?? 'default',
            symbolsByFile,
            allTrackedFiles
          );

          if (symRes.status === 'resolved' && symRes.targetSymbolKey) {
            symTargetKey = `symbol:${symRes.targetSymbolKey}`;
            symResStatus = 'resolved';
            symMetadata = {
              importedName: s.importedName,
              localName: s.localName,
              specifier: s.moduleSpecifier,
              targetFile: symRes.targetFile,
            };
          } else if (symRes.status === 'resolved' && symRes.targetFile) {
            symTargetKey = `file:${symRes.targetFile}`;
            symResStatus = 'resolved';
            symMetadata = {
              importedName: s.importedName,
              localName: s.localName,
              specifier: s.moduleSpecifier,
              targetFile: symRes.targetFile,
              isNamespace: true,
            };
          } else if (symRes.status === 'ambiguous') {
            symTargetKey = `file:${modRes.targetFile}`;
            symResStatus = 'ambiguous';
            symMetadata = {
              importedName: s.importedName,
              candidates: symRes.candidates ?? [],
              reason: symRes.reason,
            };
          } else {
            symTargetKey = `file:${modRes.targetFile}`;
            symResStatus = 'unresolved';
            symMetadata = {
              importedName: s.importedName,
              reason: symRes.reason ?? 'SYMBOL_NOT_FOUND',
            };
          }
        }

        const symEdgeKey = `file:${s.file}->${symTargetKey}:imports_symbol:${s.localName ?? s.name}:${s.lineStart}:${s.colStart ?? 1}`;
        addEdge({
          edgeKey: symEdgeKey,
          from: `file:${s.file}`,
          to: symTargetKey,
          kind: 'imports_symbol',
          sourceFile: s.file,
          sourceLine: s.lineStart,
          sourceCol: s.colStart ?? null,
          resolutionStatus: symResStatus,
          metadata: symMetadata,
        });
      }
    }

    if (s.kind === 'export' && s.reExportModule) {
      const modRes = resolveModuleSpecifier(s.file, s.reExportModule, allTrackedFiles);

      let targetKey: string;
      let resStatus: 'resolved' | 'unresolved' | 'ambiguous' | 'external';
      let edgeMetadata: Record<string, unknown> | null = null;

      if (modRes.status === 'external') {
        targetKey = `module:${s.reExportModule}`;
        resStatus = 'external';
        addNode({
          nodeKey: targetKey,
          nodeType: 'module',
          name: s.reExportModule,
          path: null,
          symbolKey: null,
          metadata: { external: true },
        });
        edgeMetadata = {
          name: s.name,
          exportAlias: s.exportAlias,
          specifier: s.reExportModule,
        };
      } else if (modRes.status === 'unresolved' || !modRes.targetFile) {
        targetKey = `module:${s.reExportModule}`;
        resStatus = 'unresolved';
        addNode({
          nodeKey: targetKey,
          nodeType: 'module',
          name: s.reExportModule,
          path: null,
          symbolKey: null,
          metadata: { external: false },
        });
        edgeMetadata = {
          name: s.name,
          exportAlias: s.exportAlias,
          specifier: s.reExportModule,
          reason: modRes.reason,
        };
      } else if (s.exportKind === 'all' && s.name === '*') {
        targetKey = `file:${modRes.targetFile}`;
        resStatus = 'resolved';
        edgeMetadata = {
          exportKind: 'all',
          exportAlias: s.exportAlias,
          specifier: s.reExportModule,
        };
      } else {
        const symRes = resolveExportedSymbol(
          modRes.targetFile,
          s.name,
          symbolsByFile,
          allTrackedFiles
        );

        if (symRes.status === 'resolved' && symRes.targetSymbolKey) {
          targetKey = `symbol:${symRes.targetSymbolKey}`;
          resStatus = 'resolved';
          edgeMetadata = {
            name: s.name,
            exportAlias: s.exportAlias,
            specifier: s.reExportModule,
            targetFile: symRes.targetFile,
          };
        } else if (symRes.status === 'resolved' && symRes.targetFile) {
          targetKey = `file:${symRes.targetFile}`;
          resStatus = 'resolved';
          edgeMetadata = {
            name: s.name,
            exportAlias: s.exportAlias,
            specifier: s.reExportModule,
            targetFile: symRes.targetFile,
            isNamespace: true,
          };
        } else if (symRes.status === 'ambiguous') {
          targetKey = `file:${modRes.targetFile}`;
          resStatus = 'ambiguous';
          edgeMetadata = {
            name: s.name,
            candidates: symRes.candidates ?? [],
            reason: symRes.reason,
          };
        } else {
          targetKey = `file:${modRes.targetFile}`;
          resStatus = 'unresolved';
          edgeMetadata = {
            name: s.name,
            reason: symRes.reason ?? 'REEXPORT_SYMBOL_NOT_FOUND',
          };
        }
      }

      const reExportEdgeKey = `file:${s.file}->${targetKey}:re_exports:${s.exportAlias ?? s.name}:${s.lineStart}:${s.colStart ?? 1}`;
      addEdge({
        edgeKey: reExportEdgeKey,
        from: `file:${s.file}`,
        to: targetKey,
        kind: 're_exports',
        sourceFile: s.file,
        sourceLine: s.lineStart,
        sourceCol: s.colStart ?? null,
        resolutionStatus: resStatus,
        metadata: edgeMetadata,
      });
    }
  }

  for (const s of symbols) {
    if (s.kind === 'function' || s.kind === 'method' || s.kind === 'class') {
      const fileSymbols = symbolsByFile.get(s.file) ?? [];
      for (const other of fileSymbols) {
        if (
          other.symbolKey !== s.symbolKey &&
          (other.kind === 'function' || other.kind === 'class') &&
          s.signature &&
          s.signature.includes(other.name)
        ) {
          const refKey = `symbol:${s.symbolKey}->symbol:${other.symbolKey}:references_symbol:${s.lineStart}:${s.colStart ?? 1}`;
          addEdge({
            edgeKey: refKey,
            from: `symbol:${s.symbolKey}`,
            to: `symbol:${other.symbolKey}`,
            kind: 'references_symbol',
            sourceFile: s.file,
            sourceLine: s.lineStart,
            sourceCol: s.colStart ?? null,
            resolutionStatus: 'resolved',
            metadata: {
              referencedName: other.name,
            },
          });
        }
      }
    }
  }

  let internalDependencies = 0;
  let externalDependencies = 0;
  let unresolvedDependencies = 0;
  let ambiguousDependencies = 0;

  for (const e of edges) {
    if (e.kind === 'contains') continue;
    if (e.resolutionStatus === 'resolved') {
      internalDependencies++;
    } else if (e.resolutionStatus === 'external') {
      externalDependencies++;
    } else if (e.resolutionStatus === 'unresolved') {
      unresolvedDependencies++;
    } else if (e.resolutionStatus === 'ambiguous') {
      ambiguousDependencies++;
    }
  }

  const resolutionErrors = unresolvedDependencies + ambiguousDependencies;

  const metrics: GraphMetrics = {
    filesConsidered: trackedFiles.length,
    filesWithResolvedImports: filesWithResolvedImportsSet.size,
    internalDependencies,
    externalDependencies,
    unresolvedDependencies,
    ambiguousDependencies,
    nodesCreated: nodesMap.size,
    edgesCreated: edges.length,
    resolutionErrors,
  };

  return {
    nodes: Array.from(nodesMap.values()),
    edges,
    metrics,
  };
}

export interface BuildAndPersistGraphOptions {
  analysisId: string;
  repositoryId: string;
  repoPath: string;
  headSha: string;
  baseSha: string;
  trackedFiles: string[];
  symbols: SymbolRecord[];
}

export function validateGraphProvenance(
  nodes: Array<{ analysisId: string; repositoryId: string; commitSha: string; collector: string; nodeKey: string }>,
  edges: Array<{ analysisId: string; repositoryId: string; commitSha: string; sourceFile: string; collector: string; edgeKey: string }>
): void {
  for (const edge of edges) {
    if (!edge.analysisId || typeof edge.analysisId !== 'string' || edge.analysisId.trim() === '') {
      throw new Error(`Edge "${edge.edgeKey}" is missing valid analysisId provenance`);
    }
    if (!edge.repositoryId || typeof edge.repositoryId !== 'string' || edge.repositoryId.trim() === '') {
      throw new Error(`Edge "${edge.edgeKey}" is missing valid repositoryId provenance`);
    }
    if (!edge.commitSha || typeof edge.commitSha !== 'string' || edge.commitSha.trim() === '') {
      throw new Error(`Edge "${edge.edgeKey}" is missing valid commitSha provenance`);
    }
    if (!edge.sourceFile || typeof edge.sourceFile !== 'string' || edge.sourceFile.trim() === '') {
      throw new Error(`Edge "${edge.edgeKey}" is missing valid sourceFile provenance`);
    }
    if (!edge.collector || typeof edge.collector !== 'string' || edge.collector.trim() === '') {
      throw new Error(`Edge "${edge.edgeKey}" is missing valid collector provenance`);
    }
  }

  for (const node of nodes) {
    if (!node.analysisId || typeof node.analysisId !== 'string' || node.analysisId.trim() === '') {
      throw new Error(`Node "${node.nodeKey}" is missing valid analysisId provenance`);
    }
    if (!node.repositoryId || typeof node.repositoryId !== 'string' || node.repositoryId.trim() === '') {
      throw new Error(`Node "${node.nodeKey}" is missing valid repositoryId provenance`);
    }
    if (!node.commitSha || typeof node.commitSha !== 'string' || node.commitSha.trim() === '') {
      throw new Error(`Node "${node.nodeKey}" is missing valid commitSha provenance`);
    }
    if (!node.collector || typeof node.collector !== 'string' || node.collector.trim() === '') {
      throw new Error(`Node "${node.nodeKey}" is missing valid collector provenance`);
    }
  }
}

export async function buildAndPersistDependencyGraph(
  options: BuildAndPersistGraphOptions,
  client = prisma
): Promise<{
  success: boolean;
  stage: string;
  status: string;
  result: DependencyGraphResult;
  error?: string | null;
}> {
  const { analysisId, repositoryId, headSha, baseSha, trackedFiles, symbols } = options;
  const startedAt = new Date();

  try {
    const graphResult = constructDependencyGraph({
      analysisId,
      repositoryId,
      commitSha: headSha,
      trackedFiles,
      symbols,
    });

    const { nodes, edges, metrics } = graphResult;

    const finishedAt = new Date();
    let stage = 'dependency_graph_complete';
    let investigationStatus = 'in_progress';
    let errorPayload: string | null = null;

    if (metrics.resolutionErrors > 0) {
      stage = 'dependency_graph_partial';
      investigationStatus = 'in_progress';
      errorPayload = JSON.stringify({
        message: 'Dependency graph constructed with unresolved or ambiguous dependencies',
        metrics,
      });
    }

    const nodeInputs = nodes.map((n) => ({
      analysisId,
      nodeKey: n.nodeKey,
      nodeType: n.nodeType,
      name: n.name,
      path: n.path ?? null,
      symbolKey: n.symbolKey ?? null,
      repositoryId,
      commitSha: headSha,
      collector: 'dependency-graph-builder',
      metadata: n.metadata ? JSON.stringify(n.metadata) : null,
    }));

    const edgeInputs = edges.map((e) => ({
      analysisId,
      repositoryId,
      edgeKey: e.edgeKey,
      from: e.from,
      to: e.to,
      kind: e.kind,
      sourceFile: e.sourceFile,
      sourceLine: e.sourceLine,
      sourceCol: e.sourceCol ?? null,
      resolutionStatus: e.resolutionStatus,
      commitSha: headSha,
      collector: 'dependency-graph-builder',
      metadata: e.metadata ? JSON.stringify(e.metadata) : null,
    }));

    validateGraphProvenance(nodeInputs, edgeInputs);

    await client.$transaction(async (tx) => {
      await deleteDependencyEdgesByAnalysis(analysisId, tx as any);
      await deleteDependencyNodesByAnalysis(analysisId, tx as any);
      await createDependencyNodes(nodeInputs, tx as any);
      await createDependencyEdges(edgeInputs, tx as any);

      await createInvestigation(
        {
          analysisId,
          status: investigationStatus,
          stage,
          startedAt,
          finishedAt,
          error: errorPayload,
          baseSha,
          headSha,
          collector: 'dependency-graph-builder',
        },
        tx as any
      );
    });

    return {
      success: true,
      stage,
      status: investigationStatus,
      result: graphResult,
      error: errorPayload,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const failurePayload = JSON.stringify({
      message: 'Fatal error during dependency graph construction or persistence',
      error: errorMsg,
    });

    try {
      await prisma.$transaction(async (tx) => {
        await createInvestigation(
          {
            analysisId,
            status: 'failed',
            stage: 'dependency_graph_failed',
            startedAt,
            finishedAt: new Date(),
            error: failurePayload,
            baseSha,
            headSha,
            collector: 'dependency-graph-builder',
          },
          tx as any
        );

        await tx.analysis.update({
          where: { id: analysisId },
          data: {
            status: 'failed',
            error: `Dependency graph construction failed: ${errorMsg}`,
            finishedAt: new Date(),
          },
        });
      });
    } catch (dbErr) {
    }

    return {
      success: false,
      stage: 'dependency_graph_failed',
      status: 'failed',
      result: {
        nodes: [],
        edges: [],
        metrics: {
          filesConsidered: trackedFiles.length,
          filesWithResolvedImports: 0,
          internalDependencies: 0,
          externalDependencies: 0,
          unresolvedDependencies: 0,
          ambiguousDependencies: 0,
          nodesCreated: 0,
          edgesCreated: 0,
          resolutionErrors: 1,
        },
      },
      error: failurePayload,
    };
  }
}
