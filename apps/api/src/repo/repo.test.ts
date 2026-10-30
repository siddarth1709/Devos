import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  createRepository,
  getRepositoryById,
  getRepositoryByPath,
  listRepositories,
  updateRepository,
  deleteRepository,
  createAnalysis,
  getAnalysisById,
  getAnalysisWithRelations,
  listAnalysesByRepository,
  updateAnalysis,
  deleteAnalysis,
  createEvidence,
  getEvidenceById,
  listEvidenceByAnalysis,
  updateEvidence,
  deleteEvidence,
  createFinding,
  getFindingById,
  listFindingsByAnalysis,
  updateFinding,
  linkFindingToEvidence,
  createChangedFile,
  listChangedFilesByAnalysis,
  createSymbol,
  listSymbolsByRepository,
  createDependencyNode,
  listDependencyNodesByAnalysis,
  createDependencyEdge,
  createDependencyEdges,
  listDependencyEdgesByAnalysis,
  deleteDependencyEdgesByAnalysis,
  deleteDependencyNodesByAnalysis,
  createHypothesis,
  listHypothesesByAnalysis,
  createRecommendation,
  listRecommendationsByAnalysis,
  createActionExecution,
  getActionExecutionById,
  listActionExecutions,
  updateActionExecution,
  createInvestigation,
  getInvestigationByAnalysis,
  createRejectedClaim,
  listRejectedClaimsByAnalysis,
  saveAnalysisBatch,
} from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Typed Data-Access Layer & Prisma Persistence', () => {
  let testPrisma: PrismaClient;
  let tempDbPath: string;

  beforeAll(async () => {
    // Generate unique temporary SQLite database file
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    tempDbPath = path.join(os.tmpdir(), `devos_test_${uniqueSuffix}.db`);

    testPrisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${tempDbPath}`,
        },
      },
    });

    // Read and apply all migration SQL files in order
    const migrationsDir = path.resolve(__dirname, '../../prisma/migrations');
    const migrationDirs = fs
      .readdirSync(migrationsDir)
      .filter((d) => fs.statSync(path.join(migrationsDir, d)).isDirectory())
      .sort();

    for (const dir of migrationDirs) {
      const sqlFile = path.join(migrationsDir, dir, 'migration.sql');
      if (fs.existsSync(sqlFile)) {
        const migrationSql = fs.readFileSync(sqlFile, 'utf8');
        const statements = migrationSql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        for (const statement of statements) {
          await testPrisma.$executeRawUnsafe(statement);
        }
      }
    }
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
    if (fs.existsSync(tempDbPath)) {
      try {
        fs.unlinkSync(tempDbPath);
      } catch {
        // Ignore file lock cleanup errors on process exit
      }
    }
  });

  describe('Repository Model Operations', () => {
    it('creates, retrieves by ID and path, updates, and lists repositories', async () => {
      const repo = await createRepository(
        {
          name: 'kernel-core',
          path: '/repos/kernel-core',
          defaultBranch: 'main',
        },
        testPrisma
      );

      expect(repo.id).toBeDefined();
      expect(repo.name).toBe('kernel-core');

      const byId = await getRepositoryById(repo.id, testPrisma);
      expect(byId?.name).toBe('kernel-core');

      const byPath = await getRepositoryByPath('/repos/kernel-core', testPrisma);
      expect(byPath?.id).toBe(repo.id);

      const updated = await updateRepository(
        repo.id,
        { defaultBranch: 'develop' },
        testPrisma
      );
      expect(updated.defaultBranch).toBe('develop');

      const list = await listRepositories(testPrisma);
      expect(list.some((r) => r.id === repo.id)).toBe(true);
    });
  });

  describe('Analysis and Artifact CRUD Operations', () => {
    it('creates and updates an analysis with collector metadata and derived records', async () => {
      const repo = await createRepository(
        {
          name: 'service-auth',
          path: '/repos/service-auth',
        },
        testPrisma
      );

      const baseSha = '1111111111111111111111111111111111111111';
      const headSha = '2222222222222222222222222222222222222222';
      const collector = 'git-diff-collector';

      const analysis = await createAnalysis(
        {
          repositoryId: repo.id,
          baseSha,
          headSha,
          status: 'running',
          startedAt: new Date(),
        },
        testPrisma
      );
      expect(analysis.id).toBeDefined();
      expect(analysis.status).toBe('running');

      // ChangedFile
      const changedFile = await createChangedFile(
        {
          analysisId: analysis.id,
          path: 'src/auth.ts',
          changeType: 'modified',
          baseSha,
          headSha,
          collector,
        },
        testPrisma
      );
      expect(changedFile.id).toBeDefined();

      // Symbol
      const sym = await createSymbol(
        {
          repositoryId: repo.id,
          symbolKey: 'src/auth.ts#authenticateUser:function:12:1',
          name: 'authenticateUser',
          kind: 'function',
          file: 'src/auth.ts',
          lineStart: 12,
          lineEnd: 45,
          isExported: true,
          importKind: null,
          importedName: null,
          localName: null,
          moduleSpecifier: null,
          exportKind: 'named',
          exportAlias: null,
          isReExport: false,
          reExportModule: null,
          metadata: JSON.stringify({ verified: true }),
          commitSha: headSha,
          collector: 'ast-collector',
        },
        testPrisma
      );
      expect(sym.id).toBeDefined();
      expect(sym.symbolKey).toBe('src/auth.ts#authenticateUser:function:12:1');
      expect(sym.isExported).toBe(true);
      expect(sym.exportKind).toBe('named');

      // DependencyEdge
      const dep = await createDependencyEdge(
        {
          analysisId: analysis.id,
          repositoryId: repo.id,
          edgeKey: 'src/auth.ts->src/crypto.ts:imports_module:2:1',
          from: 'file:src/auth.ts',
          to: 'file:src/crypto.ts',
          kind: 'imports_module',
          sourceFile: 'src/auth.ts',
          sourceLine: 2,
          commitSha: headSha,
          collector: 'dependency-graph-builder',
        },
        testPrisma
      );
      expect(dep.id).toBeDefined();

      const node = await createDependencyNode(
        {
          analysisId: analysis.id,
          nodeKey: 'file:src/auth.ts',
          nodeType: 'file',
          name: 'auth.ts',
          path: 'src/auth.ts',
          repositoryId: repo.id,
          commitSha: headSha,
          collector: 'dependency-graph-builder',
        },
        testPrisma
      );
      expect(node.id).toBeDefined();

      const nodes = await listDependencyNodesByAnalysis(analysis.id, testPrisma);
      expect(nodes.length).toBe(1);

      // Evidence
      const evidence = await createEvidence(
        {
          analysisId: analysis.id,
          type: 'diff',
          sourceCommit: headSha,
          file: 'src/auth.ts',
          lineStart: 15,
          lineEnd: 20,
          symbol: 'authenticateUser',
          collector,
          payload: JSON.stringify({ diffHunk: '@@ -15,5 +15,6 @@' }),
        },
        testPrisma
      );
      expect(evidence.id).toBeDefined();

      // Finding linked to Evidence
      const finding = await createFinding(
        {
          analysisId: analysis.id,
          title: 'Unchecked return value',
          severity: 'medium',
          description: 'Async promise return value is unhandled.',
          origin: 'deterministic',
          status: 'confirmed',
          confidence: 'High',
          baseSha,
          headSha,
          collector: 'static-linter',
          evidenceIds: [evidence.id],
        },
        testPrisma
      );
      expect(finding.id).toBeDefined();

      // Hypothesis
      const hypothesis = await createHypothesis(
        {
          analysisId: analysis.id,
          title: 'Possible regression in session token renewal',
          description: 'Token lifetime logic modified without timeout guard.',
          rationale: 'Diff shows removed expiration check.',
          status: 'proposed',
          confidence: 'Medium',
          baseSha,
          headSha,
          collector: 'gemma-analyzer',
        },
        testPrisma
      );
      expect(hypothesis.id).toBeDefined();

      // Recommendation
      const recommendation = await createRecommendation(
        {
          analysisId: analysis.id,
          title: 'Add session expiration unit test',
          description: 'Ensure token expires after configured duration.',
          priority: 'high',
          suggestedAction: 'scaffold_test',
          rationale: 'Prevents indefinite session lifetime.',
          baseSha,
          headSha,
          collector: 'rule-engine',
        },
        testPrisma
      );
      expect(recommendation.id).toBeDefined();

      // Investigation
      const investigation = await createInvestigation(
        {
          analysisId: analysis.id,
          status: 'in_progress',
          stage: 'evidence_gathering',
          baseSha,
          headSha,
          collector: 'orchestrator',
        },
        testPrisma
      );
      expect(investigation.id).toBeDefined();

      // RejectedClaim
      const rejectedClaim = await createRejectedClaim(
        {
          analysisId: analysis.id,
          findingRef: finding.id,
          reason: 'Falsified by existing unit test in auth.test.ts',
          claimText: 'Function is susceptible to null pointer exception',
          baseSha,
          headSha,
          collector: 'verifier',
        },
        testPrisma
      );
      expect(rejectedClaim.id).toBeDefined();

      // ActionExecution
      const action = await createActionExecution(
        {
          analysisId: analysis.id,
          actionName: 'run_tests',
          params: JSON.stringify({ pattern: 'auth' }),
          status: 'pending',
          commitSha: headSha,
          collector: 'action-agent',
        },
        testPrisma
      );
      expect(action.id).toBeDefined();

      const updatedAction = await updateActionExecution(
        action.id,
        {
          status: 'executed',
          approvedBy: 'reviewer-1',
          approvedAt: new Date(),
          output: JSON.stringify({ pass: true }),
        },
        testPrisma
      );
      expect(updatedAction.status).toBe('executed');
      expect(updatedAction.approvedBy).toBe('reviewer-1');
    });
  });

  describe('Transactional Multi-Record Writes', () => {
    it('saves a full analysis bundle atomically in a transaction', async () => {
      const repo = await createRepository(
        {
          name: 'tx-repo',
          path: '/repos/tx-repo',
        },
        testPrisma
      );

      const baseSha = '3333333333333333333333333333333333333333';
      const headSha = '4444444444444444444444444444444444444444';
      const collector = 'batch-collector';

      const result = await saveAnalysisBatch(
        {
          analysis: {
            repositoryId: repo.id,
            baseSha,
            headSha,
            status: 'done',
          },
          changedFiles: [
            {
              path: 'lib/db.ts',
              changeType: 'modified',
              baseSha,
              headSha,
              collector,
            },
          ],
          evidences: [
            {
              type: 'source',
              sourceCommit: headSha,
              file: 'lib/db.ts',
              collector,
              payload: JSON.stringify({ snippet: 'export const db = ...' }),
            },
          ],
          findings: [
            {
              title: 'Connection pool leak',
              severity: 'critical',
              description: 'Pool clients are not released on query error.',
              origin: 'deterministic',
              status: 'confirmed',
              confidence: 'High',
              baseSha,
              headSha,
              collector,
              evidenceIndices: [0],
            },
          ],
          hypotheses: [
            {
              title: 'High memory usage under load',
              description: 'Unclosed connections accumulate in memory.',
              rationale: 'Missing finally block for client.release().',
              status: 'validated',
              confidence: 'High',
              baseSha,
              headSha,
              collector,
            },
          ],
          recommendations: [
            {
              title: 'Wrap client queries in try/finally',
              description: 'Guarantee client.release() execution.',
              priority: 'critical',
              baseSha,
              headSha,
              collector,
            },
          ],
        },
        testPrisma
      );

      expect(result.analysisId).toBeDefined();
      expect(result.evidenceIds.length).toBe(1);
      expect(result.findingIds.length).toBe(1);

      // Verify loaded nested relations
      const fullAnalysis = await getAnalysisWithRelations(result.analysisId, testPrisma);
      expect(fullAnalysis).not.toBeNull();
      expect(fullAnalysis?.changedFiles.length).toBe(1);
      expect(fullAnalysis?.findings.length).toBe(1);
      expect(fullAnalysis?.findings[0].evidences.length).toBe(1);
      expect(fullAnalysis?.findings[0].evidences[0].evidence.id).toBe(result.evidenceIds[0]);
      expect(fullAnalysis?.hypotheses.length).toBe(1);
      expect(fullAnalysis?.recommendations.length).toBe(1);
    });
  });

  describe('Cascade Deletions', () => {
    it('deleting an analysis cascades to changed files, findings, evidences, and hypotheses', async () => {
      const repo = await createRepository(
        {
          name: 'cascade-analysis-repo',
          path: '/repos/cascade-analysis-repo',
        },
        testPrisma
      );

      const baseSha = '5555555555555555555555555555555555555555';
      const headSha = '6666666666666666666666666666666666666666';

      const analysis = await createAnalysis(
        {
          repositoryId: repo.id,
          baseSha,
          headSha,
        },
        testPrisma
      );

      const evidence = await createEvidence(
        {
          analysisId: analysis.id,
          type: 'diff',
          sourceCommit: headSha,
          file: 'a.ts',
          collector: 'cascade-test',
          payload: '{}',
        },
        testPrisma
      );

      const finding = await createFinding(
        {
          analysisId: analysis.id,
          title: 'Test Finding',
          severity: 'low',
          description: 'Testing cascade',
          origin: 'deterministic',
          status: 'confirmed',
          confidence: 'Low',
          baseSha,
          headSha,
          collector: 'cascade-test',
          evidenceIds: [evidence.id],
        },
        testPrisma
      );

      expect(await getFindingById(finding.id, testPrisma)).not.toBeNull();

      // Delete Analysis
      await deleteAnalysis(analysis.id, testPrisma);

      // Verify Analysis is deleted
      expect(await getAnalysisById(analysis.id, testPrisma)).toBeNull();

      // Verify cascaded Finding and Evidence are deleted
      expect(await getFindingById(finding.id, testPrisma)).toBeNull();
      expect(await getEvidenceById(evidence.id, testPrisma)).toBeNull();
    });

    it('deleting a repository cascades to all associated analyses and symbols', async () => {
      const repo = await createRepository(
        {
          name: 'cascade-repo',
          path: '/repos/cascade-repo',
        },
        testPrisma
      );

      const analysis = await createAnalysis(
        {
          repositoryId: repo.id,
          baseSha: '7777777777777777777777777777777777777777',
          headSha: '8888888888888888888888888888888888888888',
        },
        testPrisma
      );

      const symbol = await createSymbol(
        {
          repositoryId: repo.id,
          symbolKey: 'src/main.ts#CascadedSymbol:class:1:1',
          name: 'CascadedSymbol',
          kind: 'class',
          file: 'src/main.ts',
          lineStart: 1,
          lineEnd: 20,
          commitSha: '8888888888888888888888888888888888888888',
          collector: 'cascade-test',
        },
        testPrisma
      );

      expect(await getAnalysisById(analysis.id, testPrisma)).not.toBeNull();

      // Delete repository
      await deleteRepository(repo.id, testPrisma);

      // Verify repository and cascaded entities are deleted
      expect(await getRepositoryById(repo.id, testPrisma)).toBeNull();
      expect(await getAnalysisById(analysis.id, testPrisma)).toBeNull();
      expect(await listSymbolsByRepository(repo.id, testPrisma)).toEqual([]);
    });
  });
});
