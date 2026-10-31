import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { authRepo } from "../repo/authRepo.js";
import { setRepositoryTrust, validateWorktreeCleanupPath } from "./actions.js";
import { mkdtempSync, writeFileSync, rmSync, symlinkSync, realpathSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

describe("Secure Action Execution API Routes & Security Boundaries", () => {
  let app: FastifyInstance;
  let testRepoId: string;
  let testAnalysisId: string;
  let realRepoDir: string;
  let realRepoId: string;
  let realAnalysisId: string;
  let realHeadSha: string;
  let testUserId: string;
  let testUserToken: string;

  beforeAll(async () => {
    app = await buildApp({
      logger: false,
      appConfig: loadConfig({
        ALLOWED_REPO_ROOT: tmpdir(),
      }),
    });
    await app.ready();

    const user = await authRepo.upsertGitHubUser({
      githubId: `gh-${Date.now()}`,
      githubUsername: "verified-approver-lead",
      displayName: "Verified Approver Lead",
      email: "lead@example.com",
    });
    testUserId = user.id;
    const session = await authRepo.createSession(user.id);
    testUserToken = session.token;

    const repo = await prisma.repository.create({
      data: {
        name: `actions-test-repo-${Date.now()}`,
        path: `/tmp/actions-test-repo-${Date.now()}`,
        defaultBranch: "main",
      },
    });
    testRepoId = repo.id;
    setRepositoryTrust(testRepoId, true);

    const analysis = await prisma.analysis.create({
      data: {
        repositoryId: repo.id,
        baseSha: "7".repeat(40),
        headSha: "8".repeat(40),
        status: "completed",
      },
    });
    testAnalysisId = analysis.id;

    realRepoDir = realpathSync(mkdtempSync(path.join(tmpdir(), "devos-action-sec-")));
    execFileSync("git", ["init", "-q"], { cwd: realRepoDir });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: realRepoDir });
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: realRepoDir });
    writeFileSync(path.join(realRepoDir, "index.ts"), "export const ok = true;\n");
    execFileSync("git", ["add", "."], { cwd: realRepoDir });
    execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd: realRepoDir });
    realHeadSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: realRepoDir, encoding: "utf8" }).trim();

    try {
      symlinkSync("/tmp", path.join(realRepoDir, "symlink-outside"));
      symlinkSync("/tmp", path.join(realRepoDir, "symdir"));
    } catch {}

    const diskRepo = await prisma.repository.create({
      data: {
        name: `disk-repo-${Date.now()}`,
        path: realRepoDir,
        defaultBranch: "main",
      },
    });
    realRepoId = diskRepo.id;
    setRepositoryTrust(realRepoId, true);

    const diskAnalysis = await prisma.analysis.create({
      data: {
        repositoryId: diskRepo.id,
        baseSha: realHeadSha,
        headSha: realHeadSha,
        status: "completed",
      },
    });
    realAnalysisId = diskAnalysis.id;
  });

  afterAll(async () => {
    setRepositoryTrust(testRepoId, false);
    setRepositoryTrust(realRepoId, false);
    await prisma.actionExecution.deleteMany({
      where: { repositoryId: { in: [testRepoId, realRepoId] } },
    });
    await prisma.analysis.deleteMany({
      where: { repositoryId: { in: [testRepoId, realRepoId] } },
    });
    await prisma.repository.deleteMany({
      where: { id: { in: [testRepoId, realRepoId] } },
    });
    if (testUserId) {
      await prisma.session.deleteMany({ where: { userId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
    if (realRepoDir) {
      rmSync(realRepoDir, { recursive: true, force: true });
    }
    await app.close();
    await prisma.$disconnect();
  });

  it("POST /api/analyses/:id/actions proposes an action with status awaiting_approval", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/analyses/${testAnalysisId}/actions`,
      payload: {
        actionName: "run_tests",
        params: { suite: "unit" },
        actor: "developer-alice",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.actionName).toBe("run_tests");
    expect(body.status).toBe("awaiting_approval");
    expect(body.actor).toBe("developer-alice");
  });

  it("rejects path traversal in action parameters with 400 PATH_TRAVERSAL_DETECTED", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/analyses/${testAnalysisId}/actions`,
      payload: {
        actionName: "apply_patch",
        params: { filePath: "../../etc/passwd" },
        actor: "malicious-actor",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("PATH_TRAVERSAL_DETECTED");
  });

  it("rejects absolute paths in action parameters with 400 PATH_TRAVERSAL_DETECTED", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/analyses/${testAnalysisId}/actions`,
      payload: {
        actionName: "generate_patch",
        params: { filePath: "/etc/passwd" },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("PATH_TRAVERSAL_DETECTED");
  });

  it("rejects symlink pointing outside repository with 400 PATH_TRAVERSAL_DETECTED", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/analyses/${realAnalysisId}/actions`,
      payload: {
        actionName: "apply_patch",
        params: { filePath: "symlink-outside" },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("PATH_TRAVERSAL_DETECTED");
  });

  it("rejects symlinked parent directory with 400 PATH_TRAVERSAL_DETECTED", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/analyses/${realAnalysisId}/actions`,
      payload: {
        actionName: "apply_patch",
        params: { filePath: "symdir/secret.txt" },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("PATH_TRAVERSAL_DETECTED");
  });

  it("rejects nonexistent destination path with unsafe parent with 400 PATH_TRAVERSAL_DETECTED", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/analyses/${realAnalysisId}/actions`,
      payload: {
        actionName: "generate_patch",
        params: { destinationPath: "symdir/deep/nonexistent.ts" },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("PATH_TRAVERSAL_DETECTED");
  });

  it("rejects path traversal inside files list parameters with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/analyses/${testAnalysisId}/actions`,
      payload: {
        actionName: "generate_patch",
        params: { files: ["valid.ts", "../../../escape.ts"] },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("PATH_TRAVERSAL_DETECTED");
  });

  it("rejects nested file collections containing an unsafe path with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/analyses/${testAnalysisId}/actions`,
      payload: {
        actionName: "generate_patch",
        params: { files: [{ path: "safe.ts" }, { path: "../../escape.ts" }] },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("PATH_TRAVERSAL_DETECTED");
  });

  it("rejects shell injection in command with 400 SHELL_INJECTION_DETECTED", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/analyses/${testAnalysisId}/actions`,
      payload: {
        actionName: "run_tests",
        params: { command: "pnpm test; rm -rf /" },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("SHELL_INJECTION_DETECTED");
  });

  it("rejects unauthorized executables with 400 UNAUTHORIZED_EXECUTABLE", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/analyses/${testAnalysisId}/actions`,
      payload: {
        actionName: "run_tests",
        params: { command: "bash test.sh" },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("UNAUTHORIZED_EXECUTABLE");
  });

  it("rejects commitSha targeting commits outside analysis bounds with 400 INVALID_COMMIT_TARGET", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/analyses/${testAnalysisId}/actions`,
      payload: {
        actionName: "create_commit",
        commitSha: "f".repeat(40),
        params: { files: ["index.ts"] },
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_COMMIT_TARGET");
  });

  it("POST /api/actions/:id/execute rejects unapproved action with 403 ACTION_NOT_APPROVED", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: `/api/analyses/${testAnalysisId}/actions`,
      payload: {
        actionName: "generate_patch",
        params: { files: ["src/index.ts"] },
      },
    });
    const actionId = createRes.json().id;

    const execRes = await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/execute`,
    });

    expect(execRes.statusCode).toBe(403);
    expect(execRes.json().error.code).toBe("ACTION_NOT_APPROVED");
  });

  it("POST /api/actions/:id/approve records approval and enables execution", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: `/api/analyses/${testAnalysisId}/actions`,
      payload: {
        actionName: "generate_patch",
        params: { files: ["src/index.ts"] },
      },
    });
    const actionId = createRes.json().id;

    const approveRes = await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/approve`,
      payload: { reason: "Verified safe proposal" },
    });

    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().action.status).toBe("approved");
    expect(approveRes.json().action.approvedBy).toBe("authenticated-operator");

    const execRes = await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/execute`,
    });

    expect(execRes.statusCode).toBe(200);
    const execBody = execRes.json();
    expect(execBody.success).toBe(true);
    expect(execBody.action.status).toBe("completed");

    const repeatExec = await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/execute`,
    });
    expect(repeatExec.statusCode).toBe(403);
  });

  it("POST /api/actions/:id/reject transitions action to rejected", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: `/api/analyses/${testAnalysisId}/actions`,
      payload: { actionName: "run_tests" },
    });
    const actionId = createRes.json().id;

    const rejectRes = await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/reject`,
      payload: { rejectedBy: "security-team", reason: "Scope too broad" },
    });

    expect(rejectRes.statusCode).toBe(200);
    expect(rejectRes.json().action.status).toBe("rejected");
    expect(rejectRes.json().action.rejectionReason).toBe("Scope too broad");
  });

  it("POST /api/actions/:id/cancel transitions action to cancelled", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: `/api/analyses/${testAnalysisId}/actions`,
      payload: { actionName: "run_tests" },
    });
    const actionId = createRes.json().id;

    const cancelRes = await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/cancel`,
    });

    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.json().action.status).toBe("cancelled");
  });

  it("safely handles concurrent execution requests preventing race conditions", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: `/api/analyses/${testAnalysisId}/actions`,
      payload: { actionName: "generate_patch" },
    });
    const actionId = createRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/approve`,
    });

    const [res1, res2] = await Promise.all([
      app.inject({ method: "POST", url: `/api/actions/${actionId}/execute` }),
      app.inject({ method: "POST", url: `/api/actions/${actionId}/execute` }),
    ]);

    const statusCodes = [res1.statusCode, res2.statusCode].sort();
    expect(statusCodes).toEqual([200, 403]);
  });

  it("failed patch application never modifies original repository and preserves untracked and staged files", async () => {
    const untrackedFile = path.join(realRepoDir, "untracked-survivor.txt");
    const stagedFile = path.join(realRepoDir, "staged-survivor.txt");

    writeFileSync(untrackedFile, "precious uncommitted untracked work\n");
    writeFileSync(stagedFile, "precious staged work\n");
    execFileSync("git", ["add", "staged-survivor.txt"], { cwd: realRepoDir });

    const currentHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: realRepoDir, encoding: "utf8" }).trim();
    await prisma.analysis.update({
      where: { id: realAnalysisId },
      data: { headSha: currentHead },
    });

    const invalidPatch = "diff --git a/index.ts b/index.ts\n--- a/index.ts\n+++ b/index.ts\n@@ -1,1 +1,1 @@\n-nonexistent line content that will fail patch apply\n+new content\n";

    const createRes = await app.inject({
      method: "POST",
      url: `/api/analyses/${realAnalysisId}/actions`,
      payload: {
        actionName: "apply_patch",
        commitSha: currentHead,
        params: { patch: invalidPatch, filePath: "index.ts" },
      },
    });
    const actionId = createRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/approve`,
    });

    const execRes = await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/execute`,
    });

    expect(execRes.statusCode).toBe(500);

    expect(existsSync(untrackedFile)).toBe(true);
    expect(readFileSync(untrackedFile, "utf8")).toBe("precious uncommitted untracked work\n");

    const statusOutput = execFileSync("git", ["status", "--porcelain"], { cwd: realRepoDir, encoding: "utf8" });
    expect(statusOutput).toContain("A  staged-survivor.txt");
    expect(statusOutput).toContain("?? untracked-survivor.txt");

    rmSync(untrackedFile, { force: true });
    rmSync(stagedFile, { force: true });
    execFileSync("git", ["reset", "HEAD", "staged-survivor.txt"], { cwd: realRepoDir });
  });

  it("proposer cannot forge approver identity from body or client parameters", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: `/api/analyses/${testAnalysisId}/actions`,
      payload: {
        actionName: "generate_patch",
        params: { files: ["index.ts"] },
        actor: "malicious-proposer-alice",
      },
    });
    const actionId = createRes.json().id;

    const approveRes = await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/approve`,
      headers: {
        authorization: `Bearer ${testUserToken}`,
      },
      payload: {
        approvedBy: "forged-chief-executive-officer",
        reason: "Attempting to spoof approver attribution",
      },
    });

    expect(approveRes.statusCode).toBe(200);
    const body = approveRes.json();
    expect(body.action.approvedBy).toBe("verified-approver-lead");
    expect(body.action.approvedBy).not.toBe("forged-chief-executive-officer");

    const dbRecord = await prisma.actionExecution.findUnique({
      where: { id: actionId },
    });
    expect(dbRecord?.approvedBy).toBe("verified-approver-lead");
    expect(dbRecord?.actor).toBe("malicious-proposer-alice");
  });

  it("blocks test execution on untrusted repositories even if client claims trusted", async () => {
    setRepositoryTrust(testRepoId, false);

    const createRes = await app.inject({
      method: "POST",
      url: `/api/analyses/${testAnalysisId}/actions`,
      payload: {
        actionName: "run_tests",
        params: { trusted: true, untrusted: false },
      },
    });
    const actionId = createRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/approve`,
    });

    const execRes = await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/execute`,
    });

    expect(execRes.statusCode).toBe(500);
    expect(execRes.json().error.message).toContain("UNTRUSTED_REPOSITORY_EXECUTION_BLOCKED");

    setRepositoryTrust(testRepoId, true);
  });

  it("validates that worktree cleanup paths cannot target paths outside managed directory", async () => {
    const invalidPath1 = "/etc/passwd";
    const invalidPath2 = "../../tmp";
    const invalidPath3 = tmpdir();
    const validPath = path.join(tmpdir(), "devos-worktrees", "wt-test-action-12345");

    expect(await validateWorktreeCleanupPath(invalidPath1)).toBe(false);
    expect(await validateWorktreeCleanupPath(invalidPath2)).toBe(false);
    expect(await validateWorktreeCleanupPath(invalidPath3)).toBe(false);
    expect(await validateWorktreeCleanupPath(validPath)).toBe(true);
  });

  it("rejects execution when target base commit does not match repository HEAD", async () => {
    const oldSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: realRepoDir, encoding: "utf8" }).trim();
    await prisma.analysis.update({
      where: { id: realAnalysisId },
      data: { headSha: oldSha },
    });

    const createRes = await app.inject({
      method: "POST",
      url: `/api/analyses/${realAnalysisId}/actions`,
      payload: {
        actionName: "apply_patch",
        commitSha: oldSha,
        params: { filePath: "index.ts" },
      },
    });
    const actionId = createRes.json().id;

    writeFileSync(path.join(realRepoDir, "index.ts"), "export const ok = 'advancing';\n");
    execFileSync("git", ["commit", "-a", "-q", "-m", "advancing commit"], { cwd: realRepoDir });

    await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/approve`,
    });

    const execRes = await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/execute`,
    });

    expect(execRes.statusCode).toBe(500);
    expect(execRes.json().error.message).toContain("STALE_BASE_COMMIT");
  });

  it("terminates test execution on timeout and returns 500 error", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: `/api/analyses/${testAnalysisId}/actions`,
      payload: {
        actionName: "run_tests",
        params: { command: "npm test", timeoutMs: 1 },
      },
    });
    const actionId = createRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/approve`,
    });

    const execRes = await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/execute`,
    });

    expect(execRes.statusCode).toBe(500);
    expect(execRes.json().error.message).toContain("COMMAND_TIMEOUT");
  });

  it("commits only explicitly approved files leaving untracked files unstaged", async () => {
    const currentSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: realRepoDir, encoding: "utf8" }).trim();
    await prisma.analysis.update({
      where: { id: realAnalysisId },
      data: { headSha: currentSha },
    });

    writeFileSync(path.join(realRepoDir, "index.ts"), "export const ok = 'audited-safe';\n");
    writeFileSync(path.join(realRepoDir, "unapproved.txt"), "should not be committed\n");

    const createRes = await app.inject({
      method: "POST",
      url: `/api/analyses/${realAnalysisId}/actions`,
      payload: {
        actionName: "create_commit",
        commitSha: currentSha,
        params: { files: ["index.ts"], message: "Audited commit message" },
      },
    });
    const actionId = createRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/approve`,
      headers: {
        authorization: `Bearer ${testUserToken}`,
      },
    });

    const execRes = await app.inject({
      method: "POST",
      url: `/api/actions/${actionId}/execute`,
    });

    expect(execRes.statusCode).toBe(200);
    const body = execRes.json();
    expect(body.success).toBe(true);
    expect(body.action.output.author).toBe("verified-approver-lead");

    const lastCommitFiles = execFileSync("git", ["show", "--name-only", "--oneline", "HEAD"], { cwd: realRepoDir, encoding: "utf8" });
    expect(lastCommitFiles).toContain("index.ts");
    expect(lastCommitFiles).not.toContain("unapproved.txt");

    const authorLog = execFileSync("git", ["log", "-1", "--format=%an <%ae>", "HEAD"], { cwd: realRepoDir, encoding: "utf8" }).trim();
    expect(authorLog).toBe("verified-approver-lead <devos@local>");

    rmSync(path.join(realRepoDir, "unapproved.txt"), { force: true });
  });
});
