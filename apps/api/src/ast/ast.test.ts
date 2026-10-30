import { describe, it, expect } from 'vitest';
import { parseSourceFileAST, isTypeScriptFile } from './parser.js';
import { isExcludedPath } from './collector.js';

describe('TypeScript & TSX AST Extractor', () => {
  describe('File Filtering', () => {
    it('correctly identifies TypeScript and TSX files while excluding declaration and unsupported files', () => {
      expect(isTypeScriptFile('src/index.ts')).toBe(true);
      expect(isTypeScriptFile('src/App.tsx')).toBe(true);
      expect(isTypeScriptFile('src/types.d.ts')).toBe(false);
      expect(isTypeScriptFile('src/data.json')).toBe(false);
      expect(isTypeScriptFile('README.md')).toBe(false);
      expect(isTypeScriptFile('styles.css')).toBe(false);
    });

    it('identifies excluded directory paths', () => {
      expect(isExcludedPath('node_modules/pkg/index.ts')).toBe(true);
      expect(isExcludedPath('dist/bundle.js')).toBe(true);
      expect(isExcludedPath('build/app.ts')).toBe(true);
      expect(isExcludedPath('.git/HEAD')).toBe(true);
      expect(isExcludedPath('src/components/Header.tsx')).toBe(false);
    });
  });

  describe('Functions, Arrow Functions & Nested Functions', () => {
    it('extracts exported and unexported function declarations with accurate locations', () => {
      const code = `
export function add(a: number, b: number): number {
  return a + b;
}

function helper(): void {
  function innerHelper(): string {
    return 'nested';
  }
}
      `.trim();

      const result = parseSourceFileAST('src/math.ts', code);
      expect(result.error).toBeNull();
      expect(result.symbols.length).toBe(3);

      const addFn = result.symbols.find((s) => s.name === 'add');
      expect(addFn).toBeDefined();
      expect(addFn?.kind).toBe('function');
      expect(addFn?.isExported).toBe(true);
      expect(addFn?.lineStart).toBe(1);
      expect(addFn?.colStart).toBe(1);

      const helperFn = result.symbols.find((s) => s.name === 'helper');
      expect(helperFn).toBeDefined();
      expect(helperFn?.kind).toBe('function');
      expect(helperFn?.isExported).toBe(false);

      const innerFn = result.symbols.find((s) => s.name === 'innerHelper');
      expect(innerFn).toBeDefined();
      expect(innerFn?.kind).toBe('function');
      expect(innerFn?.containerName).toBe('helper');
    });

    it('extracts arrow functions assigned to variables', () => {
      const code = `
export const multiply = (x: number, y: number): number => x * y;
const subtract = (x: number, y: number) => { return x - y; };
      `.trim();

      const result = parseSourceFileAST('src/calc.ts', code);
      expect(result.symbols.length).toBe(2);

      const multiplyFn = result.symbols.find((s) => s.name === 'multiply');
      expect(multiplyFn?.kind).toBe('function');
      expect(multiplyFn?.isExported).toBe(true);

      const subFn = result.symbols.find((s) => s.name === 'subtract');
      expect(subFn?.kind).toBe('function');
      expect(subFn?.isExported).toBe(false);
    });
  });

  describe('Classes, Methods & Constructors', () => {
    it('extracts classes, constructors, and member methods with container relations', () => {
      const code = `
export class UserService {
  private count: number;

  constructor(initial: number) {
    this.count = initial;
  }

  public getUser(id: string): string {
    return 'user_' + id;
  }
}
      `.trim();

      const result = parseSourceFileAST('src/service.ts', code);
      expect(result.symbols.length).toBe(3);

      const classSym = result.symbols.find((s) => s.kind === 'class');
      expect(classSym?.name).toBe('UserService');
      expect(classSym?.isExported).toBe(true);

      const ctorSym = result.symbols.find((s) => s.kind === 'constructor');
      expect(ctorSym).toBeDefined();
      expect(ctorSym?.containerName).toBe('UserService');

      const methodSym = result.symbols.find((s) => s.kind === 'method');
      expect(methodSym?.name).toBe('getUser');
      expect(methodSym?.containerName).toBe('UserService');
    });
  });

  describe('Interfaces, Type Aliases & Enums', () => {
    it('extracts interface, type alias, and enum declarations', () => {
      const code = `
export interface UserProfile {
  id: string;
  name: string;
}

export type UserRole = 'admin' | 'member';

export enum Status {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE'
}
      `.trim();

      const result = parseSourceFileAST('src/types.ts', code);
      expect(result.symbols.length).toBe(3);

      const iface = result.symbols.find((s) => s.kind === 'interface');
      expect(iface?.name).toBe('UserProfile');
      expect(iface?.isExported).toBe(true);

      const typeAlias = result.symbols.find((s) => s.kind === 'type');
      expect(typeAlias?.name).toBe('UserRole');
      expect(typeAlias?.isExported).toBe(true);

      const enumSym = result.symbols.find((s) => s.kind === 'enum');
      expect(enumSym?.name).toBe('Status');
      expect(enumSym?.isExported).toBe(true);
    });
  });

  describe('Imports and Exports', () => {
    it('extracts default, named, and namespace imports and export statements with structured metadata', () => {
      const code = `
import React, { useState, useEffect as useAsyncEffect } from 'react';
import * as path from 'path';
import './polyfills.js';

export { useState };
export { formatTime as renderTime } from './time.js';
export * from './constants.js';
export * as helpers from './helpers.js';
const value = 42;
export default value;
      `.trim();

      const result = parseSourceFileAST('src/imports.ts', code);
      expect(result.error).toBeNull();

      const imports = result.symbols.filter((s) => s.kind === 'import');
      expect(imports.length).toBe(5);

      const reactDefault = imports.find((i) => i.localName === 'React');
      expect(reactDefault).toBeDefined();
      expect(reactDefault?.importKind).toBe('default');
      expect(reactDefault?.importedName).toBe('default');
      expect(reactDefault?.moduleSpecifier).toBe('react');

      const namedUseState = imports.find((i) => i.localName === 'useState');
      expect(namedUseState).toBeDefined();
      expect(namedUseState?.importKind).toBe('named');
      expect(namedUseState?.importedName).toBe('useState');
      expect(namedUseState?.moduleSpecifier).toBe('react');

      const aliasedEffect = imports.find((i) => i.localName === 'useAsyncEffect');
      expect(aliasedEffect).toBeDefined();
      expect(aliasedEffect?.importKind).toBe('named');
      expect(aliasedEffect?.importedName).toBe('useEffect');
      expect(aliasedEffect?.localName).toBe('useAsyncEffect');
      expect(aliasedEffect?.moduleSpecifier).toBe('react');

      const nsImport = imports.find((i) => i.localName === 'path');
      expect(nsImport).toBeDefined();
      expect(nsImport?.importKind).toBe('namespace');
      expect(nsImport?.importedName).toBe('*');
      expect(nsImport?.moduleSpecifier).toBe('path');

      const sideEffect = imports.find((i) => i.importKind === 'side-effect');
      expect(sideEffect).toBeDefined();
      expect(sideEffect?.moduleSpecifier).toBe('./polyfills.js');

      const exports = result.symbols.filter((s) => s.kind === 'export');
      expect(exports.length).toBe(5);

      const localExp = exports.find((e) => e.name === 'useState');
      expect(localExp?.exportKind).toBe('named');
      expect(localExp?.isReExport).toBe(false);

      const reExport = exports.find((e) => e.name === 'formatTime');
      expect(reExport?.exportKind).toBe('named');
      expect(reExport?.exportAlias).toBe('renderTime');
      expect(reExport?.isReExport).toBe(true);
      expect(reExport?.reExportModule).toBe('./time.js');

      const exportAll = exports.find((e) => e.name === '*' && e.exportKind === 'all');
      expect(exportAll?.isReExport).toBe(true);
      expect(exportAll?.reExportModule).toBe('./constants.js');

      const exportAllNs = exports.find((e) => e.name === 'helpers' && e.exportKind === 'all');
      expect(exportAllNs?.exportAlias).toBe('helpers');
      expect(exportAllNs?.isReExport).toBe(true);
      expect(exportAllNs?.reExportModule).toBe('./helpers.js');

      const defaultExp = exports.find((e) => e.exportKind === 'default');
      expect(defaultExp).toBeDefined();
      expect(defaultExp?.isReExport).toBe(false);
    });
  });

  describe('Destructured Variables & Class Properties', () => {
    it('unpacks object and array destructured variables into individual symbols', () => {
      const code = `
const { alpha, beta: renamedBeta, nested: { gamma } } = getConfig();
const [firstItem, secondItem] = items;
      `.trim();

      const result = parseSourceFileAST('src/destructure.ts', code);
      expect(result.error).toBeNull();

      const varNames = result.symbols.map((s) => s.name);
      expect(varNames).toContain('alpha');
      expect(varNames).toContain('renamedBeta');
      expect(varNames).toContain('gamma');
      expect(varNames).toContain('firstItem');
      expect(varNames).toContain('secondItem');

      // None of the misleading composite names should exist
      expect(varNames.some((n) => n.includes('{') || n.includes('}'))).toBe(false);
      expect(varNames.some((n) => n.includes('[') || n.includes(']'))).toBe(false);
    });

    it('extracts class property functions and handles computed property names', () => {
      const code = `
const COMPUTED_KEY = 'customKey';

export class ServiceHandler {
  public directMethod(): string {
    return 'direct';
  }

  public arrowHandler = (id: string): number => {
    return id.length;
  };

  public [COMPUTED_KEY]() {
    return 42;
  }
}
      `.trim();

      const result = parseSourceFileAST('src/service.ts', code);
      expect(result.error).toBeNull();

      const methods = result.symbols.filter((s) => s.kind === 'method');
      expect(methods.some((m) => m.name === 'directMethod' && m.containerName === 'ServiceHandler')).toBe(true);
      expect(methods.some((m) => m.name === 'arrowHandler' && m.containerName === 'ServiceHandler')).toBe(true);
      expect(methods.some((m) => m.name === '[COMPUTED_KEY]' && m.containerName === 'ServiceHandler')).toBe(true);
    });

  describe('Snapshot-Scoped Symbol Identity', () => {
    it('distinguishes identical symbol names across different files', () => {
      const codeA = `export function process(): void {}`;
      const codeB = `export function process(): void {}`;

      const resultA = parseSourceFileAST('src/services/alpha.ts', codeA);
      const resultB = parseSourceFileAST('src/services/beta.ts', codeB);

      const symA = resultA.symbols.find((s) => s.name === 'process');
      const symB = resultB.symbols.find((s) => s.name === 'process');

      expect(symA?.symbolKey).toBe('src/services/alpha.ts#process:function:1:1');
      expect(symB?.symbolKey).toBe('src/services/beta.ts#process:function:1:1');
      expect(symA?.symbolKey).not.toBe(symB?.symbolKey);
    });

    it('distinguishes identical symbol names across different container scopes in the same file', () => {
      const code = `
export class User {
  public validate(): boolean { return true; }
}

export class Order {
  public validate(): boolean { return false; }
}

export function validate(): boolean {
  function validate(): boolean { return true; }
  return validate();
}
      `.trim();

      const result = parseSourceFileAST('src/models.ts', code);
      const userValidate = result.symbols.find((s) => s.containerName === 'User' && s.name === 'validate');
      const orderValidate = result.symbols.find((s) => s.containerName === 'Order' && s.name === 'validate');
      const outerValidate = result.symbols.find((s) => s.containerName === null && s.kind === 'function' && s.name === 'validate');
      const nestedValidate = result.symbols.find((s) => s.containerName === 'validate' && s.kind === 'function' && s.name === 'validate');

      expect(userValidate?.symbolKey).toBe('src/models.ts#User.validate:method:2:3');
      expect(orderValidate?.symbolKey).toBe('src/models.ts#Order.validate:method:6:3');
      expect(outerValidate?.symbolKey).toBe('src/models.ts#validate:function:9:1');
      expect(nestedValidate?.symbolKey).toBe('src/models.ts#validate.validate:function:10:3');

      const allKeys = [userValidate?.symbolKey, orderValidate?.symbolKey, outerValidate?.symbolKey, nestedValidate?.symbolKey];
      const uniqueKeys = new Set(allKeys);
      expect(uniqueKeys.size).toBe(4);
    });

    it('demonstrates that shifting line positions changes the snapshot key (not a cross-commit identity)', () => {
      const beforeCode = `export function compute(): number { return 1; }`;
      const afterCode = `\n\nexport function compute(): number { return 1; }`;

      const before = parseSourceFileAST('src/math.ts', beforeCode);
      const after = parseSourceFileAST('src/math.ts', afterCode);

      const beforeKey = before.symbols[0]?.symbolKey;
      const afterKey = after.symbols[0]?.symbolKey;

      expect(beforeKey).toBe('src/math.ts#compute:function:1:1');
      expect(afterKey).toBe('src/math.ts#compute:function:3:1');
      expect(beforeKey).not.toBe(afterKey);
    });
  });

  describe('TSX Parsing', () => {
    it('extracts functional components and JSX elements in TSX files', () => {
      const code = `
import React from 'react';

export interface ButtonProps {
  label: string;
}

export function ActionButton(props: ButtonProps) {
  return <button>{props.label}</button>;
}
      `.trim();

      const result = parseSourceFileAST('src/Button.tsx', code);
      expect(result.error).toBeNull();

      const btnFn = result.symbols.find((s) => s.name === 'ActionButton');
      expect(btnFn).toBeDefined();
      expect(btnFn?.kind).toBe('function');
      expect(btnFn?.isExported).toBe(true);
      expect(btnFn?.file).toBe('src/Button.tsx');
    });
  });

  describe('Malformed Source Files & Error Resiliency', () => {
    it('parses available valid symbols from malformed files without crashing', () => {
      const malformedCode = `
export function validFunction(): string {
  return 'ok';
}

// Incomplete syntax error below:
export class BrokenClass {
  constructor(
      `.trim();

      const result = parseSourceFileAST('src/broken.ts', malformedCode);
      expect(result.error).toBeNull();
      expect(result.parseDiagnostics.length).toBeGreaterThan(0);

      const validFn = result.symbols.find((s) => s.name === 'validFunction');
      expect(validFn).toBeDefined();
      expect(validFn?.kind).toBe('function');
    });
  });
});
});
