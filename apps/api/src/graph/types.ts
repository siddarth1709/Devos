export type DependencyNodeType = 'file' | 'symbol' | 'module';

export type DependencyEdgeKind =
  | 'imports_module'
  | 'imports_symbol'
  | 're_exports'
  | 'contains'
  | 'references_symbol';

export type DependencyResolutionStatus =
  | 'resolved'
  | 'unresolved'
  | 'ambiguous'
  | 'external';

export interface GraphNode {
  nodeKey: string;
  nodeType: DependencyNodeType;
  name: string;
  path?: string | null;
  symbolKey?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface GraphEdge {
  edgeKey: string;
  from: string;
  to: string;
  kind: DependencyEdgeKind;
  sourceFile: string;
  sourceLine: number;
  sourceCol?: number | null;
  resolutionStatus: DependencyResolutionStatus;
  metadata?: Record<string, unknown> | null;
}

export interface GraphMetrics {
  filesConsidered: number;
  filesWithResolvedImports: number;
  internalDependencies: number;
  externalDependencies: number;
  unresolvedDependencies: number;
  ambiguousDependencies: number;
  nodesCreated: number;
  edgesCreated: number;
  resolutionErrors: number;
}

export interface DependencyGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metrics: GraphMetrics;
}

export interface ModuleResolution {
  status: 'resolved' | 'unresolved' | 'external';
  targetFile?: string;
  specifier: string;
  reason?: string;
  attemptedPaths?: string[];
}

export interface SymbolResolution {
  status: 'resolved' | 'unresolved' | 'ambiguous' | 'external';
  targetSymbolKey?: string;
  targetFile?: string;
  reason?: string;
  candidates?: string[];
}
