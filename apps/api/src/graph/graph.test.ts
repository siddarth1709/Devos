import { describe, it, expect } from 'vitest';
import { resolveModuleSpecifier, resolveExportedSymbol, SymbolRecord } from './resolver.js';
import { constructDependencyGraph } from './builder.js';

describe('Dependency Graph Resolver & Builder Unit Tests', () => {
  const trackedFiles = new Set([
    'src/index.ts',
    'src/math.ts',
    'src/utils/index.ts',
    'src/utils/format.ts',
    'src/components/Button.tsx',
    'src/components/index.tsx',
    'src/reexports/barrel.ts',
    'src/reexports/sourceA.ts',
    'src/reexports/sourceB.ts',
    'src/circular/a.ts',
    'src/circular/b.ts',
    'src/ambiguous/barrel.ts',
    'src/ambiguous/mod1.ts',
    'src/ambiguous/mod2.ts',
  ]);

  describe('Module Resolution', () => {
    it('resolves relative imports with explicit ts and tsx extensions', () => {
      const resTs = resolveModuleSpecifier('src/index.ts', './math.ts', trackedFiles);
      expect(resTs.status).toBe('resolved');
      expect(resTs.targetFile).toBe('src/math.ts');

      const resTsx = resolveModuleSpecifier('src/index.ts', './components/Button.tsx', trackedFiles);
      expect(resTsx.status).toBe('resolved');
      expect(resTsx.targetFile).toBe('src/components/Button.tsx');
    });

    it('resolves NodeNext js extensions to underlying ts and tsx files', () => {
      const resJs = resolveModuleSpecifier('src/index.ts', './math.js', trackedFiles);
      expect(resJs.status).toBe('resolved');
      expect(resJs.targetFile).toBe('src/math.ts');

      const resJsx = resolveModuleSpecifier('src/index.ts', './components/Button.js', trackedFiles);
      expect(resJsx.status).toBe('resolved');
      expect(resJsx.targetFile).toBe('src/components/Button.tsx');
    });

    it('resolves extensionless module imports', () => {
      const res = resolveModuleSpecifier('src/index.ts', './math', trackedFiles);
      expect(res.status).toBe('resolved');
      expect(res.targetFile).toBe('src/math.ts');
    });

    it('resolves directory index.ts and index.tsx files', () => {
      const resDirTs = resolveModuleSpecifier('src/index.ts', './utils', trackedFiles);
      expect(resDirTs.status).toBe('resolved');
      expect(resDirTs.targetFile).toBe('src/utils/index.ts');

      const resDirTsx = resolveModuleSpecifier('src/index.ts', './components', trackedFiles);
      expect(resDirTsx.status).toBe('resolved');
      expect(resDirTsx.targetFile).toBe('src/components/index.tsx');
    });

    it('identifies external package imports without relative prefix', () => {
      const resExt = resolveModuleSpecifier('src/index.ts', 'react', trackedFiles);
      expect(resExt.status).toBe('external');
      expect(resExt.specifier).toBe('react');

      const resScoped = resolveModuleSpecifier('src/index.ts', '@prisma/client', trackedFiles);
      expect(resScoped.status).toBe('external');
      expect(resScoped.specifier).toBe('@prisma/client');
    });

    it('marks non-existent relative imports as unresolved with reason', () => {
      const resUnresolved = resolveModuleSpecifier('src/index.ts', './does-not-exist', trackedFiles);
      expect(resUnresolved.status).toBe('unresolved');
      expect(resUnresolved.reason).toBe('MODULE_FILE_NOT_FOUND');
      expect(resUnresolved.attemptedPaths?.length).toBeGreaterThan(0);
    });
  });

  describe('Symbol Resolution & Re-exports', () => {
    const symbolsByFile = new Map<string, SymbolRecord[]>([
      [
        'src/math.ts',
        [
          {
            symbolKey: 'src/math.ts#add:function:1:1',
            name: 'add',
            kind: 'function',
            file: 'src/math.ts',
            lineStart: 1,
            lineEnd: 3,
            isExported: true,
          },
          {
            symbolKey: 'src/math.ts#Calculator:class:5:1',
            name: 'Calculator',
            kind: 'class',
            file: 'src/math.ts',
            lineStart: 5,
            lineEnd: 15,
            isExported: true,
            exportKind: 'default',
          },
        ],
      ],
      [
        'src/reexports/sourceA.ts',
        [
          {
            symbolKey: 'src/reexports/sourceA.ts#multiply:function:1:1',
            name: 'multiply',
            kind: 'function',
            file: 'src/reexports/sourceA.ts',
            lineStart: 1,
            lineEnd: 3,
            isExported: true,
          },
        ],
      ],
      [
        'src/reexports/sourceB.ts',
        [
          {
            symbolKey: 'src/reexports/sourceB.ts#divide:function:1:1',
            name: 'divide',
            kind: 'function',
            file: 'src/reexports/sourceB.ts',
            lineStart: 1,
            lineEnd: 3,
            isExported: true,
          },
        ],
      ],
      [
        'src/reexports/barrel.ts',
        [
          {
            symbolKey: 'src/reexports/barrel.ts#multiply:export:1:1',
            name: 'multiply',
            kind: 'export',
            file: 'src/reexports/barrel.ts',
            lineStart: 1,
            lineEnd: 1,
            isExported: true,
            isReExport: true,
            reExportModule: './sourceA.js',
          },
          {
            symbolKey: 'src/reexports/barrel.ts#divide:export:2:1',
            name: 'divide',
            kind: 'export',
            file: 'src/reexports/barrel.ts',
            lineStart: 2,
            lineEnd: 2,
            isExported: true,
            isReExport: true,
            exportAlias: 'safeDivide',
            reExportModule: './sourceB.js',
          },
          {
            symbolKey: 'src/reexports/barrel.ts#*:export:3:1',
            name: '*',
            kind: 'export',
            file: 'src/reexports/barrel.ts',
            lineStart: 3,
            lineEnd: 3,
            isExported: true,
            exportKind: 'all',
            isReExport: true,
            reExportModule: './sourceB.js',
          },
        ],
      ],
      [
        'src/circular/a.ts',
        [
          {
            symbolKey: 'src/circular/a.ts#bFn:export:1:1',
            name: 'bFn',
            kind: 'export',
            file: 'src/circular/a.ts',
            lineStart: 1,
            lineEnd: 1,
            isExported: true,
            isReExport: true,
            reExportModule: './b.js',
          },
        ],
      ],
      [
        'src/circular/b.ts',
        [
          {
            symbolKey: 'src/circular/b.ts#bFn:export:1:1',
            name: 'bFn',
            kind: 'export',
            file: 'src/circular/b.ts',
            lineStart: 1,
            lineEnd: 1,
            isExported: true,
            isReExport: true,
            reExportModule: './a.js',
          },
        ],
      ],
      [
        'src/ambiguous/mod1.ts',
        [
          {
            symbolKey: 'src/ambiguous/mod1.ts#clash:function:1:1',
            name: 'clash',
            kind: 'function',
            file: 'src/ambiguous/mod1.ts',
            lineStart: 1,
            lineEnd: 3,
            isExported: true,
          },
        ],
      ],
      [
        'src/ambiguous/mod2.ts',
        [
          {
            symbolKey: 'src/ambiguous/mod2.ts#clash:function:1:1',
            name: 'clash',
            kind: 'function',
            file: 'src/ambiguous/mod2.ts',
            lineStart: 1,
            lineEnd: 3,
            isExported: true,
          },
        ],
      ],
      [
        'src/ambiguous/barrel.ts',
        [
          {
            symbolKey: 'src/ambiguous/barrel.ts#*:export:1:1',
            name: '*',
            kind: 'export',
            file: 'src/ambiguous/barrel.ts',
            lineStart: 1,
            lineEnd: 1,
            isExported: true,
            exportKind: 'all',
            isReExport: true,
            reExportModule: './mod1.js',
          },
          {
            symbolKey: 'src/ambiguous/barrel.ts#*:export:2:1',
            name: '*',
            kind: 'export',
            file: 'src/ambiguous/barrel.ts',
            lineStart: 2,
            lineEnd: 2,
            isExported: true,
            exportKind: 'all',
            isReExport: true,
            reExportModule: './mod2.js',
          },
        ],
      ],
    ]);

    it('resolves direct named and default exports', () => {
      const namedRes = resolveExportedSymbol('src/math.ts', 'add', symbolsByFile, trackedFiles);
      expect(namedRes.status).toBe('resolved');
      expect(namedRes.targetSymbolKey).toBe('src/math.ts#add:function:1:1');

      const defaultRes = resolveExportedSymbol('src/math.ts', 'default', symbolsByFile, trackedFiles);
      expect(defaultRes.status).toBe('resolved');
      expect(defaultRes.targetSymbolKey).toBe('src/math.ts#Calculator:class:5:1');
    });

    it('resolves named and aliased re-export chains', () => {
      const reExportNamed = resolveExportedSymbol('src/reexports/barrel.ts', 'multiply', symbolsByFile, trackedFiles);
      expect(reExportNamed.status).toBe('resolved');
      expect(reExportNamed.targetSymbolKey).toBe('src/reexports/sourceA.ts#multiply:function:1:1');

      const reExportAliased = resolveExportedSymbol('src/reexports/barrel.ts', 'safeDivide', symbolsByFile, trackedFiles);
      expect(reExportAliased.status).toBe('resolved');
      expect(reExportAliased.targetSymbolKey).toBe('src/reexports/sourceB.ts#divide:function:1:1');
    });

    it('resolves unambiguous wildcard re-exports', () => {
      const wildcardRes = resolveExportedSymbol('src/reexports/barrel.ts', 'divide', symbolsByFile, trackedFiles);
      expect(wildcardRes.status).toBe('resolved');
      expect(wildcardRes.targetSymbolKey).toBe('src/reexports/sourceB.ts#divide:function:1:1');
    });

    it('detects circular re-export chains without infinite loops', () => {
      const circularRes = resolveExportedSymbol('src/circular/a.ts', 'bFn', symbolsByFile, trackedFiles);
      expect(circularRes.status).toBe('unresolved');
      expect(circularRes.reason).toBe('CIRCULAR_IMPORT_DETECTED');
    });

    it('detects ambiguous wildcard exports and flags them without guessing', () => {
      const ambiguousRes = resolveExportedSymbol('src/ambiguous/barrel.ts', 'clash', symbolsByFile, trackedFiles);
      expect(ambiguousRes.status).toBe('ambiguous');
      expect(ambiguousRes.reason).toBe('AMBIGUOUS_WILDCARD_EXPORT');
      expect(ambiguousRes.candidates?.length).toBe(2);
    });

    it('reports unexported symbols honestly as unresolved', () => {
      const unexported = resolveExportedSymbol('src/math.ts', 'nonExistentFn', symbolsByFile, trackedFiles);
      expect(unexported.status).toBe('unresolved');
      expect(unexported.reason).toBe('SYMBOL_NOT_EXPORTED');
    });
  });

  describe('Full Graph Construction', () => {
    it('constructs a directed graph with file, symbol, module nodes and typed edges', () => {
      const symbols: SymbolRecord[] = [
        {
          symbolKey: 'src/consumer.ts#add:import:1:1',
          name: 'add',
          kind: 'import',
          file: 'src/consumer.ts',
          lineStart: 1,
          lineEnd: 1,
          isExported: false,
          importKind: 'named',
          importedName: 'add',
          localName: 'add',
          moduleSpecifier: './math.js',
        },
        {
          symbolKey: 'src/consumer.ts#Calculator:import:2:1',
          name: 'Calculator',
          kind: 'import',
          file: 'src/consumer.ts',
          lineStart: 2,
          lineEnd: 2,
          isExported: false,
          importKind: 'default',
          importedName: 'default',
          localName: 'Calculator',
          moduleSpecifier: './math.js',
        },
        {
          symbolKey: 'src/consumer.ts#React:import:3:1',
          name: 'React',
          kind: 'import',
          file: 'src/consumer.ts',
          lineStart: 3,
          lineEnd: 3,
          isExported: false,
          importKind: 'default',
          importedName: 'default',
          localName: 'React',
          moduleSpecifier: 'react',
        },
        {
          symbolKey: 'src/consumer.ts#sideEffect:import:4:1',
          name: './sideEffect.js',
          kind: 'import',
          file: 'src/consumer.ts',
          lineStart: 4,
          lineEnd: 4,
          isExported: false,
          importKind: 'side-effect',
          moduleSpecifier: './sideEffect.js',
        },
        {
          symbolKey: 'src/consumer.ts#runApp:function:6:1',
          name: 'runApp',
          kind: 'function',
          file: 'src/consumer.ts',
          lineStart: 6,
          lineEnd: 10,
          isExported: true,
        },
        {
          symbolKey: 'src/math.ts#add:function:1:1',
          name: 'add',
          kind: 'function',
          file: 'src/math.ts',
          lineStart: 1,
          lineEnd: 3,
          isExported: true,
        },
        {
          symbolKey: 'src/math.ts#Calculator:class:5:1',
          name: 'Calculator',
          kind: 'class',
          file: 'src/math.ts',
          lineStart: 5,
          lineEnd: 12,
          isExported: true,
          exportKind: 'default',
        },
      ];

      const graph = constructDependencyGraph({
        analysisId: 'test-anl',
        repositoryId: 'test-repo',
        commitSha: '1111111111111111111111111111111111111111',
        trackedFiles: ['src/consumer.ts', 'src/math.ts', 'src/sideEffect.ts'],
        symbols,
      });

      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);

      const fileNodes = graph.nodes.filter((n) => n.nodeType === 'file');
      expect(fileNodes.some((n) => n.path === 'src/consumer.ts')).toBe(true);
      expect(fileNodes.some((n) => n.path === 'src/math.ts')).toBe(true);

      const symbolNodes = graph.nodes.filter((n) => n.nodeType === 'symbol');
      expect(symbolNodes.some((n) => n.name === 'runApp')).toBe(true);
      expect(symbolNodes.some((n) => n.name === 'add')).toBe(true);

      const extModuleNode = graph.nodes.find((n) => n.nodeKey === 'module:react');
      expect(extModuleNode).toBeDefined();

      const containsEdges = graph.edges.filter((e) => e.kind === 'contains');
      expect(containsEdges.some((e) => e.from === 'file:src/consumer.ts' && e.to === 'symbol:src/consumer.ts#runApp:function:6:1')).toBe(true);

      const importModuleEdges = graph.edges.filter((e) => e.kind === 'imports_module');
      expect(importModuleEdges.some((e) => e.from === 'file:src/consumer.ts' && e.to === 'file:src/math.ts')).toBe(true);
      expect(importModuleEdges.some((e) => e.from === 'file:src/consumer.ts' && e.to === 'module:react')).toBe(true);

      const importSymbolEdges = graph.edges.filter((e) => e.kind === 'imports_symbol');
      const addImportEdge = importSymbolEdges.find((e) => e.from === 'file:src/consumer.ts' && e.to === 'symbol:src/math.ts#add:function:1:1');
      expect(addImportEdge).toBeDefined();
      expect(addImportEdge?.resolutionStatus).toBe('resolved');

      const calcImportEdge = importSymbolEdges.find((e) => e.from === 'file:src/consumer.ts' && e.to === 'symbol:src/math.ts#Calculator:class:5:1');
      expect(calcImportEdge).toBeDefined();
      expect(calcImportEdge?.resolutionStatus).toBe('resolved');

      const reactImportEdge = importSymbolEdges.find((e) => e.from === 'file:src/consumer.ts' && e.to === 'module:react');
      expect(reactImportEdge).toBeDefined();
      expect(reactImportEdge?.resolutionStatus).toBe('external');

      expect(graph.metrics.internalDependencies).toBeGreaterThan(0);
      expect(graph.metrics.externalDependencies).toBeGreaterThan(0);
      expect(graph.metrics.filesWithResolvedImports).toBe(1);
    });
  });
});
