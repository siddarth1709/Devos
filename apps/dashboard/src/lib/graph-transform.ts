import type { Node, Edge } from "@xyflow/react";
import type {
  SymbolEntity,
  DependencyGraphData,
  SymbolKind,
  SymbolChangeStatus,
  SymbolImpactStatus,
  DependencyEdgeKind,
} from "@/types/api";

export interface SymbolNodeData {
  id: string;
  name: string;
  kind: SymbolKind;
  file: string;
  lineStart: number;
  lineEnd: number;
  changeStatus: SymbolChangeStatus;
  impactStatus: SymbolImpactStatus;
  incomingCount: number;
  outgoingCount: number;
  isSelected?: boolean;
  isDimmed?: boolean;
  isHighlighted?: boolean;
  relatedFindingsCount?: number;
  [key: string]: unknown;
}

export interface FileNodeData {
  id: string;
  name: string;
  path: string;
  symbolCount: number;
  changeStatus: SymbolChangeStatus;
  impactStatus: SymbolImpactStatus;
  isSelected?: boolean;
  isDimmed?: boolean;
  isHighlighted?: boolean;
  [key: string]: unknown;
}

export interface DependencyEdgeData {
  id: string;
  kind: DependencyEdgeKind;
  sourceFile: string;
  sourceLine: number;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  [key: string]: unknown;
}

export interface TransformedGraph {
  nodes: Node[];
  edges: Edge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    changedCount: number;
    impactedCount: number;
    fileCount: number;
  };
}

/**
 * Transforms backend DependencyGraphData into React Flow nodes and edges
 * using deterministic layered topological positioning.
 */
