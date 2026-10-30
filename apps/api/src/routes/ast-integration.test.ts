import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { loadConfig } from '../config.js';
import { executeAstExtractionForAnalysis } from './analyses.js';
import { createAnalysis } from '../repo/index.js';

describe('Commit-Aware TypeScript & TSX AST Extraction End-to-End', () => {
  let app: FastifyInstance;
  let allowedParentDir: string;
  let repoDir: string;
  let baseSha: string;
  let headSha: string;
  let repoId: string;

  function git(cmdRepo: string, ...args: string[]) {
    return execFileSync('git', args, { cwd: cmdRepo, encoding: 'utf8' }).trim();
  }

  beforeAll(async () => {
    allowedParentDir = realpathSync(mkdtempSync(path.join(tmpdir(), 'devos-ast-root-')));
    repoDir = path.join(allowedParentDir, 'ast-sample-repo');
    execFileSync('mkdir', ['-p', repoDir]);
    repoDir = realpathSync(repoDir);

    git(repoDir, 'init', '-q');
    git(repoDir, 'config', 'user.email', 'ast-tester@devos.dev');
    git(repoDir, 'config', 'user.name', 'Devos AST Tester');

    // Commit 1 (base): initial base files
    writeFileSync(path.join(repoDir, 'old-file.ts'), 'export const oldFlag = 1;\n');
    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-q', '-m', 'Base commit');
    baseSha = git(repoDir, 'rev-parse', 'HEAD');

    // Commit 2 (head): TS and TSX files with classes, functions, interfaces, enums, malformed and non-ts files
    execFileSync('mkdir', ['-p', path.join(repoDir, 'src')]);

    writeFileSync(
      path.join(repoDir, 'src/math.ts'),
      `
export interface Calculator {
  calculate(x: number, y: number): number;
}

export type MathOp = 'add' | 'multiply';

export enum MathMode {
  Standard = 'STD',
  Scientific = 'SCI',
}

export class BasicCalculator implements Calculator {
  public mode: MathMode;

  constructor(mode: MathMode) {
    this.mode = mode;
  }

  public calculate(x: number, y: number): number {
    return x + y;
  }
}

export const defaultMultiplier = (val: number): number => val * 2;
      `.trim() + '\n'
    );

    writeFileSync(
      path.join(repoDir, 'src/Widget.tsx'),
      `
import React, { useState } from 'react';

export interface WidgetProps {
  title: string;
}

export function Widget(props: WidgetProps) {
  const [active, setActive] = useState(false);
  return <div onClick={() => setActive(!active)}>{props.title}</div>;
}
      `.trim() + '\n'
    );

    writeFileSync(
      path.join(repoDir, 'src/malformed.ts'),
      `
export function intactHeader(): boolean {
  return true;
}

// Incomplete syntax
export class Broken {
  public broken(
      `.trim() + '\n'
    );

    // Unsupported and deleted files
    writeFileSync(path.join(repoDir, 'README.md'), '# AST Test Repo\n');
    writeFileSync(path.join(repoDir, 'data.json'), '{"test": true}\n');
    git(repoDir, 'rm', '-q', 'old-file.ts');

    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-q', '-m', 'Head commit with comprehensive AST fixtures');
    headSha = git(repoDir, 'rev-parse', 'HEAD');

    // Fastify app configured with allowed parent directory
    app = await buildApp({
      logger: false,
      appConfig: loadConfig({
        ALLOWED_REPO_ROOT: allowedParentDir,
      }),
    });

    await app.ready();

    // Register repository
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/repositories',
      payload: {
        name: 'ast-sample-repo',
        path: repoDir,
      },
    });
    expect(regRes.statusCode).toBe(201);
    repoId = regRes.json().id;
  });

  afterAll(async () => {
    await app.close();
    if (repoId) {
      await prisma.repository.deleteMany({
        where: { id: repoId },
      });
    }
    await prisma.$disconnect();
    rmSync(allowedParentDir, { recursive: true, force: true });
  });

  it('extracts real TypeScript and TSX symbols, associating them with the analysis', async () => {
    const analysisRes = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha,
        headSha,
      },
    });

    expect(analysisRes.statusCode).toBe(201);
    const job = analysisRes.json();
    expect(job.status).toBe('running');
    expect(job.finishedAt).toBeNull();
    const analysisId = job.id;

    // Query persisted symbols
    const symbols = await prisma.symbol.findMany({
      where: { analysisId },
      orderBy: { lineStart: 'asc' },
    });

    expect(symbols.length).toBeGreaterThan(0);

    // Verify provenance fields on every extracted symbol
    for (const sym of symbols) {
      expect(sym.repositoryId).toBe(repoId);
      expect(sym.analysisId).toBe(analysisId);
      expect(sym.commitSha).toBe(headSha);
      expect(sym.collector).toBe('ast-collector');
      expect(sym.lineStart).toBeGreaterThan(0);
      expect(sym.lineEnd).toBeGreaterThanOrEqual(sym.lineStart);
      expect(sym.symbolKey).toBeDefined();
      expect(sym.symbolKey).toContain(sym.file);
      expect(sym.symbolKey).toContain(sym.name);
    }

    // Verify classes, methods, constructors, interfaces, types, enums, functions
    const mathSymbols = symbols.filter((s) => s.file === 'src/math.ts');
    expect(mathSymbols.some((s) => s.name === 'Calculator' && s.kind === 'interface')).toBe(true);
    expect(mathSymbols.some((s) => s.name === 'MathOp' && s.kind === 'type')).toBe(true);
    expect(mathSymbols.some((s) => s.name === 'MathMode' && s.kind === 'enum')).toBe(true);
    expect(mathSymbols.some((s) => s.name === 'BasicCalculator' && s.kind === 'class')).toBe(true);
    expect(mathSymbols.some((s) => s.name === 'constructor' && s.kind === 'constructor' && s.containerName === 'BasicCalculator')).toBe(true);
    expect(mathSymbols.some((s) => s.name === 'calculate' && s.kind === 'method' && s.containerName === 'BasicCalculator')).toBe(true);
    expect(mathSymbols.some((s) => s.name === 'defaultMultiplier' && s.kind === 'function')).toBe(true);

    // Verify TSX symbols
    const tsxSymbols = symbols.filter((s) => s.file === 'src/Widget.tsx');
    expect(tsxSymbols.some((s) => s.name === 'Widget' && s.kind === 'function')).toBe(true);
    expect(tsxSymbols.some((s) => s.name === 'WidgetProps' && s.kind === 'interface')).toBe(true);
    const useStateImport = tsxSymbols.find((s) => s.name === 'useState' && s.kind === 'import');
    expect(useStateImport).toBeDefined();
    expect(useStateImport?.importKind).toBe('named');
    expect(useStateImport?.importedName).toBe('useState');
    expect(useStateImport?.localName).toBe('useState');
    expect(useStateImport?.moduleSpecifier).toBe('react');

    const reactImport = tsxSymbols.find((s) => s.name === 'React' && s.kind === 'import');
    expect(reactImport).toBeDefined();
    expect(reactImport?.importKind).toBe('default');
    expect(reactImport?.importedName).toBe('default');
    expect(reactImport?.moduleSpecifier).toBe('react');

    // Verify malformed file extracts intact header function without crashing
    const malformedSymbols = symbols.filter((s) => s.file === 'src/malformed.ts');
    expect(malformedSymbols.some((s) => s.name === 'intactHeader' && s.kind === 'function')).toBe(true);

    // Verify no symbols extracted for unsupported files (.md, .json) or deleted files (old-file.ts)
    expect(symbols.some((s) => s.file === 'README.md')).toBe(false);
    expect(symbols.some((s) => s.file === 'data.json')).toBe(false);
    expect(symbols.some((s) => s.file === 'old-file.ts')).toBe(false);

    // Verify honest investigation record stage:
    // With src/malformed.ts present, honest reporting sets stage 'ast_extraction_partial' and attaches metrics
    const investigation = await prisma.investigation.findFirst({
      where: { analysisId, stage: 'ast_extraction_partial' },
    });
    expect(investigation).not.toBeNull();
    expect(investigation?.collector).toBe('ast-collector');
    expect(investigation?.status).toBe('in_progress');
    const parsedDiag = JSON.parse(investigation?.error ?? '{}');
    expect(parsedDiag.metrics.parseErrors).toBeGreaterThan(0);
    expect(parsedDiag.metrics.filesProcessed).toBeGreaterThan(0);
  });

  it('reads source files from the Git commit, unaffected by subsequent working tree changes', async () => {
    // Intentionally mutate the file in the working tree (overwrite with junk)
    const targetFile = path.join(repoDir, 'src/math.ts');
    writeFileSync(targetFile, '// MUTATED WORKING TREE CONTENT: completely wiped out\n');

    // Run analysis targeting headSha
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha,
        headSha,
      },
    });

    expect(res.statusCode).toBe(201);
    const analysisId = res.json().id;

    // The extracted symbols MUST match the committed code at headSha, NOT the wiped working tree
    const symbols = await prisma.symbol.findMany({
      where: { analysisId, file: 'src/math.ts' },
    });

    expect(symbols.length).toBeGreaterThan(0);
    expect(symbols.some((s) => s.name === 'BasicCalculator')).toBe(true);
    expect(symbols.some((s) => s.name === 'Calculator')).toBe(true);

    // Restore working tree file
    git(repoDir, 'checkout', 'HEAD', '--', 'src/math.ts');
  });

  it('handles retry behavior idempotently without duplicate symbol accumulation', async () => {
    // First run
    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha,
        headSha,
      },
    });
    const firstAnalysisId = firstRes.json().id;
    const firstCount = await prisma.symbol.count({ where: { analysisId: firstAnalysisId } });
    expect(firstCount).toBeGreaterThan(0);

    // Second run
    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha,
        headSha,
      },
    });
    const secondAnalysisId = secondRes.json().id;
    const secondCount = await prisma.symbol.count({ where: { analysisId: secondAnalysisId } });

    expect(secondCount).toBe(firstCount);
  });

  it('records ast_extraction_complete and extracts unchanged files across repository in clean repo', async () => {
    // Remove the malformed file and commit a clean state
    git(repoDir, 'rm', '-q', 'src/malformed.ts');
    writeFileSync(path.join(repoDir, 'src/unchanged.ts'), 'export const unchangedValue = 100;\n');
    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-q', '-m', 'Clean state commit with unchanged file');
    const cleanHead1 = git(repoDir, 'rev-parse', 'HEAD');

    // Make another commit modifying only math.ts
    writeFileSync(path.join(repoDir, 'src/math.ts'), 'export const newMathVal = 999;\n');
    git(repoDir, 'add', 'src/math.ts');
    git(repoDir, 'commit', '-q', '-m', 'Modify math only');
    const cleanHead2 = git(repoDir, 'rev-parse', 'HEAD');

    const cleanRes = await app.inject({
      method: 'POST',
      url: '/api/analyses',
      payload: {
        repositoryId: repoId,
        baseSha: cleanHead1,
        headSha: cleanHead2,
      },
    });

    expect(cleanRes.statusCode).toBe(201);
    const cleanAnalysisId = cleanRes.json().id;

    // Verify ast_extraction_complete stage
    const investigation = await prisma.investigation.findFirst({
      where: { analysisId: cleanAnalysisId, stage: 'ast_extraction_complete' },
    });
    expect(investigation).not.toBeNull();
    expect(investigation?.error).toBeNull();

    // Verify repository-wide extraction extracted symbols from UNCHANGED file (src/unchanged.ts)
    const unchangedSymbol = await prisma.symbol.findFirst({
      where: { analysisId: cleanAnalysisId, file: 'src/unchanged.ts' },
    });
    expect(unchangedSymbol).not.toBeNull();
    expect(unchangedSymbol?.name).toBe('unchangedValue');
  });

  describe('Extraction and Persistence Failure Handling & Retry Semantics', () => {
    it('records failure and updates analysis when Git ingestion succeeds but AST extraction fails', async () => {
      // Create analysis to simulate successful Git ingestion
      const analysis = await createAnalysis({
        repositoryId: repoId,
        baseSha,
        headSha,
        status: 'running',
        startedAt: new Date(),
        finishedAt: null,
      });

      // Pass an invalid headSha to trigger extraction failure
      const result = await executeAstExtractionForAnalysis({
        analysisId: analysis.id,
        repositoryId: repoId,
        repoPath: repoDir,
        baseSha,
        headSha: '0000000000000000000000000000000000000000',
      });

      expect(result.success).toBe(false);
      expect(result.stage).toBe('ast_extraction_failed');

      // Verify analysis record was marked failed with error and finish timestamp
      const updatedAnalysis = await prisma.analysis.findUnique({
        where: { id: analysis.id },
      });
      expect(updatedAnalysis?.status).toBe('failed');
      expect(updatedAnalysis?.finishedAt).not.toBeNull();
      expect(updatedAnalysis?.error).toContain('AST extraction failed');

      // Verify investigation record retains failure details
      const failureInv = await prisma.investigation.findFirst({
        where: { analysisId: analysis.id, stage: 'ast_extraction_failed' },
      });
      expect(failureInv).not.toBeNull();
      expect(failureInv?.status).toBe('failed');
      const errDetails = JSON.parse(failureInv?.error ?? '{}');
      expect(errDetails.error).toBeDefined();
    });

    it('demonstrates that partial extraction is not reported as complete when one file fails', async () => {
      // Add a malformed file alongside clean files
      writeFileSync(path.join(repoDir, 'src/broken_partial.ts'), 'export const broken = (;\n');
      git(repoDir, 'add', 'src/broken_partial.ts');
      git(repoDir, 'commit', '-q', '-m', 'Commit with partial failure file');
      const partialHead = git(repoDir, 'rev-parse', 'HEAD');

      const analysis = await createAnalysis({
        repositoryId: repoId,
        baseSha,
        headSha: partialHead,
        status: 'running',
        startedAt: new Date(),
        finishedAt: null,
      });

      const result = await executeAstExtractionForAnalysis({
        analysisId: analysis.id,
        repositoryId: repoId,
        repoPath: repoDir,
        baseSha,
        headSha: partialHead,
      });

      expect(result.success).toBe(true);
      expect(result.stage).toBe('ast_extraction_partial');
      expect(result.status).toBe('in_progress');

      // Check analysis: stays 'running' with finishedAt null (no false successful completion timestamp)
      const currentAnalysis = await prisma.analysis.findUnique({
        where: { id: analysis.id },
      });
      expect(currentAnalysis?.status).toBe('running');
      expect(currentAnalysis?.finishedAt).toBeNull();

      // Check investigation record
      const partialInv = await prisma.investigation.findFirst({
        where: { analysisId: analysis.id, stage: 'ast_extraction_partial' },
      });
      expect(partialInv).not.toBeNull();
      const payload = JSON.parse(partialInv?.error ?? '{}');
      expect(payload.metrics.parseErrors).toBeGreaterThan(0);
      expect(payload.metrics.filesProcessed).toBeGreaterThan(0);

      // Clean up broken file
      git(repoDir, 'rm', '-q', 'src/broken_partial.ts');
      git(repoDir, 'commit', '-q', '-m', 'Remove broken partial file');
    });

    it('handles AST persistence failure after parsing without corrupting state', async () => {
      const analysis = await createAnalysis({
        repositoryId: repoId,
        baseSha,
        headSha,
        status: 'running',
        startedAt: new Date(),
        finishedAt: null,
      });

      // Mock client whose $transaction rejects to simulate DB persistence failure
      const mockFailingClient = {
        ...prisma,
        $transaction: async () => {
          throw new Error('Database disk I/O error during symbol batch write');
        },
      } as unknown as typeof prisma;

      const result = await executeAstExtractionForAnalysis(
        {
          analysisId: analysis.id,
          repositoryId: repoId,
          repoPath: repoDir,
          baseSha,
          headSha,
        },
        mockFailingClient
      );

      expect(result.success).toBe(false);
      expect(result.stage).toBe('ast_extraction_failed');

      // Verify analysis and investigation record failure
      const failedAnalysis = await prisma.analysis.findUnique({
        where: { id: analysis.id },
      });
      expect(failedAnalysis?.status).toBe('failed');
      expect(failedAnalysis?.finishedAt).not.toBeNull();
      expect(failedAnalysis?.error).toContain('Database disk I/O error');
    });

    it('supports idempotent re-extraction of an existing analysis without symbol accumulation', async () => {
      const cleanHead = git(repoDir, 'rev-parse', 'HEAD');

      const analysis = await createAnalysis({
        repositoryId: repoId,
        baseSha,
        headSha: cleanHead,
        status: 'running',
        startedAt: new Date(),
        finishedAt: null,
      });

      // Run 1
      const res1 = await executeAstExtractionForAnalysis({
        analysisId: analysis.id,
        repositoryId: repoId,
        repoPath: repoDir,
        baseSha,
        headSha: cleanHead,
      });
      expect(res1.success).toBe(true);
      const count1 = await prisma.symbol.count({ where: { analysisId: analysis.id } });
      expect(count1).toBeGreaterThan(0);

      // Run 2: Re-extract for the exact same analysisId
      const res2 = await executeAstExtractionForAnalysis({
        analysisId: analysis.id,
        repositoryId: repoId,
        repoPath: repoDir,
        baseSha,
        headSha: cleanHead,
      });
      expect(res2.success).toBe(true);
      const count2 = await prisma.symbol.count({ where: { analysisId: analysis.id } });

      // Verifies deleteSymbolsByAnalysis wiped prior symbols before re-insertion: no duplicates!
      expect(count2).toBe(count1);
    });
  });
});
