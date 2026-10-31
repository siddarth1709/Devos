import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';
import { loadConfig } from '../config.js';

describe('Repository Registration and Git Ingestion Endpoints', () => {
  let app: FastifyInstance;
  let repoDir: string;
  let nonGitDir: string;
  let allowedParentDir: string;
  let baseSha: string;
  let headSha: string;
  let registeredRepoId: string;

  function git(cmdRepo: string, ...args: string[]) {
    return execFileSync('git', args, { cwd: cmdRepo, encoding: 'utf8' }).trim();
  }

  beforeAll(async () => {
    // 1. Create allowed parent directory and real test repositories inside it
    allowedParentDir = realpathSync(mkdtempSync(path.join(tmpdir(), 'devos-root-')));
    repoDir = path.join(allowedParentDir, 'sample-repo');
    execFileSync('mkdir', ['-p', repoDir]);
    repoDir = realpathSync(repoDir);

    nonGitDir = path.join(allowedParentDir, 'empty-dir');
    execFileSync('mkdir', ['-p', nonGitDir]);
    nonGitDir = realpathSync(nonGitDir);

    // Initialize real Git repository with commits
    git(repoDir, 'init', '-q');
    git(repoDir, 'config', 'user.email', 'devos@example.com');
    git(repoDir, 'config', 'user.name', 'Devos Bot');

    writeFileSync(path.join(repoDir, 'file1.ts'), 'export const a = 1;\n');
    writeFileSync(path.join(repoDir, 'deleted.ts'), 'export const obsolete = true;\n');
    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-q', '-m', 'Initial commit');
    baseSha = git(repoDir, 'rev-parse', 'HEAD');

    writeFileSync(path.join(repoDir, 'file1.ts'), 'export const a = 2;\nexport const b = 3;\n');
    writeFileSync(path.join(repoDir, 'file2.ts'), 'export const c = 4;\n');
    git(repoDir, 'rm', '-q', 'deleted.ts');
    git(repoDir, 'add', '.');
    git(repoDir, 'commit', '-q', '-m', 'Second commit with changes');
    headSha = git(repoDir, 'rev-parse', 'HEAD');

    // 2. Build Fastify app configured with allowed repo root
    app = await buildApp({
      logger: false,
      appConfig: loadConfig({
        ALLOWED_REPO_ROOT: allowedParentDir,
      }),
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    // Clean up created records from database
    if (registeredRepoId) {
      await prisma.repository.deleteMany({
        where: { id: registeredRepoId },
      });
    }
    await prisma.$disconnect();

    // Clean up temp directories
    rmSync(allowedParentDir, { recursive: true, force: true });
  });

  describe('Repository Registration & Retrieval', () => {
    it('successfully registers a valid git repository', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/repositories',
        payload: {
          name: 'sample-service',
          path: repoDir,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.id).toBeDefined();
      expect(body.name).toBe('sample-service');
      expect(body.path).toBe(repoDir);
      expect(body.defaultBranch).toBeDefined();
      expect(body.createdAt).toBeDefined();

      registeredRepoId = body.id;
    });

    it('rejects duplicate registration of the same path with 409 Conflict', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/repositories',
        payload: {
          name: 'duplicate-sample',
          path: repoDir,
        },
      });

      expect(response.statusCode).toBe(409);
      const body = response.json();
      expect(body.error.code).toBe('REPO_ALREADY_EXISTS');
    });

    it('rejects a non-existent path with 400 Bad Request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/repositories',
        payload: {
          name: 'non-existent',
          path: path.join(allowedParentDir, 'does-not-exist'),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('INVALID_REPO_PATH');
    });

    it('rejects a directory that is not a git repository with 400 Bad Request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/repositories',
        payload: {
          name: 'not-git',
          path: nonGitDir,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe('INVALID_REPO_PATH');
    });

    it('rejects paths outside the allowed root policy', async () => {
      // Create repo outside allowed root
      const outsideDir = realpathSync(mkdtempSync(path.join(tmpdir(), 'outside-')));
      try {
        const response = await app.inject({
          method: 'POST',
          url: '/api/repositories',
          payload: {
            name: 'outside-repo',
            path: outsideDir,
          },
        });

        expect(response.statusCode).toBe(400);
        const body = response.json();
        expect(body.error.code).toBe('INVALID_REPO_PATH');
      } finally {
        rmSync(outsideDir, { recursive: true, force: true });
      }
    });

    it('lists registered repositories via GET /api/repositories', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/repositories',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body.repositories)).toBe(true);
      expect(body.repositories.some((r: any) => r.id === registeredRepoId)).toBe(true);
    });

    it('retrieves a single repository via GET /api/repositories/:id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/repositories/${registeredRepoId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.id).toBe(registeredRepoId);
      expect(body.name).toBe('sample-service');
      expect(body.path).toBe(repoDir);
    });

    it('returns 404 when retrieving a non-existent repository', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/repositories/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('NOT_FOUND');
    });
  });

  describe('Analysis Creation & Git Diff Ingestion', () => {
    let createdAnalysisId: string;

    it('creates an analysis from real Git commit references and persists changed files', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyses',
        payload: {
          repositoryId: registeredRepoId,
          baseSha: 'HEAD~1',
          headSha: 'HEAD',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.id).toBeDefined();
      expect(body.repositoryId).toBe(registeredRepoId);
      expect(body.baseSha).toBe(baseSha);
      expect(body.headSha).toBe(headSha);
      expect(body.status).toBe('running');
      expect(body.startedAt).toBeDefined();
      expect(body.finishedAt).toBeNull();
      expect(body.error).toBeNull();

      createdAnalysisId = body.id;

      // Verify investigation record tracking git ingestion completion stage
      const investigation = await prisma.investigation.findFirst({
        where: { analysisId: createdAnalysisId },
      });
      expect(investigation).not.toBeNull();
      expect(investigation?.status).toBe('in_progress');
      expect(investigation?.stage).toBe('git_ingestion_complete');

      // Verify persisted changed files in database
      const changedFiles = await prisma.changedFile.findMany({
        where: { analysisId: createdAnalysisId },
        orderBy: { path: 'asc' },
      });

      expect(changedFiles.length).toBe(3);

      const deletedFile = changedFiles.find((f) => f.path === 'deleted.ts');
      expect(deletedFile).toBeDefined();
      expect(deletedFile?.changeType).toBe('deleted');
      expect(deletedFile?.baseSha).toBe(baseSha);
      expect(deletedFile?.headSha).toBe(headSha);
      expect(deletedFile?.collector).toBe('git-diff-collector');

      const modifiedFile = changedFiles.find((f) => f.path === 'file1.ts');
      expect(modifiedFile).toBeDefined();
      expect(modifiedFile?.changeType).toBe('modified');

      const addedFile = changedFiles.find((f) => f.path === 'file2.ts');
      expect(addedFile).toBeDefined();
      expect(addedFile?.changeType).toBe('added');
    });

    it('retrieves analysis job status via GET /api/analyses/:id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/analyses/${createdAnalysisId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.job).toBeDefined();
      expect(body.job.id).toBe(createdAnalysisId);
      expect(body.job.repositoryId).toBe(registeredRepoId);
      expect(body.job.baseSha).toBe(baseSha);
      expect(body.job.headSha).toBe(headSha);
      expect(body.job.status).toBe('running');
      expect(body.job.finishedAt).toBeNull();
      expect(body.report).toBeNull();
    });

    it('enforces safe default ALLOWED_REPO_ROOT rejecting external paths', async () => {
      // Build an app with default config (ALLOWED_REPO_ROOT = process.cwd())
      const defaultApp = await buildApp({ logger: false });
      await defaultApp.ready();
      try {
        const response = await defaultApp.inject({
          method: 'POST',
          url: '/api/repositories',
          payload: {
            name: 'external-repo',
            path: repoDir, // in tmpdir, outside process.cwd()
          },
        });
        expect(response.statusCode).toBe(400);
        expect(response.json().error.code).toBe('INVALID_REPO_PATH');
      } finally {
        await defaultApp.close();
      }
    });

    it('rejects analysis creation with unknown repositoryId with 404 Not Found', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyses',
        payload: {
          repositoryId: 'clx999unknown',
          baseSha,
          headSha,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('NOT_FOUND');
    });

    it('rejects analysis creation with invalid git references with 400 Bad Request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyses',
        payload: {
          repositoryId: registeredRepoId,
          baseSha: 'invalid-nonexistent-ref',
          headSha: 'HEAD',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('INVALID_REF');
    });

    it('returns 404 when querying non-existent analysis ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/analyses/non-existent-analysis-id',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('NOT_FOUND');
    });
  });
});
