import { realpath, stat, lstat, readlink } from "node:fs/promises";
import path from "node:path";
import { runGit } from "./run.js";

const REF_PATTERN = /^[A-Za-z0-9._\/~^@{}]+$/;

export function assertRef(ref: string): string {
  if (
    !ref ||
    ref.length > 200 ||
    ref.startsWith("-") ||
    ref.includes("..") ||
    ref.includes("\0") ||
    ref.includes(" ") ||
    !REF_PATTERN.test(ref)
  ) {
    throw new Error(`Invalid git ref: ${ref}`);
  }
  return ref;
}

export function assertRelativePath(p: string): string {
  if (
    !p ||
    typeof p !== "string" ||
    p.includes("\0") ||
    p.startsWith("-") ||
    p.startsWith("/") ||
    p.startsWith("\\") ||
    /^[A-Za-z]:/.test(p) ||
    path.isAbsolute(p)
  ) {
    throw new Error(`Invalid file path: ${p}`);
  }
  const normalized = path.posix.normalize(p.replace(/\\/g, "/"));
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    throw new Error(`Path escapes repository: ${p}`);
  }
  return normalized;
}

export async function assertSafeRepoPath(
  repoRoot: string,
  relativePath: string
): Promise<string> {
  const normalized = assertRelativePath(relativePath);
  const realRoot = await realpath(repoRoot).catch(() => {
    throw new Error(`Repository path does not exist: ${repoRoot}`);
  });
  const rootStat = await stat(realRoot);
  if (!rootStat.isDirectory()) {
    throw new Error(`Repository path is not a directory: ${repoRoot}`);
  }

  const candidate = path.resolve(realRoot, normalized);
  const rel = path.relative(realRoot, candidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes repository: ${relativePath}`);
  }

  const segments = normalized.split("/").filter(Boolean);
  let current = realRoot;
  for (const seg of segments) {
    current = path.join(current, seg);
    try {
      const st = await lstat(current);
      if (st.isSymbolicLink()) {
        const linkTarget = await readlink(current);
        const resolvedTarget = path.isAbsolute(linkTarget)
          ? linkTarget
          : path.resolve(path.dirname(current), linkTarget);
        let realLinkTarget: string;
        try {
          realLinkTarget = await realpath(resolvedTarget);
        } catch {
          realLinkTarget = resolvedTarget;
        }
        const relLink = path.relative(realRoot, realLinkTarget);
        if (relLink.startsWith("..") || path.isAbsolute(relLink)) {
          throw new Error(`Path escapes repository via symlink: ${relativePath}`);
        }
      } else {
        const realCurrent = await realpath(current);
        const relCurrent = path.relative(realRoot, realCurrent);
        if (relCurrent.startsWith("..") || path.isAbsolute(relCurrent)) {
          throw new Error(`Path escapes repository via symlink: ${relativePath}`);
        }
      }
    } catch (e: any) {
      if (e.code === "ENOENT") {
        break;
      }
      throw e;
    }
  }

  return normalized;
}

export async function assertRepoPath(
  input: string,
  allowedRoot: string = process.cwd()
): Promise<string> {
  const real = await realpath(input).catch(() => {
    throw new Error(`Path does not exist: ${input}`);
  });
  const info = await stat(real);
  if (!info.isDirectory()) throw new Error(`Not a directory: ${input}`);

  const root = await realpath(allowedRoot).catch(() => {
    throw new Error(`Configured allowed root does not exist: ${allowedRoot}`);
  });
  const rel = path.relative(root, real);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path is outside the allowed root: ${allowedRoot}`);
  }

  const top = (await runGit(["rev-parse", "--show-toplevel"], { cwd: real }).catch(() => {
    throw new Error(`Not a git repository: ${input}`);
  })).trim();

  const realTop = await realpath(top);
  if (realTop !== real) throw new Error("Path must be the repository root");
  return real;
}
