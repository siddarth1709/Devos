import type { FastifyPluginAsync } from "fastify";
import { config, type AppConfig } from "../config.js";
import { demoRepo } from "../repo/demoRepo.js";
import {
  parseDemoCookie,
  buildSetDemoCookieHeader,
  buildClearDemoCookieHeader,
} from "../lib/cookies.js";

export const demoRoutes: FastifyPluginAsync = async (app) => {
  const isProduction = process.env.NODE_ENV === "production";

  /**
   * 1. POST /demo/session
   * Establishes an instant demo session without credentials or GitHub OAuth.
   * Rejects with 403 when DEVOS_DEMO_MODE is false.
   */
  app.post("/demo/session", async (request, reply) => {
    const activeConfig: AppConfig =
      (request.server as unknown as { appConfig?: AppConfig }).appConfig ?? config;

    if (!activeConfig.DEVOS_DEMO_MODE) {
      return reply.status(403).send({
        error: {
          code: "DEMO_MODE_DISABLED",
          message:
            "Instant Demo Mode is disabled in this environment. Set DEVOS_DEMO_MODE=true to enable.",
        },
      });
    }

    const { rawToken, expiresAt, user } = demoRepo.createDemoSession();
    const setCookie = buildSetDemoCookieHeader(rawToken, expiresAt, isProduction);

    reply.header("Set-Cookie", setCookie);

    return reply.status(200).send({
      sessionType: "demo",
      user,
      expiresAt: expiresAt.toISOString(),
    });
  });

  /**
   * 2. GET /demo/status
   * Checks whether the requester holds a valid, active demo session.
   */
  app.get("/demo/status", async (request, reply) => {
    const rawToken = parseDemoCookie(request.headers.cookie);
    if (!rawToken) {
      return reply.status(200).send({
        isDemo: false,
        sessionType: null,
        user: null,
      });
    }

    const session = demoRepo.validateDemoSession(rawToken);
    if (!session) {
      // Token was expired or invalid; clear cookie
      reply.header("Set-Cookie", buildClearDemoCookieHeader(isProduction));
      return reply.status(200).send({
        isDemo: false,
        sessionType: null,
        user: null,
      });
    }

    return reply.status(200).send({
      isDemo: true,
      sessionType: "demo",
      user: session.user,
      expiresAt: session.expiresAt.toISOString(),
    });
  });

  /**
   * 3. POST /demo/logout
   * Invalidates the active demo session and clears the demo cookie.
   */
  app.post("/demo/logout", async (request, reply) => {
    const rawToken = parseDemoCookie(request.headers.cookie);
    if (rawToken) {
      demoRepo.invalidateDemoSession(rawToken);
    }

    reply.header("Set-Cookie", buildClearDemoCookieHeader(isProduction));

    return reply.status(200).send({
      success: true,
    });
  });
};
