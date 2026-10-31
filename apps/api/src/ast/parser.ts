import ts from 'typescript';
import {
  ExtractedSymbol,
  FileExtractionResult,
  ImportClassification,
  ExportClassification,
} from './types.js';

export function isTypeScriptFile(filePath: string): boolean {
  return (
    (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) &&
    !filePath.endsWith('.d.ts')
  );
}

export function computeSymbolKey(
  file: string,
  name: string,
  kind: string,
  lineStart: number,
  colStart: number,
  containerName?: string | null
): string {
  const prefix = containerName ? `${containerName}.` : '';
  return `${file}#${prefix}${name}:${kind}:${lineStart}:${colStart}`;
}

export function parseSourceFileAST(
  filePath: string,
  sourceText: string
): FileExtractionResult {
  const isTsx = filePath.endsWith('.tsx');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const symbols: ExtractedSymbol[] = [];
  const parseDiagnostics: string[] = [];

  // Capture parser diagnostics without throwing
  const rawDiagnostics = (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] })
    .parseDiagnostics;
  if (Array.isArray(rawDiagnostics)) {
    for (const d of rawDiagnostics) {
      const msg = typeof d.messageText === 'string' ? d.messageText : d.messageText.messageText;
      parseDiagnostics.push(msg);
    }
  }

  function hasExportModifier(node: ts.Node): boolean {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
  }

  function hasDefaultModifier(node: ts.Node): boolean {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    return modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false;
  }

  function getNodeLocation(node: ts.Node) {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    return {
      lineStart: start.line + 1,
      colStart: start.character + 1,
      lineEnd: end.line + 1,
      colEnd: end.character + 1,
    };
  }

  function unpackBindingPattern(
    pattern: ts.BindingPattern,
    isExported: boolean,
    containerName: string | null
  ): void {
    for (const elem of pattern.elements) {
      if (ts.isOmittedExpression(elem)) {
        continue;
      }
      if (ts.isBindingElement(elem)) {
        if (ts.isIdentifier(elem.name)) {
          const varName = elem.name.text;
          const loc = getNodeLocation(elem);
          const symbolKey = computeSymbolKey(
            filePath,
            varName,
            'variable',
            loc.lineStart,
            loc.colStart,
            containerName
          );
          symbols.push({
            symbolKey,
            name: varName,
            kind: 'variable',
            file: filePath,
            lineStart: loc.lineStart,
            lineEnd: loc.lineEnd,
            colStart: loc.colStart,
            colEnd: loc.colEnd,
            isExported,
            containerName,
          });
        } else if (ts.isObjectBindingPattern(elem.name) || ts.isArrayBindingPattern(elem.name)) {
          unpackBindingPattern(elem.name, isExported, containerName);
        }
      }
    }
  }

  function visit(node: ts.Node, containerName: string | null = null): void {
    // 1. Function Declaration
    if (ts.isFunctionDeclaration(node)) {
      const name = node.name?.text || 'anonymous';
      const loc = getNodeLocation(node);
      const isExported = hasExportModifier(node);
      const isDefault = hasDefaultModifier(node);
      const symbolKey = computeSymbolKey(filePath, name, 'function', loc.lineStart, loc.colStart, containerName);
      symbols.push({
        symbolKey,
        name,
        kind: 'function',
        file: filePath,
        lineStart: loc.lineStart,
        lineEnd: loc.lineEnd,
        colStart: loc.colStart,
        colEnd: loc.colEnd,
        isExported,
        exportKind: isDefault ? 'default' : (isExported ? 'named' : null),
        containerName,
        signature: node.type ? `: ${node.type.getText(sourceFile)}` : null,
      });

      // Walk nested inner functions / classes
      ts.forEachChild(node, (child) => visit(child, name));
      return;
    }

    // 2. Class Declaration or Expression
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const className = node.name?.text || 'anonymous';
      const loc = getNodeLocation(node);
      const isExported = hasExportModifier(node);
      const isDefault = hasDefaultModifier(node);
      const symbolKey = computeSymbolKey(filePath, className, 'class', loc.lineStart, loc.colStart, containerName);
      symbols.push({
        symbolKey,
        name: className,
        kind: 'class',
        file: filePath,
        lineStart: loc.lineStart,
        lineEnd: loc.lineEnd,
        colStart: loc.colStart,
        colEnd: loc.colEnd,
        isExported,
        exportKind: isDefault ? 'default' : (isExported ? 'named' : null),
        containerName,
      });

      // Walk class members (methods, constructors, properties)
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
          const methodName = member.name ? member.name.getText(sourceFile) : 'anonymous';
          const memberLoc = getNodeLocation(member);
          const methodKey = computeSymbolKey(filePath, methodName, 'method', memberLoc.lineStart, memberLoc.colStart, className);
          symbols.push({
            symbolKey: methodKey,
            name: methodName,
            kind: 'method',
            file: filePath,
            lineStart: memberLoc.lineStart,
            lineEnd: memberLoc.lineEnd,
            colStart: memberLoc.colStart,
            colEnd: memberLoc.colEnd,
            isExported: false,
            containerName: className,
            signature: ts.isMethodDeclaration(member) && member.type ? `: ${member.type.getText(sourceFile)}` : null,
          });
          ts.forEachChild(member, (child) => visit(child, `${className}.${methodName}`));
        } else if (ts.isConstructorDeclaration(member)) {
          const memberLoc = getNodeLocation(member);
          const ctorKey = computeSymbolKey(filePath, 'constructor', 'constructor', memberLoc.lineStart, memberLoc.colStart, className);
          symbols.push({
            symbolKey: ctorKey,
            name: 'constructor',
            kind: 'constructor',
            file: filePath,
            lineStart: memberLoc.lineStart,
            lineEnd: memberLoc.lineEnd,
            colStart: memberLoc.colStart,
            colEnd: memberLoc.colEnd,
            isExported: false,
            containerName: className,
          });
          ts.forEachChild(member, (child) => visit(child, `${className}.constructor`));
        } else if (ts.isPropertyDeclaration(member)) {
          const propName = member.name ? member.name.getText(sourceFile) : 'anonymous';
          const isFunction =
            member.initializer &&
            (ts.isArrowFunction(member.initializer) || ts.isFunctionExpression(member.initializer));

          if (isFunction) {
            const memberLoc = getNodeLocation(member);
            const propKey = computeSymbolKey(filePath, propName, 'method', memberLoc.lineStart, memberLoc.colStart, className);
            symbols.push({
              symbolKey: propKey,
              name: propName,
              kind: 'method',
              file: filePath,
              lineStart: memberLoc.lineStart,
              lineEnd: memberLoc.lineEnd,
              colStart: memberLoc.colStart,
              colEnd: memberLoc.colEnd,
              isExported: false,
              containerName: className,
            });
            ts.forEachChild(member.initializer, (child) => visit(child, `${className}.${propName}`));
          }
        }
      }
      return;
    }

    // 3. Interface Declaration
    if (ts.isInterfaceDeclaration(node)) {
      const loc = getNodeLocation(node);
      const isExported = hasExportModifier(node);
      const symbolKey = computeSymbolKey(filePath, node.name.text, 'interface', loc.lineStart, loc.colStart, containerName);
      symbols.push({
        symbolKey,
        name: node.name.text,
        kind: 'interface',
        file: filePath,
        lineStart: loc.lineStart,
        lineEnd: loc.lineEnd,
        colStart: loc.colStart,
        colEnd: loc.colEnd,
        isExported,
        containerName,
      });
      return;
    }

    // 4. Type Alias Declaration
    if (ts.isTypeAliasDeclaration(node)) {
      const loc = getNodeLocation(node);
      const isExported = hasExportModifier(node);
      const symbolKey = computeSymbolKey(filePath, node.name.text, 'type', loc.lineStart, loc.colStart, containerName);
      symbols.push({
        symbolKey,
        name: node.name.text,
        kind: 'type',
        file: filePath,
        lineStart: loc.lineStart,
        lineEnd: loc.lineEnd,
        colStart: loc.colStart,
        colEnd: loc.colEnd,
        isExported,
        containerName,
      });
      return;
    }

    // 5. Enum Declaration
    if (ts.isEnumDeclaration(node)) {
      const loc = getNodeLocation(node);
      const isExported = hasExportModifier(node);
      const symbolKey = computeSymbolKey(filePath, node.name.text, 'enum', loc.lineStart, loc.colStart, containerName);
      symbols.push({
        symbolKey,
        name: node.name.text,
        kind: 'enum',
        file: filePath,
        lineStart: loc.lineStart,
        lineEnd: loc.lineEnd,
        colStart: loc.colStart,
        colEnd: loc.colEnd,
        isExported,
        containerName,
      });
      return;
    }

    // 6. Variable Statement
    if (ts.isVariableStatement(node)) {
      const isExported = hasExportModifier(node);
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          const varName = decl.name.text;
          const loc = getNodeLocation(decl);
          const isFunction =
            decl.initializer &&
            (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer));

          const kind = isFunction ? 'function' : 'variable';
          const symbolKey = computeSymbolKey(filePath, varName, kind, loc.lineStart, loc.colStart, containerName);
          symbols.push({
            symbolKey,
            name: varName,
            kind,
            file: filePath,
            lineStart: loc.lineStart,
            lineEnd: loc.lineEnd,
            colStart: loc.colStart,
            colEnd: loc.colEnd,
            isExported,
            containerName,
          });

          if (decl.initializer) {
            ts.forEachChild(decl.initializer, (child) => visit(child, varName));
          }
        } else if (ts.isObjectBindingPattern(decl.name) || ts.isArrayBindingPattern(decl.name)) {
          unpackBindingPattern(decl.name, isExported, containerName);
          if (decl.initializer) {
            ts.forEachChild(decl.initializer, (child) => visit(child, containerName));
          }
        }
      }
      return;
    }

    // 7. Import Declaration
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier.getText(sourceFile).replace(/^['"]|['"]$/g, '');
      const importClause = node.importClause;

      if (!importClause) {
        // Side-effect import: import 'foo'
        const loc = getNodeLocation(node);
        const symbolKey = computeSymbolKey(filePath, moduleSpecifier, 'import', loc.lineStart, loc.colStart, containerName);
        symbols.push({
          symbolKey,
          name: moduleSpecifier,
          kind: 'import',
          file: filePath,
          lineStart: loc.lineStart,
          lineEnd: loc.lineEnd,
          colStart: loc.colStart,
          colEnd: loc.colEnd,
          isExported: false,
          containerName,
          importKind: 'side-effect',
          importedName: null,
          localName: null,
          moduleSpecifier,
          isReExport: false,
        });
        return;
      }

      // Default import: import React from 'react'
      if (importClause.name) {
        const loc = getNodeLocation(importClause.name);
        const name = importClause.name.text;
        const symbolKey = computeSymbolKey(filePath, name, 'import', loc.lineStart, loc.colStart, containerName);
        symbols.push({
          symbolKey,
          name,
          kind: 'import',
          file: filePath,
          lineStart: loc.lineStart,
          lineEnd: loc.lineEnd,
          colStart: loc.colStart,
          colEnd: loc.colEnd,
          isExported: false,
          containerName,
          importKind: 'default',
          importedName: 'default',
          localName: name,
          moduleSpecifier,
          isReExport: false,
        });
      }

      // Named bindings: import { a as b } from './mod' or import * as ns from './mod'
      if (importClause.namedBindings) {
        if (ts.isNamedImports(importClause.namedBindings)) {
          for (const elem of importClause.namedBindings.elements) {
            const loc = getNodeLocation(elem);
            const importedName = elem.propertyName ? elem.propertyName.text : elem.name.text;
            const localName = elem.name.text;
            const symbolKey = computeSymbolKey(filePath, localName, 'import', loc.lineStart, loc.colStart, containerName);
            symbols.push({
              symbolKey,
              name: localName,
              kind: 'import',
              file: filePath,
              lineStart: loc.lineStart,
              lineEnd: loc.lineEnd,
              colStart: loc.colStart,
              colEnd: loc.colEnd,
              isExported: false,
              containerName,
              importKind: 'named',
              importedName,
              localName,
              moduleSpecifier,
              isReExport: false,
            });
          }
        } else if (ts.isNamespaceImport(importClause.namedBindings)) {
          const loc = getNodeLocation(importClause.namedBindings.name);
          const localName = importClause.namedBindings.name.text;
          const symbolKey = computeSymbolKey(filePath, localName, 'import', loc.lineStart, loc.colStart, containerName);
          symbols.push({
            symbolKey,
            name: localName,
            kind: 'import',
            file: filePath,
            lineStart: loc.lineStart,
            lineEnd: loc.lineEnd,
            colStart: loc.colStart,
            colEnd: loc.colEnd,
            isExported: false,
            containerName,
            importKind: 'namespace',
            importedName: '*',
            localName,
            moduleSpecifier,
            isReExport: false,
          });
        }
      }
      return;
    }

    // 8. Export Declaration: export { a as b } from './mod', export * from './mod', export * as ns from './mod'
    if (ts.isExportDeclaration(node)) {
      const reExportModule = node.moduleSpecifier
        ? node.moduleSpecifier.getText(sourceFile).replace(/^['"]|['"]$/g, '')
        : null;

      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const elem of node.exportClause.elements) {
          const loc = getNodeLocation(elem);
          const originalName = elem.propertyName ? elem.propertyName.text : elem.name.text;
          const exportAlias = elem.propertyName ? elem.name.text : null;
          const symbolKey = computeSymbolKey(filePath, originalName, 'export', loc.lineStart, loc.colStart, containerName);
          symbols.push({
            symbolKey,
            name: originalName,
            kind: 'export',
            file: filePath,
            lineStart: loc.lineStart,
            lineEnd: loc.lineEnd,
            colStart: loc.colStart,
            colEnd: loc.colEnd,
            isExported: true,
            containerName,
            exportKind: 'named',
            exportAlias,
            isReExport: Boolean(reExportModule),
            reExportModule,
            moduleSpecifier: reExportModule,
          });
        }
        return;
      }

      if (node.exportClause && ts.isNamespaceExport(node.exportClause)) {
        const loc = getNodeLocation(node.exportClause);
        const nsName = node.exportClause.name.text;
        const symbolKey = computeSymbolKey(filePath, nsName, 'export', loc.lineStart, loc.colStart, containerName);
        symbols.push({
          symbolKey,
          name: nsName,
          kind: 'export',
          file: filePath,
          lineStart: loc.lineStart,
          lineEnd: loc.lineEnd,
          colStart: loc.colStart,
          colEnd: loc.colEnd,
          isExported: true,
          containerName,
          exportKind: 'all',
          exportAlias: nsName,
          isReExport: Boolean(reExportModule),
          reExportModule,
          moduleSpecifier: reExportModule,
        });
        return;
      }

      // export * from './mod'
      const loc = getNodeLocation(node);
      const symbolKey = computeSymbolKey(filePath, '*', 'export', loc.lineStart, loc.colStart, containerName);
      symbols.push({
        symbolKey,
        name: '*',
        kind: 'export',
        file: filePath,
        lineStart: loc.lineStart,
        lineEnd: loc.lineEnd,
        colStart: loc.colStart,
        colEnd: loc.colEnd,
        isExported: true,
        containerName,
        exportKind: 'all',
        exportAlias: null,
        isReExport: Boolean(reExportModule),
        reExportModule,
        moduleSpecifier: reExportModule,
      });
      return;
    }

    // 9. Export Assignment: export default MyClass
    if (ts.isExportAssignment(node)) {
      const loc = getNodeLocation(node);
      const exprText = node.expression.getText(sourceFile);
      const symbolKey = computeSymbolKey(filePath, 'default', 'export', loc.lineStart, loc.colStart, containerName);
      symbols.push({
        symbolKey,
        name: exprText || 'default',
        kind: 'export',
        file: filePath,
        lineStart: loc.lineStart,
        lineEnd: loc.lineEnd,
        colStart: loc.colStart,
        colEnd: loc.colEnd,
        isExported: true,
        containerName,
        exportKind: 'default',
        exportAlias: null,
        isReExport: false,
        reExportModule: null,
      });
      return;
    }

    ts.forEachChild(node, (child) => visit(child, containerName));
  }

  try {
    ts.forEachChild(sourceFile, (child) => visit(child));
  } catch (err: unknown) {
    return {
      file: filePath,
      symbols,
      parseDiagnostics,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return {
    file: filePath,
    symbols,
    parseDiagnostics,
    error: null,
  };
}
