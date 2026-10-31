import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  CreateRepositoryRequestSchema,
  GetRepositoriesResponse,
  Repository as RepositoryContract,
} from '@devos/contracts';
import { assertRepoPath, getRepoInfo, listBranches } from '../git/index.js';
import {
  createRepository,
  getRepositoryById,
  getRepositoryByPath,
  listRepositories,
  listAnalysesByRepository,
} from '../repo/index.js';

export const repositoryRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/repositories', async (): Promise<GetRepositoriesResponse> => {
    const repos = await listRepositories();
    return {
      repositories: repos.map((r) => ({
        id: r.id,
        name: r.name,
        path: r.path,
        defaultBranch: r.defaultBranch,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  app.get<{ Params: { id: string } }>('/repositories/:id', async (request, reply) => {
    const { id } = request.params;
    const repo = await getRepositoryById(id);
    if (!repo) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Repository with ID "${id}" not found`,
        },
      });
      return;
    }

    const response: RepositoryContract = {
      id: repo.id,
      name: repo.name,
      path: repo.path,
      defaultBranch: repo.defaultBranch,
      createdAt: repo.createdAt.toISOString(),
    };
    return response;
  });

  app.get<{ Params: { id: string } }>('/repositories/:id/analyses', async (request, reply) => {
    const { id } = request.params;
    const repo = await getRepositoryById(id);
    if (!repo) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Repository with ID "${id}" not found`,
        },
      });
      return;
    }

    const analyses = await listAnalysesByRepository(id);
    return {
      analyses: analyses.map((a) => ({
        id: a.id,
        repositoryId: a.repositoryId,
        baseSha: a.baseSha,
        headSha: a.headSha,
        status: a.status,
        startedAt: a.startedAt ? a.startedAt.toISOString() : null,
        finishedAt: a.finishedAt ? a.finishedAt.toISOString() : null,
        error: a.error,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  });

  app.get<{ Params: { id: string } }>('/repositories/:id/branches', async (request, reply) => {
    const { id } = request.params;
    const repo = await getRepositoryById(id);
    if (!repo) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Repository with ID "${id}" not found`,
        },
      });
      return;
    }

    try {
      const branches = await listBranches(repo.path);
      return {
        defaultBranch: repo.defaultBranch,
        branches: branches.map((b) => ({
          name: b,
          isDefault: b === repo.defaultBranch,
        })),
      };
    } catch {
      return {
        defaultBranch: repo.defaultBranch,
        branches: [{ name: repo.defaultBranch, isDefault: true }],
      };
    }
  });

  app.get<{ Params: { id: string } }>('/repositories/:id/health', async (request, reply) => {
    const { id } = request.params;
    const repo = await getRepositoryById(id);
    if (!repo) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Repository with ID "${id}" not found`,
        },
      });
      return;
    }

    const analyses = await listAnalysesByRepository(id);
    const latestAnalysis = analyses[0] ?? null;

    return {
      repositoryId: repo.id,
      name: repo.name,
      totalAnalyses: analyses.length,
      latestAnalysis: latestAnalysis
        ? {
            id: latestAnalysis.id,
            status: latestAnalysis.status,
            createdAt: latestAnalysis.createdAt.toISOString(),
          }
        : null,
      status: "healthy",
    };
  });

  app.post('/repositories', async (request, reply) => {
    const body = CreateRepositoryRequestSchema.parse(request.body);

    const allowedRoot = app.appConfig?.ALLOWED_REPO_ROOT;
    let validatedPath: string;
    try {
      validatedPath = await assertRepoPath(body.path, allowedRoot);
    } catch (err: any) {
      reply.status(400).send({
        error: {
          code: 'INVALID_REPO_PATH',
          message: err.message || 'Invalid repository path',
        },
      });
      return;
    }

    const existing = await getRepositoryByPath(validatedPath);
    if (existing) {
      reply.status(409).send({
        error: {
          code: 'REPO_ALREADY_EXISTS',
          message: `Repository at path "${validatedPath}" is already registered`,
        },
      });
      return;
    }

    const repoInfo = await getRepoInfo(validatedPath);
    const repoName = body.name || repoInfo.name;
    const defaultBranch =
      body.defaultBranch && body.defaultBranch !== 'main'
        ? body.defaultBranch
        : repoInfo.defaultBranch || 'main';

    const created = await createRepository({
      name: repoName,
      path: validatedPath,
      defaultBranch,
    });

    const response: RepositoryContract = {
      id: created.id,
      name: created.name,
      path: created.path,
      defaultBranch: created.defaultBranch,
      createdAt: created.createdAt.toISOString(),
    };

    reply.status(201).send(response);
  });
};

