import crypto from "node:crypto";
import { prisma } from "../db.js";
import type { User } from "@prisma/client";

export interface GitHubUserProfile {
  githubId: string;
  githubUsername: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}

export class AuthRepository {
  /**
   * Generates a cryptographically secure random state token,
   * associates it with an optional safe returnTo path, and persists it.
   */
  async createOAuthState(returnTo?: string): Promise<string> {
    const state = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes TTL

    await prisma.oAuthState.create({
      data: {
        state,
        returnTo: returnTo || "/app",
        expiresAt,
      },
    });

    return state;
  }

  /**
   * Validates and single-use consumes the OAuth state to prevent replay attacks.
   */
  async validateAndConsumeOAuthState(
    state: string
  ): Promise<{ valid: boolean; returnTo: string }> {
    if (!state || typeof state !== "string") {
      return { valid: false, returnTo: "/app" };
    }

    const record = await prisma.oAuthState.findUnique({
      where: { state },
    });

    if (!record) {
      return { valid: false, returnTo: "/app" };
    }

    // Always delete to ensure single-use
    await prisma.oAuthState.delete({
      where: { id: record.id },
    });

    if (record.expiresAt < new Date()) {
      return { valid: false, returnTo: "/app" };
    }

    // Ensure returnTo is a safe relative path starting with /
    let safeReturnTo = "/app";
    if (record.returnTo && record.returnTo.startsWith("/") && !record.returnTo.startsWith("//")) {
      safeReturnTo = record.returnTo;
    }

    return { valid: true, returnTo: safeReturnTo };
  }

  /**
   * Upserts a local User record from verified GitHub profile data.
   */
  async upsertGitHubUser(profile: GitHubUserProfile): Promise<User> {
    return prisma.user.upsert({
      where: { githubId: profile.githubId },
      update: {
        githubUsername: profile.githubUsername,
        displayName: profile.displayName || profile.githubUsername,
        avatarUrl: profile.avatarUrl,
        email: profile.email,
        updatedAt: new Date(),
      },
      create: {
        githubId: profile.githubId,
        githubUsername: profile.githubUsername,
        displayName: profile.displayName || profile.githubUsername,
        avatarUrl: profile.avatarUrl,
        email: profile.email,
      },
    });
  }

  /**
   * Creates a database-backed session using a hashed token.
   * Only the hash is stored in PostgreSQL/SQLite; the raw token is returned to be set in the cookie.
   */
  async createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    await prisma.session.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    });

    return { token: rawToken, expiresAt };
  }

  /**
   * Validates a raw session token against the database.
   * If valid and not expired, updates lastActivityAt and returns the User record.
   */
  async validateSession(rawToken: string): Promise<User | null> {
    if (!rawToken || typeof rawToken !== "string") {
      return null;
    }

    const tokenHash = this.hashToken(rawToken);

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt < new Date()) {
      // Session has expired, remove it asynchronously
      prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    // Touch lastActivityAt if more than 5 minutes old
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (session.lastActivityAt < fiveMinutesAgo) {
      prisma.session
        .update({
          where: { id: session.id },
          data: { lastActivityAt: new Date() },
        })
        .catch(() => {});
    }

    return session.user;
  }

  /**
   * Invalidates a single session by token.
   */
  async invalidateSession(rawToken: string): Promise<boolean> {
    if (!rawToken || typeof rawToken !== "string") return false;

    const tokenHash = this.hashToken(rawToken);
    try {
      await prisma.session.delete({
        where: { tokenHash },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Invalidates all active sessions for a user (e.g. on disconnect or password reset).
   */
  async invalidateUserSessions(userId: string): Promise<number> {
    const res = await prisma.session.deleteMany({
      where: { userId },
    });
    return res.count;
  }

  /**
   * Computes a SHA-256 hash of a raw token.
   */
  private hashToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken).digest("hex");
  }
}

export const authRepo = new AuthRepository();

