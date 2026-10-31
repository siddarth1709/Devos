# GitHub OAuth Setup & Architecture Guide

DEVOS uses a production-grade, secure, database-backed GitHub OAuth 2.0 flow. This document details the exact configuration required in GitHub Developer Settings and describes the end-to-end security architecture.

---

## 1. Creating a GitHub OAuth Application

1. Navigate to **[GitHub Developer Settings > OAuth Apps](https://github.com/settings/developers)**.
2. Click **New OAuth App** (or **Register a new application**).
3. Fill in the application registration form with the following details:

| Field | Development Value | Production Value |
|---|---|---|
| **Application name** | `DEVOS Intelligence System` | `DEVOS Intelligence System` |
| **Homepage URL** | `http://localhost:3000` | `https://your-domain.com` |
| **Application description** | Engineering Intelligence & Change Impact System | Engineering Intelligence & Change Impact System |
| **Authorization callback URL** | `http://localhost:3001/api/auth/github/callback` | `https://api.your-domain.com/api/auth/github/callback` |

4. Click **Register application**.
5. Copy the generated **Client ID**.
6. Under **Client secrets**, click **Generate a new client secret** and copy the generated value.

---

## 2. Environment Configuration

### Backend (`apps/api/.env`)
Add the credentials to `apps/api/.env`:

```bash
# Server configuration
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

# Database connection
DATABASE_URL=file:./dev.db

# Frontend origin (used for CORS and redirect destination)
FRONTEND_URL=http://localhost:3000

# High-entropy random secret (32+ characters)
SESSION_SECRET=devos-session-secret-change-in-production-min32chars

# GitHub OAuth credentials
GITHUB_CLIENT_ID=gh_client_id_from_github
GITHUB_CLIENT_SECRET=gh_client_secret_from_github
GITHUB_CALLBACK_URL=http://localhost:3001/api/auth/github/callback
```

### Frontend (`apps/dashboard/.env.local`)
Add the API URL to `apps/dashboard/.env.local`:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## 3. End-to-End Authentication Architecture

```
User Browser                  DEVOS Dashboard (Port 3000)             DEVOS API (Port 3001)             GitHub OAuth API
     |                                    |                                    |                               |
     | ----- 1. Click "Sign in" --------> |                                    |                               |
     |                                    | ----- 2. Redirect to /auth/github >|                               |
     |                                    |                                    | -- 3. Generate secure state ->|
     |                                    |                                    |    Store in OAuthState DB     |
     | <---------------- 4. 302 Redirect to GitHub Authorization URL ----------|                               |
     |                                                                         |                               |
     | ----------------------- 5. User Authorizes DEVOS -----------------------------------------------------> |
     |                                                                         |                               |
     | <---------------------- 6. 302 Redirect to Callback URL with code & state ------------------------------|
     |                                    |                                    |                               |
     | ---------------------------------- 7. GET /api/auth/github/callback --->|                               |
     |                                    |                                    | -- 8. Consume single-use state|
     |                                    |                                    |    Exchange code for token -->|
     |                                    |                                    | <---------------------------- |
     |                                    |                                    | -- 9. Fetch GitHub /user &    |
     |                                    |                                    |       /user/emails ---------->|
     |                                    |                                    | <---------------------------- |
     |                                    |                                    | -- 10. Upsert User in DB      |
     |                                    |                                    | -- 11. Create Session in DB   |
     |                                    |                                    |        (Store SHA-256 hash)   |
     | <--------------------------------- 12. Set HTTP-only 'devos_session' --|                               |
     |                                        302 Redirect to /auth/callback   |                               |
     |                                                                         |                               |
     | -- 13. Navigates to /auth/callback -> Refresh user state via GET /auth/me                              |
     | -- 14. Redirect to returnTo destination (/app)                          |                               |
```

---

## 4. Security & Hardening Properties

1. **Zero Client Secret Exposure:**
   - The GitHub Client Secret is never exposed to the frontend or bundled into client assets.
   - All OAuth token exchanges occur purely server-side on Fastify (`apps/api`).

2. **Single-Use Anti-CSRF OAuth State:**
   - When OAuth starts, a 32-byte cryptographically random `state` token is generated and stored in the database with an expiration timestamp (10 minutes).
   - In the callback, the state is retrieved and **immediately deleted** in the same transaction. Replay attempts fail with `400 Bad Request`.

3. **Hashed Session Tokens:**
   - Raw session tokens are never stored in the database.
   - The database stores only the `SHA-256` hash of the session token. Even in the event of a database leak, active sessions cannot be forged.

4. **HTTP-Only, SameSite Cookies:**
   - The raw session token is issued in an `HttpOnly`, `SameSite=Lax`, `Path=/` cookie named `devos_session`.
   - In production (`NODE_ENV=production`), the `Secure` flag is enforced so cookies only transmit over HTTPS.

5. **Strict Origin Validation & CORS:**
   - CORS is configured to allow requests only from verified `FRONTEND_URL` with `credentials: true`. Wildcards (`*`) are disallowed.

6. **Zero Code Retention Guarantee:**
   - DEVOS requests minimal scopes (`read:user`, `user:email`).
   - Repository source code is analyzed ephemerally in-memory for AST and dependency graphs; source code is never permanently persisted.

---

## 5. Verification Commands

Run API test suite to verify OAuth and session handling:
```bash
DATABASE_URL="file:./dev.db" pnpm --filter api test
```

Run Dashboard typechecks and build:
```bash
pnpm --filter dashboard typecheck
pnpm --filter dashboard build
```

