# DEVOS — Frontend & Backend Integration Contract Specification

**Author:** Builder 1 (Frontend & Product Interface)  
**Consumer:** Builder 2 (Backend, Database & AI Engine)  
**Application Base URL:** `http://localhost:3001/api` or `http://localhost:4000/api` (Configurable via `NEXT_PUBLIC_API_URL`)  
**Status:** Defined & Integrated in Frontend API Client  

---

## 1. Overview & Protocol Guidelines

- All requests accept and return `application/json`.
- Standard HTTP status codes:
  - `200 OK`: Request succeeded.
  - `201 Created`: Resource created.
  - `400 Bad Request`: Validation failure.
  - `401 Unauthorized`: Missing or invalid session.
  - `403 Forbidden`: Insufficient repository permissions.
  - `404 Not Found`: Resource does not exist.
  - `500 Internal Server Error`: Backend processing error.
- Error response schema:
  ```json
  {
    "message": "Human readable explanation",
    "code": "ERROR_CODE_STRING",
    "details": {}
  }
  ```

---

## 2. Authentication & GitHub Integration

### `GET /api/auth/github/status`
Returns the current user session and GitHub App installation status.

**Response `200 OK`:**
```json
{
  "status": "connected", // "connected" | "not_connected" | "authorizing" | "expired" | "unavailable"
  "connectedAt": "2026-10-30T18:00:00Z",
  "scope": ["repo", "read:org", "read:user"],
  "installedOrganizations": ["siddarth1709"],
  "user": {
    "id": "usr_101",
    "login": "octocat",
    "name": "Mona Lisa Octocat",
    "avatarUrl": "https://avatars.githubusercontent.com/u/583231",
    "email": "octocat@github.com",
    "role": "developer"
  }
}
```

### `POST /api/auth/github/connect`
Initiates GitHub OAuth/App authorization.

**Response `200 OK`:**
```json
{
  "authUrl": "https://github.com/login/oauth/authorize?client_id=...&scope=..."
}
```

### `POST /api/auth/github/disconnect`
Revokes connection token.

**Response `200 OK`:**
```json
{
  "success": true
}
```

---

## 3. Repositories & Branches

### `GET /api/repositories`
Lists all GitHub repositories accessible to the authenticated installation.

**Response `200 OK`:**
```json
[
  {
    "id": "repo_devos",
    "name": "Devos",
    "owner": "siddarth1709",
    "fullName": "siddarth1709/Devos",
    "visibility": "public",
    "defaultBranch": "main",
    "updatedAt": "2026-10-31T01:00:00Z",
    "openPullRequestsCount": 3,
    "webhookConfigured": true
  }
]
```

### `GET /api/repositories/:repositoryId`
Returns metadata for a specific repository.

**Response `200 OK`:**
```json
{
  "id": "repo_devos",
  "name": "Devos",
  "owner": "siddarth1709",
  "fullName": "siddarth1709/Devos",
  "visibility": "public",
  "defaultBranch": "main",
  "pushedAt": "2026-10-31T01:10:00Z",
  "updatedAt": "2026-10-31T01:10:00Z",
  "openIssuesCount": 2,
  "openPullRequestsCount": 3,
  "isMonorepo": true,
  "webhookConfigured": true
}
```

### `GET /api/repositories/:repositoryId/branches`
Lists active Git branches in the repository.

**Response `200 OK`:**
```json
[
  {
    "name": "main",
    "isDefault": true,
    "commitSha": "e4f8a12c8b78901234567890abcdef1234567890",
    "protected": true
  },
  {
    "name": "builder-1/frontend",
    "isDefault": false,
    "commitSha": "9a7d3f1b4c5678901234567890abcdef12345678",
    "protected": false
  }
]
```

---

## 4. Pull Requests, Changed Files & Diffs

### `GET /api/repositories/:repositoryId/pulls`
Lists pull requests for the repository.

**Response `200 OK`:**
```json
[
  {
    "id": "pr_12",
    "number": 12,
    "title": "feat(auth): add JWT session refresh token rotation",
    "description": "Introduces rotating refresh tokens to prevent session hijacking across worker threads.",
    "author": {
      "login": "octocat",
      "avatarUrl": "https://avatars.githubusercontent.com/u/583231"
    },
    "state": "open",
    "sourceBranch": "feature/token-rotation",
    "targetBranch": "main",
    "createdAt": "2026-10-30T14:22:00Z",
    "updatedAt": "2026-10-30T19:15:00Z",
    "changedFilesCount": 4,
    "additionsCount": 182,
    "deletionsCount": 24,
    "analysisStatus": "completed"
  }
]
```

### `GET /api/repositories/:repositoryId/pulls/:pullRequestId`
Returns detailed pull request information.

### `GET /api/repositories/:repositoryId/pulls/:pullRequestId/files`
Lists modified files in the pull request.

**Response `200 OK`:**
```json
[
  {
    "sha": "a1b2c3d4e5f678901234567890abcdef12345678",
    "filename": "apps/api/src/auth/session.ts",
    "status": "modified", // "modified" | "added" | "deleted" | "renamed"
    "additions": 48,
    "deletions": 12,
    "changes": 60,
    "isBinary": false
  }
]
```

### `GET /api/repositories/:repositoryId/pulls/:pullRequestId/diff?path=:filePath`
Returns unified diff patch content for a specific file.

**Response `200 OK`:**
```json
{
  "filename": "apps/api/src/auth/session.ts",
  "status": "modified",
  "additions": 48,
  "deletions": 12,
  "isBinary": false,
  "patch": "@@ -40,12 +40,48 @@ export class SessionManager {\n-  async verify(token: string): Promise<Session> {\n+  async verify(token: string, rotate: boolean = false): Promise<Session> {\n+    const payload = await jwt.verify(token);\n+    if (rotate) {\n+      return this.rotateSession(payload);\n+    }\n     return payload;\n   }"
}
```

---

## 5. Analysis Trigger

### `POST /api/repositories/:repositoryId/pulls/:pullRequestId/analysis`
Triggers AST parsing, transitive dependency impact mapping, and Gemma reasoning.

**Response `200 OK`:**
```json
{
  "jobId": "job_99812",
  "repositoryId": "repo_devos",
  "pullRequestId": "12",
  "status": "running",
  "progressPercent": 15,
  "currentStep": "Parsing AST and Symbol References",
  "createdAt": "2026-10-31T01:30:00Z"
}
```

