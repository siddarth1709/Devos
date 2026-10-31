import path from "node:path";
import { runGit } from "./run.js";
import { assertRef, assertRelativePath } from "./validate.js";

export type ChangeType = "added" | "modified" | "deleted" | "renamed";

export interface Commit {
  sha: string;
  author: string;
  date: string;
  parents: string[];
  message: string;
}

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
}

export interface DiffFile {
  path: string;
  oldPath: string | null;
  changeType: ChangeType;
  binary: boolean;
  hunks: Hunk[];
}

const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/i;

export async function resolveRef(repo: string, ref: string): Promise<string> {
  assertRef(ref);
  const out = (await runGit(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: repo })).trim();
  if (!FULL_SHA_PATTERN.test(out)) {
    throw new Error(`Resolved reference "${ref}" did not produce a valid 40-character commit SHA`);
  }
  return out;
}

export async function getRepoInfo(repo: string) {
  const headSha = await resolveRef(repo, "HEAD");
  let defaultBranch: string;
  try {
    const out = await runGit(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], { cwd: repo });
    defaultBranch = out.trim().replace(/^origin\//, "");
  } catch {
    defaultBranch = (await runGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repo })).trim();
  }
  return { name: path.basename(repo), defaultBranch, headSha };
}

export async function listBranches(repo: string): Promise<string[]> {
  const out = await runGit(["branch", "--format=%(refname:short)"], { cwd: repo });
  return out.split("\n").map((s) => s.trim()).filter(Boolean);
}

const LOG_FORMAT = "%H%x00%an%x00%aI%x00%P%x00%s";

function parseCommit(line: string): Commit {
  const [sha, author, date, parents, message] = line.split("\0");
  return {
    sha: sha ?? "",
    author: author ?? "",
    date: date ?? "",
    parents: parents ? parents.split(" ").filter(Boolean) : [],
    message: message ?? "",
  };
}

export async function getCommit(repo: string, ref: string): Promise<Commit> {
  assertRef(ref);
  const out = await runGit(["show", "-s", `--format=${LOG_FORMAT}`, ref], { cwd: repo });
  return parseCommit(out.trim());
}

export async function getHistory(repo: string, limit = 50, filePath?: string): Promise<Commit[]> {
  const args = ["log", "-n", String(Math.min(Math.max(limit, 1), 500)), `--format=${LOG_FORMAT}`];
  if (filePath) args.push("--", assertRelativePath(filePath));
  const out = await runGit(args, { cwd: repo });
  return out.split("\n").filter(Boolean).map(parseCommit);
}

export async function getFileAtCommit(repo: string, sha: string, filePath: string): Promise<string> {
  assertRef(sha);
  const safe = assertRelativePath(filePath);
  return runGit(["show", `${sha}:${safe}`], { cwd: repo });
}

function stripPrefix(p: string): string {
  return p.replace(/\t.*$/, "").replace(/^[ab]\//, "");
}

export function parseHunks(diff: string): Map<string, Hunk[]> {
  const result = new Map<string, Hunk[]>();
  let oldPath = "";
  let current = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("--- ")) {
      oldPath = line.slice(4) === "/dev/null" ? "" : stripPrefix(line.slice(4));
    } else if (line.startsWith("+++ ")) {
      current = line.slice(4) === "/dev/null" ? oldPath : stripPrefix(line.slice(4));
      if (!result.has(current)) result.set(current, []);
    } else if (line.startsWith("@@") && current) {
      const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (m) {
        result.get(current)!.push({
          oldStart: Number(m[1]),
          oldLines: m[2] === undefined ? 1 : Number(m[2]),
          newStart: Number(m[3]),
          newLines: m[4] === undefined ? 1 : Number(m[4]),
        });
      }
    }
  }
  return result;
}

export async function getDiff(repo: string, baseSha: string, headSha: string): Promise<DiffFile[]> {
  assertRef(baseSha);
  assertRef(headSha);
  const common = ["-c", "core.quotepath=false", "diff", "--no-color", "--no-ext-diff", "-M"];

  const status = await runGit([...common, "--name-status", "-z", baseSha, headSha, "--"], { cwd: repo });
  const patch = await runGit([...common, "-U0", baseSha, headSha, "--"], { cwd: repo });
  const numstat = await runGit([...common, "--numstat", baseSha, headSha, "--"], { cwd: repo });

  const binaryPaths = new Set<string>();
  for (const line of numstat.split("\n")) {
    if (line.startsWith("-\t-\t")) {
      const p = line.slice(4);
      binaryPaths.add(p.includes(" => ") ? p.replace(/.*=> /, "").replace(/}$/, "") : p);
    }
  }

  const hunks = parseHunks(patch);
  const parts = status.split("\0").filter((s) => s.length > 0);
  const files: DiffFile[] = [];

  for (let i = 0; i < parts.length; ) {
    const code = parts[i++]!;
    const kind = code[0];
    if (kind === "R" || kind === "C") {
      const oldPath = parts[i++]!;
      const newPath = parts[i++]!;
      files.push({
        path: newPath, oldPath, changeType: "renamed",
        binary: binaryPaths.has(newPath), hunks: hunks.get(newPath) ?? [],
      });
    } else {
      const p = parts[i++]!;
      const changeType: ChangeType = kind === "A" ? "added" : kind === "D" ? "deleted" : "modified";
      files.push({
        path: p, oldPath: null, changeType,
        binary: binaryPaths.has(p), hunks: hunks.get(p) ?? [],
      });
    }
  }
  return files;
}

export async function listTrackedFilesAtCommit(
  repo: string,
  commitSha: string
): Promise<string[]> {
  assertRef(commitSha);
  const out = await runGit(
    ["-c", "core.quotepath=false", "ls-tree", "-r", "--name-only", "-z", commitSha],
    { cwd: repo }
  );
  return out.split("\0").map((s) => s.trim()).filter((s) => s.length > 0);
}
