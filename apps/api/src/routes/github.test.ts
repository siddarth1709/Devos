import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";

describe("GitHub Integration Routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("GET /api/github/repositories returns repositories with pagination", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      if (url.toString().includes("/user/repos") || url.toString().includes("/repositories")) {
        return {
          ok: true,
          json: async () => [
            {
              id: 101,
              name: "repo-alpha",
              full_name: "testorg/repo-alpha",
              owner: { login: "testorg" },
              private: false,
              html_url: "https://github.com/testorg/repo-alpha",
              description: "Alpha test repo",
              default_branch: "main",
              updated_at: "2026-10-31T00:00:00Z",
            },
          ],
        } as any;
      }
      return { ok: false, status: 404, text: async () => "Not found" } as any;
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/github/repositories?page=1&perPage=10",
      headers: {
        "x-github-token": "gho_mock_token_123",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.repositories).toHaveLength(1);
    expect(body.repositories[0].name).toBe("repo-alpha");
    expect(body.repositories[0].defaultBranch).toBe("main");
    expect(body.page).toBe(1);

    fetchSpy.mockRestore();
  });

  it("GET /api/github/repositories/:owner/:repo returns repository details", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      if (url.toString().includes("/repos/testorg/repo-alpha")) {
        return {
          ok: true,
          json: async () => ({
            id: 101,
            name: "repo-alpha",
            full_name: "testorg/repo-alpha",
            owner: { login: "testorg" },
            private: false,
            html_url: "https://github.com/testorg/repo-alpha",
            default_branch: "main",
            updated_at: "2026-10-31T00:00:00Z",
          }),
        } as any;
      }
      return { ok: false, status: 404, text: async () => "Not found" } as any;
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/github/repositories/testorg/repo-alpha",
      headers: { "x-github-token": "gho_mock_token_123" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.repository.name).toBe("repo-alpha");
    expect(body.repository.owner).toBe("testorg");

    fetchSpy.mockRestore();
  });

  it("GET /api/github/repositories/:owner/:repo/branches lists branches", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      if (url.toString().includes("/branches")) {
        return {
          ok: true,
          json: async () => [
            { name: "main", commit: { sha: "a".repeat(40) }, protected: true },
            { name: "feature-1", commit: { sha: "b".repeat(40) }, protected: false },
          ],
        } as any;
      }
      if (url.toString().includes("/repos/testorg/repo-alpha")) {
        return {
          ok: true,
          json: async () => ({
            id: 101,
            name: "repo-alpha",
            default_branch: "main",
          }),
        } as any;
      }
      return { ok: false, status: 404, text: async () => "Not found" } as any;
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/github/repositories/testorg/repo-alpha/branches",
      headers: { "x-github-token": "gho_mock_token_123" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.branches).toHaveLength(2);
    expect(body.branches[0].name).toBe("main");
    expect(body.branches[0].isDefault).toBe(true);

    fetchSpy.mockRestore();
  });

  it("GET /api/github/repositories/:owner/:repo/compare returns file diffs between commits", async () => {
    const base = "c".repeat(40);
    const head = "d".repeat(40);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      if (url.toString().includes("/compare/")) {
        return {
          ok: true,
          json: async () => ({
            base_commit: { sha: base },
            status: "ahead",
            ahead_by: 1,
            behind_by: 0,
            commits: [{ sha: head, commit: { message: "fix: test", author: { name: "Dev" } } }],
            files: [
              {
                filename: "src/index.ts",
                status: "modified",
                additions: 5,
                deletions: 2,
                changes: 7,
                patch: "@@ -1 +1 @@",
              },
            ],
          }),
        } as any;
      }
      return { ok: false, status: 404, text: async () => "Not found" } as any;
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/github/repositories/testorg/repo-alpha/compare?base=${base}&head=${head}`,
      headers: { "x-github-token": "gho_mock_token_123" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.comparison.baseSha).toBe(base);
    expect(body.comparison.headSha).toBe(head);
    expect(body.comparison.files).toHaveLength(1);
    expect(body.comparison.files[0].filename).toBe("src/index.ts");

    fetchSpy.mockRestore();
  });

  it("POST /api/github/repositories/:owner/:repo/pulls/:number/analyze creates analysis with exact PR SHAs", async () => {
    const baseSha = "e".repeat(40);
    const headSha = "f".repeat(40);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes("/pulls/42/files")) {
        return {
          ok: true,
          json: async () => [
            {
              filename: "src/telemetry.ts",
              status: "added",
              additions: 10,
              deletions: 0,
              changes: 10,
              patch: "@@ -0,0 +1,5 @@\n+export function recordEvent() {}",
            },
          ],
        } as any;
      }
      if (urlStr.includes("/contents/src/telemetry.ts")) {
        return {
          ok: true,
          json: async () => ({
            content: Buffer.from("export function recordEvent(): void {}").toString("base64"),
            encoding: "base64",
          }),
        } as any;
      }
      if (urlStr.includes("/pulls/42")) {
        return {
          ok: true,
          json: async () => ({
            number: 42,
            title: "Support new telemetry",
            base: { ref: "main", sha: baseSha },
            head: { ref: "feature/telemetry", sha: headSha },
          }),
        } as any;
      }
      return { ok: false, status: 404, text: async () => "Not found" } as any;
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/github/repositories/testorg/repo-alpha/pulls/42/analyze",
      headers: { "x-github-token": "gho_mock_token_123" },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.baseSha).toBe(baseSha);
    expect(body.headSha).toBe(headSha);
    expect(body.pullRequest.number).toBe(42);

    const changedFiles = await prisma.changedFile.findMany({ where: { analysisId: body.id } });
    expect(changedFiles).toHaveLength(1);
    expect(changedFiles[0].path).toBe("src/telemetry.ts");

    const symbols = await prisma.symbol.findMany({ where: { analysisId: body.id } });
    expect(symbols.length).toBeGreaterThanOrEqual(1);
    expect(symbols[0].name).toBe("recordEvent");

    fetchSpy.mockRestore();
  });
});
