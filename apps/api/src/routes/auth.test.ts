import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { authRepo } from "../repo/authRepo.js";
import { prisma } from "../db.js";

describe("Authentication & Session System", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      logger: false,
      appConfig: loadConfig({
        CORS_ORIGIN: "http://localhost:3000",
        GITHUB_CLIENT_ID: "mock_client_id_123",
        GITHUB_CLIENT_SECRET: "mock_client_secret_xyz",
        GITHUB_CALLBACK_URL: "http://localhost:3001/api/auth/github/callback",
        FRONTEND_URL: "http://localhost:3000",
      }),
    });
    await app.ready();
  });

  afterAll(async () => {
    // Clean up test users and sessions
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    await prisma.oAuthState.deleteMany();
    await app.close();
  });

  describe("OAuth State Management", () => {
    it("generates a 64-char hex state and persists it with returnTo", async () => {
      const state = await authRepo.createOAuthState("/app/guard");
      expect(state).toHaveLength(64);

      const record = await prisma.oAuthState.findUnique({ where: { state } });
      expect(record).not.toBeNull();
      expect(record?.returnTo).toBe("/app/guard");
      expect(record?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("validates and consumes state once (prevents replay)", async () => {
      const state = await authRepo.createOAuthState("/app/review");

      // First consumption: valid
      const first = await authRepo.validateAndConsumeOAuthState(state);
      expect(first.valid).toBe(true);
      expect(first.returnTo).toBe("/app/review");

      // Second consumption (replay attempt): invalid
      const second = await authRepo.validateAndConsumeOAuthState(state);
      expect(second.valid).toBe(false);
    });

    it("rejects expired states", async () => {
      // Create manually expired state
      const expiredState = "expired_state_token_1234567890abcdef";
      await prisma.oAuthState.create({
        data: {
          state: expiredState,
          returnTo: "/app",
          expiresAt: new Date(Date.now() - 1000), // in the past
        },
      });

      const result = await authRepo.validateAndConsumeOAuthState(expiredState);
      expect(result.valid).toBe(false);
    });
  });

  describe("GET /api/auth/github (OAuth initiation)", () => {
    it("redirects to GitHub authorization URL with client_id, state and scope", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/github?returnTo=/app/guard",
      });

      expect(response.statusCode).toBe(302);
      const location = response.headers.location as string;
      expect(location).toContain("https://github.com/login/oauth/authorize");
      expect(location).toContain("client_id=mock_client_id_123");
      expect(location).toContain("scope=read%3Auser%20user%3Aemail");
      expect(location).toContain("state=");
    });

    it("fails gracefully with 400 if GITHUB_CLIENT_ID is not configured", async () => {
      const unconfiguredApp = await buildApp({
        logger: false,
        appConfig: loadConfig({
          GITHUB_CLIENT_ID: "",
        }),
      });
      await unconfiguredApp.ready();

      const response = await unconfiguredApp.inject({
        method: "GET",
        url: "/api/auth/github",
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error.code).toBe("GITHUB_OAUTH_NOT_CONFIGURED");

      await unconfiguredApp.close();
    });
  });

  describe("Session Lifecycle & Protected Endpoints", () => {
    let testUser: any;
    let validSessionToken: string;

    beforeAll(async () => {
      testUser = await authRepo.upsertGitHubUser({
        githubId: "gh_test_999888",
        githubUsername: "octocat_developer",
        displayName: "The Octocat",
        avatarUrl: "https://github.com/images/error/octocat_happy.gif",
        email: "octocat@github.com",
      });

      const session = await authRepo.createSession(testUser.id);
      validSessionToken = session.token;
    });

    it("GET /api/auth/me returns 401 when no session cookie is provided", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("GET /api/auth/me returns 401 and clears cookie when invalid token is provided", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          cookie: "devos_session=invalid_non_existent_token_string",
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.headers["set-cookie"]).toContain("Max-Age=0");
    });

    it("GET /api/auth/me returns user profile when valid session cookie is provided", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          cookie: `devos_session=${validSessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user).toMatchObject({
        id: testUser.id,
        githubId: "gh_test_999888",
        githubUsername: "octocat_developer",
        displayName: "The Octocat",
        email: "octocat@github.com",
      });
    });

    it("GET /api/auth/github/status returns status: connected with user metadata", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/github/status",
        headers: {
          cookie: `devos_session=${validSessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe("connected");
      expect(body.user.login).toBe("octocat_developer");
    });

    it("GET /api/auth/github/status returns status: not_connected when unauthenticated", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/github/status",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe("not_connected");
      expect(body.user).toBeUndefined();
    });

    it("POST /api/auth/logout invalidates session and clears cookie", async () => {
      // First ensure session is valid
      const before = await authRepo.validateSession(validSessionToken);
      expect(before).not.toBeNull();

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
        headers: {
          cookie: `devos_session=${validSessionToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["set-cookie"]).toContain("Max-Age=0");

      // Verify token in database is gone
      const after = await authRepo.validateSession(validSessionToken);
      expect(after).toBeNull();
    });
  });
});

