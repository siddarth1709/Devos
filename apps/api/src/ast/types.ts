export type SymbolKind =
  | 'function'
  | 'class'
  | 'method'
  | 'constructor'
  | 'interface'
  | 'type'
  | 'enum'
  | 'variable'
  | 'import'
  | 'export';

export type ImportClassification = 'default' | 'named' | 'namespace' | 'side-effect';
export type ExportClassification = 'named' | 'default' | 'all';

export interface ExtractedSymbol {
  symbolKey: string;
  name: string;
  kind: SymbolKind;
  file: string;
  lineStart: number;
  lineEnd: number;
  colStart: number;
  colEnd: number;
  isExported: boolean;
  containerName?: string | null;
  signature?: string | null;

  // Explicit Import & Export Semantics
  importKind?: ImportClassification | null;
  importedName?: string | null;
  localName?: string | null;
  moduleSpecifier?: string | null;

  exportKind?: ExportClassification | null;
  exportAlias?: string | null;
  isReExport?: boolean;
  reExportModule?: string | null;
  metadata?: string | null;
}

export interface FileExtractionResult {
  file: string;
  symbols: ExtractedSymbol[];
  parseDiagnostics: string[];
  error?: string | null;
}

export interface ExtractionMetrics {
  filesDiscovered: number;
  filesProcessed: number;
  filesSkipped: number;
  parseErrors: number;
  extractionErrors: number;
  totalSymbols: number;
}

export interface RepositoryExtractionReport {
  results: FileExtractionResult[];
  metrics: ExtractionMetrics;
}
