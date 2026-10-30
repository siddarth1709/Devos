"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
} from "@xyflow/react";
import { SymbolNode } from "./nodes/symbol-node";
import { FileNode } from "./nodes/file-node";
import { DependencyEdge } from "./edges/dependency-edge";
import { GraphToolbar } from "./graph-toolbar";
import { NodeDetailPanel } from "./node-detail-panel";
import { GraphLegend } from "./graph-legend";
import {
  transformBackendGraph,
  type SymbolNodeData,
} from "@/lib/graph-transform";
import type { DependencyGraphData, Finding, ApiError } from "@/types/api";
import { Network, AlertCircle, RefreshCw } from "lucide-react";

const nodeTypes = {
  symbolNode: SymbolNode,
  fileNode: FileNode,
};

const edgeTypes = {
  dependencyEdge: DependencyEdge,
};

interface EngineeringGraphProps {
  graphData: DependencyGraphData | null;
  isLoading?: boolean;
  isError?: boolean;
  error?: ApiError | Error | null;
  onRetry?: () => void;
  initialFocusedNodeId?: string | null;
  relatedFindings?: Finding[];
  repositoryId?: string;
  pullRequestId?: string;
}

function GraphCanvas({
  graphData,
  isLoading,
  isError,
  error,
  onRetry,
  initialFocusedNodeId,
  relatedFindings = [],
  repositoryId = "",
  pullRequestId = "",
}: EngineeringGraphProps) {
  const { fitView, setCenter } = useReactFlow();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterKind, setFilterKind] = useState("all");
  const [filterChange, setFilterChange] = useState("all");
  const [isolationMode, setIsolationMode] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const activeSelectedId = selectedNodeId ?? initialFocusedNodeId ?? null;

  // Transform backend graph to React Flow representation
  const transformed = useMemo(() => {
    if (!graphData) {
      return {
        nodes: [],
        edges: [],
        stats: {
          totalNodes: 0,
          totalEdges: 0,
          changedCount: 0,
          impactedCount: 0,
          fileCount: 0,
        },
      };
    }

    const findingSymbolIds = relatedFindings
      .flatMap((f) => f.relatedSymbolIds || [f.symbol || ""])
      .filter(Boolean);

    return transformBackendGraph(
      graphData,
      activeSelectedId,
      findingSymbolIds,
      filterKind,
      filterChange,
      isolationMode
    );
  }, [
    graphData,
    activeSelectedId,
    relatedFindings,
    filterKind,
    filterChange,
    isolationMode,
  ]);

  const displayNodes = useMemo(() => {
    if (!searchQuery.trim()) return transformed.nodes;
    const q = searchQuery.toLowerCase();
    return transformed.nodes.map((n) => {
      const data = n.data as SymbolNodeData;
      const matches =
        data.name.toLowerCase().includes(q) ||
        data.file.toLowerCase().includes(q);
      return {
        ...n,
        data: {
          ...data,
          isDimmed: !matches,
          isHighlighted: matches,
        },
      };
    });
  }, [transformed.nodes, searchQuery]);

  // Center on focused node
  useEffect(() => {
    if (activeSelectedId && displayNodes.length > 0) {
      const targetNode = displayNodes.find((n) => n.id === activeSelectedId);
      if (targetNode) {
        setCenter(targetNode.position.x + 130, targetNode.position.y + 50, {
          duration: 600,
          zoom: 1.1,
        });
      }
    }
  }, [activeSelectedId, displayNodes, setCenter]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      setSelectedNodeId(node.id);
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId("");
  }, []);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 600 });
  }, [fitView]);

  const handleResetView = useCallback(() => {
    setSelectedNodeId("");
    setSearchQuery("");
    setFilterKind("all");
    setFilterChange("all");
    setIsolationMode(false);
    fitView({ padding: 0.2, duration: 600 });
  }, [fitView]);

  // Derive selected node data
  const selectedNodeData = useMemo(() => {
    if (!activeSelectedId) return null;
    const found = displayNodes.find((n) => n.id === activeSelectedId);
    return (found?.data as SymbolNodeData) || null;
  }, [activeSelectedId, displayNodes]);

  // Derive incoming / outgoing neighbors for detail panel
  const { incomingNeighbors, outgoingNeighbors } = useMemo(() => {
    if (!activeSelectedId || !graphData) {
      return { incomingNeighbors: [], outgoingNeighbors: [] };
    }

    const symbolLookup = new Map(graphData.symbols.map((s) => [s.id, s]));

    const incoming = graphData.edges
      .filter((e) => e.to === activeSelectedId)
      .map((e) => {
        const sym = symbolLookup.get(e.from);
        return {
          id: e.from,
          name: sym?.name || e.from,
          kind: sym?.kind || "symbol",
        };
      });

    const outgoing = graphData.edges
      .filter((e) => e.from === activeSelectedId)
      .map((e) => {
        const sym = symbolLookup.get(e.to);
        return {
          id: e.to,
          name: sym?.name || e.to,
          kind: sym?.kind || "symbol",
        };
      });

    return { incomingNeighbors: incoming, outgoingNeighbors: outgoing };
  }, [activeSelectedId, graphData]);

  // Related findings for selected node
  const activeNodeFindings = useMemo(() => {
    if (!selectedNodeData) return [];
    return relatedFindings.filter(
      (f) =>
        f.symbol === selectedNodeData.name ||
        f.file === selectedNodeData.file ||
        (f.relatedSymbolIds || []).includes(selectedNodeData.id)
    );
  }, [selectedNodeData, relatedFindings]);

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="h-[720px] w-full bg-[#090A0A] border border-[#292E2A] rounded-[6px] flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full border-2 border-[#C7F36B] border-t-transparent animate-spin" />
        <div className="space-y-1">
          <h3 className="font-mono text-[14px] font-semibold text-[#F0F2ED]">
            Resolving AST Dependency Lattice...
          </h3>
          <p className="font-body text-[12px] text-[#A0A79F] max-w-[360px]">
            Extracting symbol definitions, imports, and downstream call hierarchies from Builder 2.
          </p>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (isError) {
    return (
      <div className="h-[720px] w-full bg-[#101211] border border-[#292E2A] rounded-[6px] flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-[#292015] border border-[#E9B96E] flex items-center justify-center text-[#E9B96E]">
          <AlertCircle size={24} />
        </div>
        <div className="space-y-1">
          <h3 className="font-display font-semibold text-[18px] text-[#F0F2ED]">
            Dependency Graph Unavailable
          </h3>
          <p className="font-body text-[13px] text-[#A0A79F] max-w-[480px]">
            {error?.message ||
              "Unable to load AST dependency graph. Ensure repository analysis has completed."}
          </p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 rounded-[4px] bg-[#C7F36B] text-[#090A0A] font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center gap-2 hover:bg-[#D7FF86] transition-colors"
          >
            <RefreshCw size={13} />
            <span>Retry Connection</span>
          </button>
        )}
      </div>
    );
  }

  // 3. Truthful Empty State
  if (!graphData || graphData.symbols.length === 0) {
    return (
      <div className="h-[720px] w-full bg-[#101211] border border-[#292E2A] rounded-[6px] flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-[#151816] border border-[#292E2A] flex items-center justify-center text-[#6E776F]">
          <Network size={24} />
        </div>
        <div className="space-y-1.5">
          <h3 className="font-display font-semibold text-[18px] text-[#F0F2ED]">
            No Dependency Data Detected
          </h3>
          <p className="font-body text-[13px] text-[#A0A79F] max-w-[460px]">
            No symbol call relationships or dependency edges were reported by the analysis engine for this revision. Run impact analysis from the Pull Request review interface.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[780px] w-full bg-[#090A0A] border border-[#292E2A] rounded-[6px] overflow-hidden flex flex-col">
      {/* Top Floating Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-10 pointer-events-auto">
        <GraphToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterKind={filterKind}
          onFilterKindChange={setFilterKind}
          filterChange={filterChange}
          onFilterChangeChange={setFilterChange}
          isolationMode={isolationMode}
          onToggleIsolationMode={() => setIsolationMode(!isolationMode)}
          onFitView={handleFitView}
          onResetView={handleResetView}
          stats={transformed.stats}
        />
      </div>

      {/* Main Canvas & Right Detail Panel */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 h-full w-full">
          <ReactFlow
            nodes={displayNodes}
            edges={transformed.edges}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            minZoom={0.2}
            maxZoom={2.0}
            defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1D221F" gap={20} size={1} />
            <Controls
              className="!bg-[#101211] !border !border-[#292E2A] !rounded-[4px] !overflow-hidden [&>button]:!bg-[#101211] [&>button]:!border-b [&>button]:!border-[#1D221F] [&>button]:!text-[#A0A79F] hover:[&>button]:!text-[#F0F2ED]"
              showInteractive={false}
            />
            <MiniMap
              className="!bg-[#101211] !border !border-[#292E2A] !rounded-[4px] !bottom-4 !right-4 hidden sm:block"
              nodeColor={(node) => {
                const data = node.data as SymbolNodeData;
                if (data?.changeStatus !== "unchanged") return "#C7F36B";
                if (data?.impactStatus === "impacted") return "#E9B96E";
                return "#292E2A";
              }}
              maskColor="rgba(9, 10, 10, 0.75)"
            />
          </ReactFlow>
        </div>

        {/* Floating Bottom Left Legend */}
        <div className="absolute bottom-4 left-4 z-10 w-[240px]">
          <GraphLegend />
        </div>

        {/* Docked / Drawer Node Detail Panel */}
        {selectedNodeData && (
          <NodeDetailPanel
            nodeData={selectedNodeData}
            onClose={() => setSelectedNodeId(null)}
            onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
            incomingNodes={incomingNeighbors}
            outgoingNodes={outgoingNeighbors}
            relatedFindings={activeNodeFindings}
            repositoryId={repositoryId}
            pullRequestId={pullRequestId}
          />
        )}
      </div>
    </div>
  );
}

export function EngineeringGraph(props: EngineeringGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
