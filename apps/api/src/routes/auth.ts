import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { authRepo } from "../repo/authRepo.js";
import {
  parseSessionCookie,
  buildSetCookieHeader,
  buildClearCookieHeader,
} from "../lib/cookies.js";

const isProduction = process.env.NODE_ENV === "production";

function extractSessionToken(request: any): string | null {
  const authHeader = request.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const candidate = authHeader.slice(7).trim();
    if (candidate) return candidate;
  }
  return parseSessionCookie(request.headers.cookie);
}

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * 1. GET /auth/github
   * Initiates GitHub OAuth flow with cryptographically random state.
   */
  app.get("/auth/github", async (request, reply) => {
    const activeConfig = ((request.server as any).appConfig as typeof config) ?? config;
    const query = request.query as { returnTo?: string };
    const returnTo = query?.returnTo || "/app";

    if (!activeConfig.GITHUB_CLIENT_ID || activeConfig.GITHUB_CLIENT_ID.trim() === "") {
      const acceptsHtml = request.headers.accept?.includes("text/html");
      if (acceptsHtml) {
        return reply.redirect(
          `${activeConfig.FRONTEND_URL}/login?error=github_oauth_not_configured`
        );
      }
      return reply.status(400).send({
        error: {
          code: "GITHUB_OAUTH_NOT_CONFIGURED",
          message:
            "GitHub OAuth Client ID is not configured. Please supply GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in environment.",
        },
      });
    }

    const state = await authRepo.createOAuthState(returnTo);

    const redirectUri = encodeURIComponent(activeConfig.GITHUB_CALLBACK_URL);
    const scope = encodeURIComponent("read:user user:email");
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${activeConfig.GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

    return reply.redirect(githubAuthUrl);
  });

  /**
   * 2. GET /auth/github/callback
   * Handles GitHub redirect, validates state, exchanges code for token, upserts User, sets session cookie.
   */
  app.get("/auth/github/callback", async (request, reply) => {
    const activeConfig = ((request.server as any).appConfig as typeof config) ?? config;
    const query = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    if (query.error) {
      const errReason = encodeURIComponent(query.error_description || query.error);
      return reply.redirect(`${activeConfig.FRONTEND_URL}/login?error=${errReason}`);
    }

    if (!query.code || !query.state) {
      return reply.redirect(`${activeConfig.FRONTEND_URL}/login?error=missing_code_or_state`);
    }

    // Validate and consume state token (single-use)
    const { valid, returnTo } = await authRepo.validateAndConsumeOAuthState(query.state);
    if (!valid) {
      return reply.redirect(`${activeConfig.FRONTEND_URL}/login?error=invalid_or_expired_state`);
    }

    try {
      // Exchange code for GitHub access token
      const tokenResponse = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            client_id: activeConfig.GITHUB_CLIENT_ID,
            client_secret: activeConfig.GITHUB_CLIENT_SECRET,
            code: query.code,
            redirect_uri: activeConfig.GITHUB_CALLBACK_URL,
          }),
        }
      );

      const tokenData = (await tokenResponse.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };

      if (tokenData.error || !tokenData.access_token) {
        const desc = encodeURIComponent(tokenData.error_description || "Token exchange failed");
        return reply.redirect(`${activeConfig.FRONTEND_URL}/login?error=${desc}`);
      }

      const accessToken = tokenData.access_token;

      // Fetch GitHub User Profile
      const profileResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "DEVOS-Auth-Engine/1.0",
        },
      });

      if (!profileResponse.ok) {
        return reply.redirect(`${activeConfig.FRONTEND_URL}/login?error=failed_to_fetch_github_profile`);
      }

      const profile = (await profileResponse.json()) as {
        id: number;
        login: string;
        name?: string | null;
        avatar_url?: string | null;
        email?: string | null;
      };

      let userEmail = profile.email || null;

      // If email is not public, fetch user emails
      if (!userEmail) {
        try {
          const emailsResponse = await fetch("https://api.github.com/user/emails", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "DEVOS-Auth-Engine/1.0",
            },
          });
          if (emailsResponse.ok) {
            const emails = (await emailsResponse.json()) as Array<{
              email: string;
              primary: boolean;
              verified: boolean;
            }>;
            const primary = emails.find((e) => e.primary && e.verified) || emails[0];
            if (primary) userEmail = primary.email;
          }
        } catch {
          // Non-critical if emails cannot be fetched
        }
      }

      // Upsert User in database
      const user = await authRepo.upsertGitHubUser(
        {
          githubId: profile.id.toString(),
          githubUsername: profile.login,
          displayName: profile.name || profile.login,
          avatarUrl: profile.avatar_url || null,
          email: userEmail,
        },
        accessToken
      );

      // Establish session
      const session = await authRepo.createSession(user.id);

      // Set HTTP-only Cookie
      reply.header(
        "Set-Cookie",
        buildSetCookieHeader(session.token, session.expiresAt, isProduction)
      );

      // Redirect user to destination
      const destination = returnTo.startsWith("/") ? returnTo : "/app";
      return reply.redirect(`${activeConfig.FRONTEND_URL}${destination}`);
    } catch (err: unknown) {
      request.log.error({ err }, "OAuth callback exception");
      return reply.redirect(`${activeConfig.FRONTEND_URL}/login?error=oauth_internal_error`);
    }
  });

  /**
   * 3. GET /auth/me
   * Returns authenticated user profile or 401.
   */
  app.get("/auth/me", async (request, reply) => {
    const rawToken = extractSessionToken(request);
    if (!rawToken) {
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "No active session found.",
        },
      });
    }

    const user = await authRepo.validateSession(rawToken);
    if (!user) {
      reply.header("Set-Cookie", buildClearCookieHeader(isProduction));
      return reply.status(401).send({
        error: {
          code: "UNAUTHORIZED",
          message: "Session is invalid or has expired.",
        },
      });
    }

    return {
      user: {
        id: user.id,
        githubId: user.githubId,
        githubUsername: user.githubUsername,
        login: user.githubUsername,
        displayName: user.displayName || user.githubUsername,
        name: user.displayName || user.githubUsername,
        avatarUrl: user.avatarUrl,
        email: user.email,
        role: "developer",
        createdAt: user.createdAt,
      },
    };
  });

  app.get("/auth/github/status", async (request, reply) => {
    const rawToken = extractSessionToken(request);
    if (!rawToken) {
      return {
        status: "not_connected",
      };
    }

    const user = await authRepo.validateSession(rawToken);
    if (!user) {
      reply.header("Set-Cookie", buildClearCookieHeader(isProduction));
      return {
        status: "not_connected",
      };
    }

    return {
      status: "connected",
      user: {
        id: user.id,
        githubId: user.githubId,
        login: user.githubUsername,
        name: user.displayName || user.githubUsername,
        avatarUrl: user.avatarUrl,
        email: user.email,
        role: "developer",
      },
    };
  });

  app.post("/auth/logout", async (request, reply) => {
    const rawToken = extractSessionToken(request);
    if (rawToken) {
      await authRepo.invalidateSession(rawToken);
    }

    reply.header("Set-Cookie", buildClearCookieHeader(isProduction));
    return {
      success: true,
      message: "Successfully logged out.",
    };
  });

  app.post("/auth/github/disconnect", async (request, reply) => {
    const rawToken = extractSessionToken(request);
    if (!rawToken) {
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED", message: "Not logged in" },
      });
    }

    const user = await authRepo.validateSession(rawToken);
    if (!user) {
      reply.header("Set-Cookie", buildClearCookieHeader(isProduction));
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED", message: "Invalid session" },
      });
    }

    await authRepo.clearUserAccessToken(user.id);
    await authRepo.invalidateUserSessions(user.id);
    reply.header("Set-Cookie", buildClearCookieHeader(isProduction));

    return {
      success: true,
      message: "GitHub account connection disconnected.",
    };
  });
};
