export type ImpactClassification =
  | 'changed'
  | 'direct'
  | 'transitive'
  | 'unresolved'
  | 'ambiguous';

export type ImpactResolutionStatus =
  | 'resolved'
  | 'unresolved'
  | 'ambiguous'
  | 'external';

export type ImpactTargetType = 'file' | 'symbol' | 'module';

export interface ImpactResultItem {
  id?: string;
  resultKey: string;
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  targetKey: string;
  targetType: ImpactTargetType;
  targetFile: string | null;
  targetSymbol: string | null;
  sourceChangeKey: string;
  sourceChangeFile: string;
  sourceChangeSymbol: string | null;
  classification: ImpactClassification;
  depth: number;
  path: string[];
  relationshipTypes: string[];
  edgeKeys: string[];
  resolutionStatus: ImpactResolutionStatus;
  collector: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
}

export interface ImpactSummary {
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  changedFilesCount: number;
  changedSymbolsCount: number;
  directImpactCount: number;
  transitiveImpactCount: number;
  unresolvedImpactCount: number;
  ambiguousImpactCount: number;
  maxDepthReached: number;
  isPartial: boolean;
  limitations?: string[];
}

export interface ImpactReport {
  summary: ImpactSummary;
  results: ImpactResultItem[];
  stage: string;
  error?: string | null;
  limitations?: string[];
}

export interface ChangedFileInput {
  path: string;
  changeType: string;
  oldPath?: string | null;
  hunks?: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
  }>;
}

export interface ImpactTraversalOptions {
  changedFiles: ChangedFileInput[];
  symbols: Array<{
    symbolKey: string;
    name: string;
    kind: string;
    file: string;
    lineStart: number;
    lineEnd: number;
    isExported?: boolean;
    containerName?: string | null;
  }>;
  nodes: Array<{
    nodeKey: string;
    nodeType: string;
    name: string;
    path?: string | null;
    symbolKey?: string | null;
  }>;
  edges: Array<{
    edgeKey: string;
    from: string;
    to: string;
    kind: string;
    sourceFile: string;
    sourceLine: number;
    resolutionStatus: string;
    metadata?: string | null;
  }>;
  analysisId: string;
  repositoryId: string;
  commitSha: string;
  maxDepth?: number;
}
