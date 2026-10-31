import path from 'node:path';
import { ModuleResolution, SymbolResolution } from './types.js';

export interface SymbolRecord {
  symbolKey: string;
  name: string;
  kind: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  colStart?: number | null;
  colEnd?: number | null;
  isExported: boolean;
  containerName?: string | null;
  signature?: string | null;
  importKind?: string | null;
  importedName?: string | null;
  localName?: string | null;
  moduleSpecifier?: string | null;
  exportKind?: string | null;
  exportAlias?: string | null;
  isReExport?: boolean;
  reExportModule?: string | null;
}

export function resolveModuleSpecifier(
  sourceFile: string,
  specifier: string,
  allTrackedFiles: Set<string>
): ModuleResolution {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return {
      status: 'external',
      specifier,
    };
  }

  const sourceDir = path.posix.dirname(sourceFile);
  const normalizedBase = path.posix.normalize(path.posix.join(sourceDir, specifier));

  const candidateAttempts: string[] = [];

  if (allTrackedFiles.has(normalizedBase)) {
    return {
      status: 'resolved',
      targetFile: normalizedBase,
      specifier,
    };
  }
  candidateAttempts.push(normalizedBase);

  if (normalizedBase.endsWith('.js')) {
    const tsCandidate = normalizedBase.slice(0, -3) + '.ts';
    const tsxCandidate = normalizedBase.slice(0, -3) + '.tsx';
    candidateAttempts.push(tsCandidate, tsxCandidate);
    if (allTrackedFiles.has(tsCandidate)) {
      return { status: 'resolved', targetFile: tsCandidate, specifier };
    }
    if (allTrackedFiles.has(tsxCandidate)) {
      return { status: 'resolved', targetFile: tsxCandidate, specifier };
    }
  }

  if (normalizedBase.endsWith('.jsx')) {
    const tsxCandidate = normalizedBase.slice(0, -4) + '.tsx';
    candidateAttempts.push(tsxCandidate);
    if (allTrackedFiles.has(tsxCandidate)) {
      return { status: 'resolved', targetFile: tsxCandidate, specifier };
    }
  }

  const tsExt = normalizedBase + '.ts';
  const tsxExt = normalizedBase + '.tsx';
  candidateAttempts.push(tsExt, tsxExt);
  if (allTrackedFiles.has(tsExt)) {
    return { status: 'resolved', targetFile: tsExt, specifier };
  }
  if (allTrackedFiles.has(tsxExt)) {
    return { status: 'resolved', targetFile: tsxExt, specifier };
  }

  const indexTs = path.posix.join(normalizedBase, 'index.ts');
  const indexTsx = path.posix.join(normalizedBase, 'index.tsx');
  candidateAttempts.push(indexTs, indexTsx);
  if (allTrackedFiles.has(indexTs)) {
    return { status: 'resolved', targetFile: indexTs, specifier };
  }
  if (allTrackedFiles.has(indexTsx)) {
    return { status: 'resolved', targetFile: indexTsx, specifier };
  }

  return {
    status: 'unresolved',
    specifier,
    reason: 'MODULE_FILE_NOT_FOUND',
    attemptedPaths: candidateAttempts,
  };
}

export function resolveExportedSymbol(
  targetFile: string,
  exportName: string,
  symbolsByFile: Map<string, SymbolRecord[]>,
  allTrackedFiles: Set<string>,
  visitedFiles = new Set<string>()
): SymbolResolution {
  if (visitedFiles.has(targetFile)) {
    return {
      status: 'unresolved',
      reason: 'CIRCULAR_IMPORT_DETECTED',
      targetFile,
    };
  }
  visitedFiles.add(targetFile);

  const fileSymbols = symbolsByFile.get(targetFile) ?? [];

  if (exportName === '*') {
    return {
      status: 'resolved',
      targetFile,
    };
  }

  if (exportName === 'default') {
    const directDefault = fileSymbols.find(
      (s) => s.isExported && (s.exportKind === 'default' || s.name === 'default')
    );
    if (directDefault) {
      return {
        status: 'resolved',
        targetSymbolKey: directDefault.symbolKey,
        targetFile,
      };
    }

    const reExportDefault = fileSymbols.find(
      (s) => s.kind === 'export' && s.exportAlias === 'default' && s.reExportModule
    );
    if (reExportDefault && reExportDefault.reExportModule) {
      const nextMod = resolveModuleSpecifier(targetFile, reExportDefault.reExportModule, allTrackedFiles);
      if (nextMod.status === 'resolved' && nextMod.targetFile) {
        return resolveExportedSymbol(
          nextMod.targetFile,
          reExportDefault.name,
          symbolsByFile,
          allTrackedFiles,
          new Set(visitedFiles)
        );
      }
    }

    return {
      status: 'unresolved',
      reason: 'DEFAULT_EXPORT_NOT_FOUND',
      targetFile,
    };
  }

  const directNamed = fileSymbols.find(
    (s) => s.name === exportName && s.isExported && s.kind !== 'export' && s.kind !== 'import'
  );
  if (directNamed) {
    return {
      status: 'resolved',
      targetSymbolKey: directNamed.symbolKey,
      targetFile,
    };
  }

  const namedReExports = fileSymbols.filter(
    (s) =>
      s.kind === 'export' &&
      s.reExportModule &&
      ((s.exportAlias && s.exportAlias === exportName) || (!s.exportAlias && s.name === exportName))
  );

  for (const reExp of namedReExports) {
    if (!reExp.reExportModule) continue;
    const nextMod = resolveModuleSpecifier(targetFile, reExp.reExportModule, allTrackedFiles);
    if (nextMod.status === 'resolved' && nextMod.targetFile) {
      const resolved = resolveExportedSymbol(
        nextMod.targetFile,
        reExp.name,
        symbolsByFile,
        allTrackedFiles,
        new Set(visitedFiles)
      );
      if (resolved.status === 'resolved' || resolved.reason === 'CIRCULAR_IMPORT_DETECTED') {
        return resolved;
      }
    }
  }

  const wildcardReExports = fileSymbols.filter(
    (s) => s.kind === 'export' && s.exportKind === 'all' && s.name === '*' && s.reExportModule
  );

  const wildcardCandidates: SymbolResolution[] = [];
  for (const wild of wildcardReExports) {
    if (!wild.reExportModule) continue;
    const nextMod = resolveModuleSpecifier(targetFile, wild.reExportModule, allTrackedFiles);
    if (nextMod.status === 'resolved' && nextMod.targetFile) {
      const res = resolveExportedSymbol(
        nextMod.targetFile,
        exportName,
        symbolsByFile,
        allTrackedFiles,
        new Set(visitedFiles)
      );
      if (res.status === 'resolved') {
        wildcardCandidates.push(res);
      }
    }
  }

  if (wildcardCandidates.length === 1) {
    return wildcardCandidates[0]!;
  }
  if (wildcardCandidates.length > 1) {
    const candidateKeys = wildcardCandidates
      .map((c) => c.targetSymbolKey)
      .filter((k): k is string => Boolean(k));
    return {
      status: 'ambiguous',
      reason: 'AMBIGUOUS_WILDCARD_EXPORT',
      candidates: candidateKeys,
      targetFile,
    };
  }

  return {
    status: 'unresolved',
    reason: 'SYMBOL_NOT_EXPORTED',
    targetFile,
  };
}
