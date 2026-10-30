import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  CreateRepositoryRequestSchema,
  GetRepositoriesResponse,
  Repository as RepositoryContract,
} from '@devos/contracts';
import { assertRepoPath, getRepoInfo } from '../git/index.js';
import {
  createRepository,
  getRepositoryById,
  getRepositoryByPath,
  listRepositories,
} from '../repo/index.js';

export const repositoryRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/repositories
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

  // GET /api/repositories/:id
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

  // POST /api/repositories
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

