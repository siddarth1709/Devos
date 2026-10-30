import { realpath, stat } from "node:fs/promises";
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
  if (!p || p.includes("\0") || path.isAbsolute(p) || p.startsWith("-")) {
    throw new Error(`Invalid file path: ${p}`);
  }
  const normalized = path.posix.normalize(p);
  if (normalized.startsWith("..")) throw new Error(`Path escapes repository: ${p}`);
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
