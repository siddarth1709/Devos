import { getFileAtCommit, listTrackedFilesAtCommit } from '../git/index.js';
import { isTypeScriptFile, parseSourceFileAST } from './parser.js';
import {
  FileExtractionResult,
  ExtractionMetrics,
  RepositoryExtractionReport,
} from './types.js';

export function isExcludedPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return (
    normalized.startsWith('node_modules/') ||
    normalized.includes('/node_modules/') ||
    normalized.startsWith('dist/') ||
    normalized.includes('/dist/') ||
    normalized.startsWith('build/') ||
    normalized.includes('/build/') ||
    normalized.startsWith('.git/') ||
    normalized.includes('/.git/') ||
    normalized.startsWith('coverage/') ||
    normalized.includes('/coverage/') ||
    normalized.startsWith('.next/') ||
    normalized.includes('/.next/')
  );
}

export type ExtractionScope = 'all' | 'changed';

export interface CollectAndExtractOptions {
  repoPath: string;
  headSha: string;
  scope?: ExtractionScope;
  files?: Array<{
    path: string;
    changeType: string;
  }>;
}

export async function collectAndExtractSymbols(
  options: CollectAndExtractOptions
): Promise<RepositoryExtractionReport> {
  const results: FileExtractionResult[] = [];
  const scope = options.scope ?? 'all';

  let candidatePaths: string[] = [];

  if (scope === 'all') {
    // Repository-wide mode: enumerate all tracked files at the exact commit
    const trackedFiles = await listTrackedFilesAtCommit(options.repoPath, options.headSha);
    candidatePaths = trackedFiles;
  } else {
    // Changed-files mode: filter out deleted files from diff
    candidatePaths = (options.files ?? [])
      .filter((f) => f.changeType !== 'deleted')
      .map((f) => f.path);
  }

  const filesDiscovered = candidatePaths.length;
  let filesProcessed = 0;
  let filesSkipped = 0;
  let parseErrors = 0;
  let extractionErrors = 0;
  let totalSymbols = 0;

  for (const filePath of candidatePaths) {
    // 1. Exclude dependency, build artifact, and hidden directories
    if (isExcludedPath(filePath)) {
      filesSkipped++;
      continue;
    }

    // 2. Exclude non-TypeScript files (and .d.ts declaration files)
    if (!isTypeScriptFile(filePath)) {
      filesSkipped++;
      continue;
    }

    // 3. Retrieve exact source content at the head commit
    try {
      const sourceText = await getFileAtCommit(options.repoPath, options.headSha, filePath);
      const parsed = parseSourceFileAST(filePath, sourceText);
      results.push(parsed);
      filesProcessed++;
      totalSymbols += parsed.symbols.length;

      if (parsed.parseDiagnostics.length > 0 || parsed.error) {
        parseErrors++;
      }
    } catch (err: unknown) {
      extractionErrors++;
      results.push({
        file: filePath,
        symbols: [],
        parseDiagnostics: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const metrics: ExtractionMetrics = {
    filesDiscovered,
    filesProcessed,
    filesSkipped,
    parseErrors,
    extractionErrors,
    totalSymbols,
  };

  return {
    results,
    metrics,
  };
}
