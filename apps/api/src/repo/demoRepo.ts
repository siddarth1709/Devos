import crypto from "crypto";

export interface DemoUser {
  id: string;
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: string;
  isDemo: true;
}

export const DEMO_USER: DemoUser = {
  id: "devos-demo-user",
  login: "demo-investigator",
  name: "DEVOS Demo Investigator",
  email: "demo@devos.internal",
  avatarUrl: "/brand/devos-mark.png",
  role: "Demo Investigator",
  isDemo: true,
};

export interface DemoSessionRecord {
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
}

class DemoRepository {
  private sessions = new Map<string, DemoSessionRecord>();

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  createDemoSession(ttlMs: number = 4 * 60 * 60 * 1000): {
    rawToken: string;
    expiresAt: Date;
    user: DemoUser;
  } {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    this.sessions.set(tokenHash, {
      tokenHash,
      createdAt: now,
      expiresAt,
    });

    return {
      rawToken,
      expiresAt,
      user: DEMO_USER,
    };
  }

  validateDemoSession(rawToken: string): { user: DemoUser; expiresAt: Date } | null {
    if (!rawToken || typeof rawToken !== "string") {
      return null;
    }

    const tokenHash = this.hashToken(rawToken);
    const session = this.sessions.get(tokenHash);

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      this.sessions.delete(tokenHash);
      return null;
    }

    return {
      user: DEMO_USER,
      expiresAt: session.expiresAt,
    };
  }

  invalidateDemoSession(rawToken: string): boolean {
    if (!rawToken || typeof rawToken !== "string") {
      return false;
    }
    const tokenHash = this.hashToken(rawToken);
    return this.sessions.delete(tokenHash);
  }

  clearAll(): void {
    this.sessions.clear();
  }
}

export const demoRepo = new DemoRepository();

