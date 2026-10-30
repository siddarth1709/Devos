import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  getDiff,
  resolveRef,
  getHistory,
  assertRepoPath,
  assertRef,
  runGit,
  listTrackedFilesAtCommit,
} from "./index.js";

let repo = "";
let base = "";
let head = "";

function git(...args: string[]) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

beforeAll(() => {
  repo = realpathSync(mkdtempSync(path.join(tmpdir(), "devos-git-")));
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "Test");
  writeFileSync(path.join(repo, "a.ts"), "export const a = 1;\nexport const z = 0;\n");
  writeFileSync(path.join(repo, "b.ts"), "export const b = 'hello world, long enough to rename';\n");
  writeFileSync(path.join(repo, "old.ts"), "export const old = 1;\n");
  git("add", ".");
  git("commit", "-q", "-m", "first");
  base = git("rev-parse", "HEAD");

  writeFileSync(path.join(repo, "a.ts"), "export const a = 2;\nexport const z = 0;\n");
  git("mv", "b.ts", "c.ts");
  git("rm", "-q", "old.ts");
  writeFileSync(path.join(repo, "img.bin"), Buffer.from([0, 1, 2, 0, 255, 0]));
  git("add", ".");
  git("commit", "-q", "-m", "second");
  head = git("rev-parse", "HEAD");
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("git module", () => {
  it("reports modified, renamed, deleted, added and binary files", async () => {
    const files = await getDiff(repo, base, head);
    const by = Object.fromEntries(files.map((f) => [f.path, f]));
    expect(by["a.ts"]?.changeType).toBe("modified");
    expect(by["a.ts"]?.hunks[0]?.newStart).toBe(1);
    expect(by["c.ts"]).toMatchObject({ changeType: "renamed", oldPath: "b.ts" });
    expect(by["old.ts"]?.changeType).toBe("deleted");
    expect(by["img.bin"]).toMatchObject({ changeType: "added", binary: true });
  });

  it("resolves refs to full SHAs and reads history", async () => {
    expect(await resolveRef(repo, "HEAD")).toBe(head);
    expect((await getHistory(repo, 10)).length).toBe(2);
  });

  it("rejects bad input", async () => {
    await expect(assertRepoPath(path.join(repo, "nope"))).rejects.toThrow();
    await expect(assertRepoPath(tmpdir())).rejects.toThrow();
    expect(() => assertRef("--upload-pack=evil")).toThrow();
    expect(() => assertRef("-f")).toThrow();
    expect(() => assertRef("a..b")).toThrow();
    expect(() => assertRef("ref with space")).toThrow();
    expect(() => assertRef("ref\0null")).toThrow();
  });

  it("rejects symlinks that point outside the allowed root", async () => {
    const symlinkPath = path.join(repo, "escape-link");
    execFileSync("ln", ["-s", "/tmp", symlinkPath]);
    try {
      await expect(assertRepoPath(symlinkPath, repo)).rejects.toThrow(/Path is outside the allowed root/);
    } finally {
      rmSync(symlinkPath, { force: true });
    }
  });

  it("verifies resolveRef returns canonical 40-character commit SHA", async () => {
    const resolved = await resolveRef(repo, "HEAD");
    expect(resolved).toMatch(/^[0-9a-f]{40}$/);
    await expect(resolveRef(repo, "non-existent-tag")).rejects.toThrow();
  });

  it("times out", async () => {
    await expect(runGit(["log"], { cwd: repo, timeoutMs: 1 })).rejects.toThrow();
  });

  it("lists tracked files at commit excluding untracked working-tree files", async () => {
    // Create untracked file in working directory
    writeFileSync(path.join(repo, "untracked.ts"), "export const untracked = 1;\n");
    try {
      const baseFiles = await listTrackedFilesAtCommit(repo, base);
      expect(baseFiles).toContain("a.ts");
      expect(baseFiles).toContain("b.ts");
      expect(baseFiles).toContain("old.ts");
      expect(baseFiles).not.toContain("untracked.ts");
      expect(baseFiles).not.toContain("c.ts");

      const headFiles = await listTrackedFilesAtCommit(repo, head);
      expect(headFiles).toContain("a.ts");
      expect(headFiles).toContain("c.ts");
      expect(headFiles).toContain("img.bin");
      expect(headFiles).not.toContain("old.ts");
      expect(headFiles).not.toContain("untracked.ts");
    } finally {
      rmSync(path.join(repo, "untracked.ts"), { force: true });
    }
  });
});
