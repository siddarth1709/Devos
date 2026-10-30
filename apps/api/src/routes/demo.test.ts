import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import { demoRepo, DEMO_USER } from "../repo/demoRepo.js";
import { parseCookie, DEMO_COOKIE_NAME } from "../lib/cookies.js";

describe("Demo Access Routes (/api/demo/*)", () => {
  beforeEach(() => {
    demoRepo.clearAll();
  });

  afterEach(() => {
    demoRepo.clearAll();
  });

  it("POST /api/demo/session rejects with 403 when DEVOS_DEMO_MODE is false", async () => {
    const config = loadConfig({
      DEVOS_DEMO_MODE: "false",
      DATABASE_URL: "file:./dev.db",
    });

    const app = await buildApp({ appConfig: config, logger: false });

    const res = await app.inject({
      method: "POST",
      url: "/api/demo/session",
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error?.code).toBe("DEMO_MODE_DISABLED");
    await app.close();
  });

  it("POST /api/demo/session creates demo session and sets secure cookie when DEVOS_DEMO_MODE is true", async () => {
    const config = loadConfig({
      DEVOS_DEMO_MODE: "true",
      DATABASE_URL: "file:./dev.db",
    });

    const app = await buildApp({ appConfig: config, logger: false });

    const res = await app.inject({
      method: "POST",
      url: "/api/demo/session",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sessionType).toBe("demo");
    expect(body.user.id).toBe(DEMO_USER.id);
    expect(body.user.login).toBe(DEMO_USER.login);
    expect(body.user.isDemo).toBe(true);

    const setCookie = res.headers["set-cookie"] as string;
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain(`${DEMO_COOKIE_NAME}=`);
    expect(setCookie).toContain("HttpOnly");

    await app.close();
  });

  it("GET /api/demo/status reports isDemo: false when no demo cookie is sent", async () => {
    const config = loadConfig({
      DEVOS_DEMO_MODE: "true",
      DATABASE_URL: "file:./dev.db",
    });

    const app = await buildApp({ appConfig: config, logger: false });

    const res = await app.inject({
      method: "GET",
      url: "/api/demo/status",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.isDemo).toBe(false);
    expect(body.user).toBeNull();

    await app.close();
  });

  it("GET /api/demo/status reports isDemo: true and user details when holding valid demo cookie", async () => {
    const config = loadConfig({
      DEVOS_DEMO_MODE: "true",
      DATABASE_URL: "file:./dev.db",
    });

    const app = await buildApp({ appConfig: config, logger: false });

    // 1. Create demo session
    const createRes = await app.inject({
      method: "POST",
      url: "/api/demo/session",
    });
    expect(createRes.statusCode).toBe(200);

    const setCookie = createRes.headers["set-cookie"] as string;
    const cookies = parseCookie(setCookie);
    const demoToken = cookies[DEMO_COOKIE_NAME];
    expect(demoToken).toBeDefined();

    // 2. Query status with cookie
    const statusRes = await app.inject({
      method: "GET",
      url: "/api/demo/status",
      headers: {
        cookie: `${DEMO_COOKIE_NAME}=${demoToken}`,
      },
    });

    expect(statusRes.statusCode).toBe(200);
    const body = statusRes.json();
    expect(body.isDemo).toBe(true);
    expect(body.sessionType).toBe("demo");
    expect(body.user.login).toBe(DEMO_USER.login);

    await app.close();
  });

  it("POST /api/demo/logout invalidates demo session and clears cookie", async () => {
    const config = loadConfig({
      DEVOS_DEMO_MODE: "true",
      DATABASE_URL: "file:./dev.db",
    });

    const app = await buildApp({ appConfig: config, logger: false });

    // 1. Create session
    const createRes = await app.inject({
      method: "POST",
      url: "/api/demo/session",
    });
    const setCookie = createRes.headers["set-cookie"] as string;
    const cookies = parseCookie(setCookie);
    const demoToken = cookies[DEMO_COOKIE_NAME];

    // 2. Logout
    const logoutRes = await app.inject({
      method: "POST",
      url: "/api/demo/logout",
      headers: {
        cookie: `${DEMO_COOKIE_NAME}=${demoToken}`,
      },
    });

    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json().success).toBe(true);

    const logoutCookie = logoutRes.headers["set-cookie"] as string;
    expect(logoutCookie).toContain("Max-Age=0");

    // 3. Status should now be false
    const statusRes = await app.inject({
      method: "GET",
      url: "/api/demo/status",
      headers: {
        cookie: `${DEMO_COOKIE_NAME}=${demoToken}`,
      },
    });

    expect(statusRes.json().isDemo).toBe(false);

    await app.close();
  });

  it("rejects expired demo sessions", async () => {
    // Create an already-expired session directly in demoRepo with negative TTL
    const { rawToken } = demoRepo.createDemoSession(-1000);

    const config = loadConfig({
      DEVOS_DEMO_MODE: "true",
      DATABASE_URL: "file:./dev.db",
    });

    const app = await buildApp({ appConfig: config, logger: false });

    const statusRes = await app.inject({
      method: "GET",
      url: "/api/demo/status",
      headers: {
        cookie: `${DEMO_COOKIE_NAME}=${rawToken}`,
      },
    });

    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json().isDemo).toBe(false);

    await app.close();
  });
});
