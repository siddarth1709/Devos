import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { parseSessionCookie } from "../lib/cookies.js";
import { authRepo } from "../repo/authRepo.js";
import { GitHubService } from "../git/github.js";
import { GitHubRepositoryProvider } from "../git/provider.js";
import { parseSourceFileAST, isTypeScriptFile } from "../ast/parser.js";
import { prisma } from "../db.js";
import { config } from "../config.js";
import {
  createAnalysis,
  createRepository,
  getRepositoryByName,
  getRepositoryByPath,
} from "../repo/index.js";

async function resolveGitHubToken(request: any): Promise<string | undefined> {
  const customHeader = request.headers["x-github-token"];
  if (typeof customHeader === "string" && customHeader.trim()) {
    return customHeader.trim();
  }

  const authHeader = request.headers.authorization;
  let rawToken = parseSessionCookie(request.headers.cookie);
  if (!rawToken && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    rawToken = authHeader.slice(7).trim();
  }
  if (rawToken) {
    const user = await authRepo.validateSession(rawToken);
    if (user) {
      const storedToken = await authRepo.getUserAccessToken(user.id);
      if (storedToken) return storedToken;
    }
  }

  const activeConfig = ((request.server as any).appConfig as typeof config) ?? config;
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  return undefined;
}

