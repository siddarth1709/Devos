export const SESSION_COOKIE_NAME = "devos_session";
export const DEMO_COOKIE_NAME = "devos_demo_session";

export function parseCookie(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const key = pair.substring(0, idx).trim();
    const val = pair.substring(idx + 1).trim();
    try {
      cookies[key] = decodeURIComponent(val);
    } catch {
      cookies[key] = val;
    }
  }

  return cookies;
}

export function parseSessionCookie(cookieHeader?: string): string | null {
  const cookies = parseCookie(cookieHeader);
  return cookies[SESSION_COOKIE_NAME] || null;
}

export function parseDemoCookie(cookieHeader?: string): string | null {
  const cookies = parseCookie(cookieHeader);
  return cookies[DEMO_COOKIE_NAME] || null;
}

export function buildSetCookieHeader(
  token: string,
  expiresAt: Date,
  isProduction: boolean
): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=/`,
    `Expires=${expiresAt.toUTCString()}`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];

  if (isProduction) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function buildClearCookieHeader(isProduction: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    `Path=/`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `Max-Age=0`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];

  if (isProduction) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function buildSetDemoCookieHeader(
  token: string,
  expiresAt: Date,
  isProduction: boolean
): string {
  const parts = [
    `${DEMO_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Path=/`,
    `Expires=${expiresAt.toUTCString()}`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];

  if (isProduction) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function buildClearDemoCookieHeader(isProduction: boolean): string {
  const parts = [
    `${DEMO_COOKIE_NAME}=`,
    `Path=/`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `Max-Age=0`,
    `HttpOnly`,
    `SameSite=Lax`,
  ];

  if (isProduction) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