export function transformBackendGraph(
  data: DependencyGraphData,
  selectedNodeId: string | null = null,
  focusedFindingSymbolIds: string[] = [],
  filterKind: string = "all",
  filterChange: string = "all",
  isolationMode: boolean = false
): TransformedGraph {
  const { symbols = [], edges = [], changedSymbols = [], impactedSymbols = [] } = data;

  const changedSet = new Set(changedSymbols);
  const impactedSet = new Set(impactedSymbols);
  const focusedSet = new Set(focusedFindingSymbolIds);

  // Compute adjacency for blast-radius & connection counts
  const incomingMap = new Map<string, string[]>();
  const outgoingMap = new Map<string, string[]>();

  for (const edge of edges) {
    if (!outgoingMap.has(edge.from)) outgoingMap.set(edge.from, []);
    outgoingMap.get(edge.from)!.push(edge.to);

    if (!incomingMap.has(edge.to)) incomingMap.set(edge.to, []);
    incomingMap.get(edge.to)!.push(edge.from);
  }

  // Determine downstream blast radius if a node is selected or if isolation mode is active
  const blastRadiusNodes = new Set<string>();
  if (selectedNodeId) {
    blastRadiusNodes.add(selectedNodeId);
    // BFS traverse downstream
    const queue = [selectedNodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = outgoingMap.get(current) || [];
      for (const n of neighbors) {
        if (!blastRadiusNodes.has(n)) {
          blastRadiusNodes.add(n);
          queue.push(n);
        }
      }
    }
  }

  // Filter symbols based on toolbar selections
  const filteredSymbols = symbols.filter((sym) => {
    // Kind filter
    if (filterKind !== "all") {
      if (filterKind === "functions" && sym.kind !== "function" && sym.kind !== "method") return false;
      if (filterKind === "classes" && sym.kind !== "class" && sym.kind !== "interface") return false;
      if (filterKind === "files" && sym.kind !== "file") return false;
    }

    const isChanged = changedSet.has(sym.name) || changedSet.has(sym.id);
    const isImpacted = impactedSet.has(sym.name) || impactedSet.has(sym.id);

    // Change status filter
    if (filterChange === "changed" && !isChanged) return false;
    if (filterChange === "impacted" && !isImpacted && !isChanged) return false;

    // Isolation mode: keep only changed + impacted nodes
    if (isolationMode && !isChanged && !isImpacted) return false;

    return true;
  });

  const validNodeIds = new Set(filteredSymbols.map((s) => s.id));

  // Compute topological ranks (layers) for left-to-right visual flow
  const rankMap = new Map<string, number>();
  for (const sym of filteredSymbols) {
    const isChanged = changedSet.has(sym.name) || changedSet.has(sym.id);
    if (isChanged) {
      rankMap.set(sym.id, 0); // Root changes start at layer 0
    }
  }

  // Propagate ranks downstream
  for (let iter = 0; iter < 4; iter++) {
    for (const edge of edges) {
      if (rankMap.has(edge.from)) {
        const fromRank = rankMap.get(edge.from)!;
        const currentTargetRank = rankMap.get(edge.to) ?? 0;
        rankMap.set(edge.to, Math.max(currentTargetRank, fromRank + 1));
      }
    }
  }

  // Group nodes by layer for clean layout
  const layerBuckets = new Map<number, SymbolEntity[]>();
  for (const sym of filteredSymbols) {
    const rank = rankMap.get(sym.id) || 0;
    if (!layerBuckets.has(rank)) layerBuckets.set(rank, []);
    layerBuckets.get(rank)!.push(sym);
  }

  const X_SPACING = 340;
  const Y_SPACING = 140;

  const nodes: Node[] = [];
  let changedCount = 0;
  let impactedCount = 0;

  layerBuckets.forEach((bucketSymbols, rank) => {
    bucketSymbols.forEach((sym, indexInLayer) => {
      const isChanged = changedSet.has(sym.name) || changedSet.has(sym.id);
      const isImpacted = !isChanged && (impactedSet.has(sym.name) || impactedSet.has(sym.id));

      if (isChanged) changedCount++;
      if (isImpacted) impactedCount++;

      const isSelected = selectedNodeId === sym.id;
      const isFocusedFinding = focusedSet.has(sym.name) || focusedSet.has(sym.id);
      const isRelatedToSelection = selectedNodeId
        ? blastRadiusNodes.has(sym.id) || (incomingMap.get(selectedNodeId) || []).includes(sym.id)
        : false;

      const isDimmed = Boolean(selectedNodeId && !isSelected && !isRelatedToSelection);

      const changeStatus: SymbolChangeStatus = isChanged
        ? sym.changeStatus || "modified"
        : sym.changeStatus || "unchanged";

      const impactStatus: SymbolImpactStatus = isChanged
        ? "root_cause"
        : isImpacted
        ? "impacted"
        : "none";

      const nodeData: SymbolNodeData = {
        id: sym.id,
        name: sym.name,
        kind: sym.kind,
        file: sym.file,
        lineStart: sym.lineStart,
        lineEnd: sym.lineEnd,
        changeStatus,
        impactStatus,
        incomingCount: incomingMap.get(sym.id)?.length || 0,
        outgoingCount: outgoingMap.get(sym.id)?.length || 0,
        isSelected,
        isDimmed,
        isHighlighted: isSelected || isFocusedFinding,
        relatedFindingsCount: isFocusedFinding ? 1 : 0,
      };

      nodes.push({
        id: sym.id,
        type: sym.kind === "file" ? "fileNode" : "symbolNode",
        position: {
          x: rank * X_SPACING + 50,
          y: indexInLayer * Y_SPACING + 60,
        },
        data: nodeData,
      });
    });
  });

  // Filter and build edges
  const transformedEdges: Edge[] = [];

  for (const edge of edges) {
    if (!validNodeIds.has(edge.from) || !validNodeIds.has(edge.to)) continue;

    const isConnectedToSelected =
      selectedNodeId === edge.from || selectedNodeId === edge.to;
    const isPartOfBlastRadius =
      blastRadiusNodes.has(edge.from) && blastRadiusNodes.has(edge.to);

    const isHighlighted = isConnectedToSelected || isPartOfBlastRadius;
    const isDimmed = Boolean(selectedNodeId && !isHighlighted);

    const edgeData: DependencyEdgeData = {
      id: edge.id,
      kind: edge.kind,
      sourceFile: edge.sourceFile,
      sourceLine: edge.sourceLine,
      isHighlighted,
      isDimmed,
    };

    transformedEdges.push({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      type: "dependencyEdge",
      animated: isHighlighted,
      data: edgeData,
      style: {
        stroke: isHighlighted
          ? "#C7F36B"
          : isDimmed
          ? "#1D221F"
          : "#3A4338",
        strokeWidth: isHighlighted ? 2.5 : 1.5,
        opacity: isDimmed ? 0.25 : 1,
      },
    });
  }

  // Unique files count
  const uniqueFiles = new Set(filteredSymbols.map((s) => s.file));

  return {
    nodes,
    edges: transformedEdges,
    stats: {
      totalNodes: nodes.length,
      totalEdges: transformedEdges.length,
      changedCount,
      impactedCount,
      fileCount: uniqueFiles.size,
    },
  };
}