export const githubRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/github/repositories", async (request, reply) => {
    const token = await resolveGitHubToken(request);
    const query = request.query as { page?: string; perPage?: string };
    const page = parseInt(query?.page || "1", 10) || 1;
    const perPage = parseInt(query?.perPage || "30", 10) || 30;

    try {
      const service = new GitHubService(token);
      const repositories = await service.listUserRepositories(page, perPage);
      return { repositories, page, perPage };
    } catch (err: any) {
      reply.status(err.status || 500).send({
        error: {
          code: "GITHUB_REPOS_ERROR",
          message: err.message || "Failed to fetch repositories from GitHub",
        },
      });
    }
  });

  app.get<{ Params: { owner: string; repo: string } }>(
    "/github/repositories/:owner/:repo",
    async (request, reply) => {
      const { owner, repo } = request.params;
      const token = await resolveGitHubToken(request);
      try {
        const service = new GitHubService(token);
        const repository = await service.getRepository(owner, repo);
        return { repository };
      } catch (err: any) {
        reply.status(err.status || 404).send({
          error: {
            code: "GITHUB_REPO_NOT_FOUND",
            message: err.message || `Repository ${owner}/${repo} not found`,
          },
        });
      }
    }
  );

  app.get<{ Params: { owner: string; repo: string } }>(
    "/github/repositories/:owner/:repo/branches",
    async (request, reply) => {
      const { owner, repo } = request.params;
      const token = await resolveGitHubToken(request);
      try {
        const service = new GitHubService(token);
        const branches = await service.listBranches(owner, repo);
        return { branches };
      } catch (err: any) {
        reply.status(err.status || 500).send({
          error: {
            code: "GITHUB_BRANCHES_ERROR",
            message: err.message || "Failed to fetch branches from GitHub",
          },
        });
      }
    }
  );

  app.get<{ Params: { owner: string; repo: string; branch: string } }>(
    "/github/repositories/:owner/:repo/branches/:branch",
    async (request, reply) => {
      const { owner, repo, branch } = request.params;
      const token = await resolveGitHubToken(request);
      try {
        const service = new GitHubService(token);
        const branchInfo = await service.getBranch(owner, repo, branch);
        return { branch: branchInfo };
      } catch (err: any) {
        reply.status(err.status || 404).send({
          error: {
            code: "GITHUB_BRANCH_NOT_FOUND",
            message: err.message || `Branch ${branch} not found`,
          },
        });
      }
    }
  );

  app.get<{ Params: { owner: string; repo: string } }>(
    "/github/repositories/:owner/:repo/commits",
    async (request, reply) => {
      const { owner, repo } = request.params;
      const token = await resolveGitHubToken(request);
      const query = request.query as { page?: string; perPage?: string };
      const page = parseInt(query?.page || "1", 10) || 1;
      const perPage = parseInt(query?.perPage || "30", 10) || 30;

      try {
        const service = new GitHubService(token);
        const commits = await service.listCommits(owner, repo, page, perPage);
        return { commits, page, perPage };
      } catch (err: any) {
        reply.status(err.status || 500).send({
          error: {
            code: "GITHUB_COMMITS_ERROR",
            message: err.message || "Failed to fetch commits from GitHub",
          },
        });
      }
    }
  );

  app.get<{ Params: { owner: string; repo: string } }>(
    "/github/repositories/:owner/:repo/compare",
    async (request, reply) => {
      const { owner, repo } = request.params;
      const token = await resolveGitHubToken(request);
      const query = request.query as { base?: string; head?: string };

      if (!query.base || !query.head) {
        reply.status(400).send({
          error: {
            code: "INVALID_PARAMETERS",
            message: "Both base and head commit or branch parameters are required",
          },
        });
        return;
      }

      try {
        const service = new GitHubService(token);
        const comparison = await service.compare(owner, repo, query.base, query.head);
        return { comparison };
      } catch (err: any) {
        reply.status(err.status || 500).send({
          error: {
            code: "GITHUB_COMPARE_ERROR",
            message: err.message || "Failed to compare commits on GitHub",
          },
        });
      }
    }
  );

  app.get<{ Params: { owner: string; repo: string } }>(
    "/github/repositories/:owner/:repo/pulls",
    async (request, reply) => {
      const { owner, repo } = request.params;
      const token = await resolveGitHubToken(request);
      const query = request.query as { state?: "open" | "closed" | "all" };
      const state = query?.state || "open";

      try {
        const service = new GitHubService(token);
        const pullRequests = await service.listPullRequests(owner, repo, state);
        return { pullRequests };
      } catch (err: any) {
        reply.status(err.status || 500).send({
          error: {
            code: "GITHUB_PULLS_ERROR",
            message: err.message || "Failed to fetch pull requests from GitHub",
          },
        });
      }
    }
  );

  app.get<{ Params: { owner: string; repo: string; number: string } }>(
    "/github/repositories/:owner/:repo/pulls/:number",
    async (request, reply) => {
      const { owner, repo, number } = request.params;
      const token = await resolveGitHubToken(request);
      const pullNumber = parseInt(number, 10);

      if (isNaN(pullNumber)) {
        reply.status(400).send({
          error: {
            code: "INVALID_PULL_NUMBER",
            message: "Pull request number must be an integer",
          },
        });
        return;
      }

      try {
        const service = new GitHubService(token);
        const pullRequest = await service.getPullRequest(owner, repo, pullNumber);
        return { pullRequest };
      } catch (err: any) {
        reply.status(err.status || 404).send({
          error: {
            code: "GITHUB_PR_NOT_FOUND",
            message: err.message || `Pull request #${pullNumber} not found`,
          },
        });
      }
    }
  );

  app.get<{ Params: { owner: string; repo: string; number: string } }>(
    "/github/repositories/:owner/:repo/pulls/:number/files",
    async (request, reply) => {
      const { owner, repo, number } = request.params;
      const token = await resolveGitHubToken(request);
      const pullNumber = parseInt(number, 10);

      if (isNaN(pullNumber)) {
        reply.status(400).send({
          error: {
            code: "INVALID_PULL_NUMBER",
            message: "Pull request number must be an integer",
          },
        });
        return;
      }

      try {
        const service = new GitHubService(token);
        const files = await service.getPullRequestFiles(owner, repo, pullNumber);
        return { files };
      } catch (err: any) {
        reply.status(err.status || 500).send({
          error: {
            code: "GITHUB_PR_FILES_ERROR",
            message: err.message || "Failed to fetch pull request files",
          },
        });
      }
    }
  );

  app.post<{ Params: { owner: string; repo: string; number: string } }>(
    "/github/repositories/:owner/:repo/pulls/:number/analyze",
    async (request, reply) => {
      const { owner, repo, number } = request.params;
      const token = await resolveGitHubToken(request);
      const pullNumber = parseInt(number, 10);

      if (isNaN(pullNumber)) {
        reply.status(400).send({
          error: {
            code: "INVALID_PULL_NUMBER",
            message: "Pull request number must be an integer",
          },
        });
        return;
      }

      try {
        const service = new GitHubService(token);
        const pr = await service.getPullRequest(owner, repo, pullNumber);

        if (!pr.baseSha || !pr.headSha) {
          reply.status(400).send({
            error: {
              code: "MISSING_PR_SHAS",
              message: "Pull request base and head commit SHAs are not available",
            },
          });
          return;
        }

        const fullName = `${owner}/${repo}`;
        let localRepo = await getRepositoryByPath(fullName);
        if (!localRepo) {
          localRepo = await getRepositoryByName(repo);
        }
        if (!localRepo) {
          localRepo = await createRepository({
            name: repo,
            path: fullName,
            defaultBranch: pr.baseRef || "main",
          });
        }

        const createdAnalysis = await createAnalysis({
          repositoryId: localRepo.id,
          baseSha: pr.baseSha,
          headSha: pr.headSha,
        });

        const provider = new GitHubRepositoryProvider(owner, repo, token);
        const files = await service.getPullRequestFiles(owner, repo, pullNumber);
        for (const f of files) {
          let changeType = "modified";
          if (f.status === "added") changeType = "added";
          else if (f.status === "removed") changeType = "deleted";
          else if (f.status === "renamed") changeType = "renamed";

          await prisma.changedFile.create({
            data: {
              analysisId: createdAnalysis.id,
              path: f.filename,
              changeType,
              oldPath: f.previousFilename || null,
              baseSha: pr.baseSha,
              headSha: pr.headSha,
              collector: "github-pr-ingest",
            },
          });

          if (f.patch) {
            await prisma.evidence.create({
              data: {
                analysisId: createdAnalysis.id,
                type: "diff",
                sourceCommit: pr.headSha,
                file: f.filename,
                collector: "github-pr-diff",
                payload: JSON.stringify({
                  diff: f.patch,
                  additions: f.additions,
                  deletions: f.deletions,
                }),
              },
            });
          }

          if (isTypeScriptFile(f.filename) && changeType !== "deleted") {
            try {
              const fileContent = await provider.getFileContent(pr.headSha, f.filename);
              if (fileContent) {
                const parseResult = parseSourceFileAST(f.filename, fileContent);
                for (const sym of parseResult.symbols) {
                  await prisma.symbol.create({
                    data: {
                      repositoryId: localRepo.id,
                      analysisId: createdAnalysis.id,
                      symbolKey: sym.symbolKey,
                      name: sym.name,
                      kind: sym.kind,
                      file: sym.file,
                      lineStart: sym.lineStart,
                      lineEnd: sym.lineEnd,
                      colStart: sym.colStart ?? null,
                      colEnd: sym.colEnd ?? null,
                      isExported: sym.isExported ?? false,
                      containerName: sym.containerName ?? null,
                      signature: sym.signature ?? null,
                      importKind: sym.importKind ?? null,
                      importedName: sym.importedName ?? null,
                      localName: sym.localName ?? null,
                      moduleSpecifier: sym.moduleSpecifier ?? null,
                      exportKind: sym.exportKind ?? null,
                      exportAlias: sym.exportAlias ?? null,
                      isReExport: sym.isReExport ?? false,
                      reExportModule: sym.reExportModule ?? null,
                      commitSha: pr.headSha,
                      collector: "ast-extractor-github",
                    },
                  });
                }
              }
            } catch {
            }
          }
        }

        reply.status(201).send({
          id: createdAnalysis.id,
          repositoryId: createdAnalysis.repositoryId,
          baseSha: createdAnalysis.baseSha,
          headSha: createdAnalysis.headSha,
          status: createdAnalysis.status,
          startedAt: createdAnalysis.startedAt ? createdAnalysis.startedAt.toISOString() : null,
          finishedAt: createdAnalysis.finishedAt ? createdAnalysis.finishedAt.toISOString() : null,
          error: createdAnalysis.error,
          pullRequest: {
            number: pr.number,
            title: pr.title,
            baseRef: pr.baseRef,
            headRef: pr.headRef,
          },
        });
      } catch (err: any) {
        reply.status(err.status || 500).send({
          error: {
            code: "GITHUB_PR_ANALYZE_ERROR",
            message: err.message || "Failed to analyze pull request",
          },
        });
      }
    }
  );
};
