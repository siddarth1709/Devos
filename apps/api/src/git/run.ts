import { spawn } from "node:child_process";

export type GitErrorCode = "TIMEOUT" | "OUTPUT_TOO_LARGE" | "FAILED" | "SPAWN";

export class GitError extends Error {
  constructor(
    message: string,
    public readonly code: GitErrorCode,
    public readonly stderr = "",
  ) {
    super(message);
    this.name = "GitError";
  }
}

export interface RunOptions {
  cwd: string;
  timeoutMs?: number;
  maxBytes?: number;
}

export function runGit(args: string[], opts: RunOptions): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024;

  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: opts.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_OPTIONAL_LOCKS: "0",
        LC_ALL: "C",
      },
    });

    const chunks: Buffer[] = [];
    let size = 0;
    let stderr = "";
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      settle(() => reject(new GitError("git timed out", "TIMEOUT")));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        child.kill("SIGKILL");
        settle(() => reject(new GitError("git output too large", "OUTPUT_TOO_LARGE")));
        return;
      }
      chunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 4000) stderr += chunk.toString();
    });

    child.on("error", (err) => settle(() => reject(new GitError(err.message, "SPAWN"))));

    child.on("close", (code) =>
      settle(() => {
        if (code === 0) resolve(Buffer.concat(chunks).toString("utf8"));
        else reject(new GitError(`git exited with code ${code}`, "FAILED", stderr));
      }),
    );
  });
}

