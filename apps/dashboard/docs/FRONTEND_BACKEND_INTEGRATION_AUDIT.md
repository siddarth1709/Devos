# DEVOS — Frontend-to-Backend Integration Audit

**Date:** 2026-10-31  
**Auditor:** DEVOS Builder 1 (Frontend & Systems Integration)  
**Status:** Live Integration Assessment & Contract Matrix  

---

## 1. Executive Summary

This document establishes the authoritative contract between the DEVOS Next.js frontend (`apps/dashboard`) and the Fastify backend engine (`apps/api`). Every API client method, hook, and dashboard screen has been audited against actual source code in `apps/api/src/routes/` and `packages/contracts/src/index.ts`.

All frontend components are transitioned from optimistic or fixture assumptions to deterministic consumption of real backend data. Where endpoints do not yet exist on the backend, the frontend explicitly handles them with truthful empty or unavailable states without fabricating data.

---

## 2. API Method & Endpoint Audit Matrix

| Frontend Method | Screen(s) | Expected Method & URL | Backend Route Registered? | Actual Request Schema | Actual Response Schema | Auth Requirements | Integration Status | Required Frontend Changes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `getCurrentUser()` | AuthProvider, Nav, UserMenu | `GET /api/auth/me` | **YES** (`routes/auth.ts:186`) | None | `{ user: { id, githubId, githubUsername, login, displayName, name, avatarUrl, email, role, createdAt } }` | Session Cookie (`devos_session`) | **Supported** | Adapt user profile fields to support both `githubUsername` and `login`. |
| `logout()` | UserMenu, Account Settings | `POST /api/auth/logout` | **YES** (`routes/auth.ts:263`) | `{}` | `{ success: boolean, message: string }` | Session Cookie | **Supported** | Clear TanStack Query auth cache and navigate to `/login`. |
| `getGitHubStatus()` | Console, ContextSelector, Login | `GET /api/auth/github/status` | **YES** (`routes/auth.ts:229`) | None | `{ status: "connected" \| "not_connected", user?: UserProfile }` | Optional Session Cookie | **Supported** | Directly consumed by auth hooks. |
| `initiateGitHubConnect()` | ConnectGitHubModal | `POST /api/auth/github/connect` | **MISMATCH** (`routes/auth.ts:18`) | N/A (Backend exposes `GET /auth/github?returnTo=...`) | 302 Redirect to GitHub OAuth Authorize | None | **Mismatched** | Replace POST request with direct browser redirect to `GET ${API_BASE_URL}/auth/github?returnTo=...`. |
| `disconnectGitHub()` | Account Settings | `POST /api/auth/github/disconnect` | **YES** (`routes/auth.ts:280`) | None | `{ success: boolean, message: string }` | Session Cookie | **Supported** | Invalidate auth queries and clear cookies. |
| `createDemoSession()` | Landing Page, Login Page | `POST /api/demo/session` | **YES** (`routes/demo.ts:18`) | `{}` | `{ sessionType: "demo", user: UserProfile, expiresAt: string }` | Controlled by `DEVOS_DEMO_MODE=true` | **Supported** | Do not fake demo mode if backend returns 403 (demo disabled). |
| `getDemoStatus()` | AuthProvider | `GET /api/demo/status` | **YES** (`routes/demo.ts:48`) | None | `{ isDemo: boolean, sessionType: string \| null, user: UserProfile \| null, expiresAt?: string }` | None (reads `devos_demo_session` cookie) | **Supported** | Integrates directly into React context. |
| `logoutDemo()` | DemoBanner, UserMenu | `POST /api/demo/logout` | **YES** (`routes/demo.ts:81`) | None | `{ success: boolean }` | Demo Cookie | **Supported** | Invalidate all queries and reset state to guest. |
| `getRepositories()` | Overview, Repositories, ContextSelector | `GET /api/repositories` | **YES** (`routes/repositories.ts:17`) | None | `{ repositories: Array<{ id, name, path, defaultBranch, createdAt }> }` | None | **Mismatched Shape** | Backend returns `{ repositories: [...] }`. Add response adapter unwrapping array. Explicitly mark unavailable fields (owner, prCount) instead of fabricating. |
| `getRepository(id)` | Repository Details | `GET /api/repositories/:id` | **YES** (`routes/repositories.ts:31`) | Params: `{ id }` | `{ id, name, path, defaultBranch, createdAt }` | None | **Supported** | Display real repository path, name, default branch, and creation date. |
| `createRepository(data)` | Repository Registration | `POST /api/repositories` | **YES** (`routes/repositories.ts:55`) | `{ name?: string, path: string, defaultBranch?: string }` | `{ id, name, path, defaultBranch, createdAt }` | None | **Supported** | Add method to API client and connect registration modal to real backend. |
| `getBranches(repoId)` | Repository Details | `GET /api/repositories/:id/branches` | **NO** | N/A | N/A | N/A | **Unavailable** | Do not call non-existent endpoint. Display repository defaultBranch from entity. |
| `getPullRequests(repoId)` | Repository Details, ContextSelector | `GET /api/repositories/:id/pulls` | **NO** | N/A | N/A | N/A | **Unavailable** | Backend analysis is commit-based (`POST /api/analyses`). Avoid fake PR generation; provide direct analysis execution input (baseSha / headSha). |
| `triggerAnalysis(repo, pr)` | PR Review | `POST /api/repositories/:id/pulls/:pr/analysis` | **MISMATCH** (`routes/analyses.ts:213`) | `{ repositoryId, baseSha, headSha }` | `AnalysisJob` | None | **Mismatched** | Adapt frontend to call `POST /api/analyses` with `repositoryId`, `baseSha`, and `headSha`. |
| `getAnalysisStatus(id)` | Analysis Progress | `GET /api/analyses/:id` | **YES** (`routes/analyses.ts:418`) | Params: `{ id }` | `{ job: AnalysisJob, report?: AnalysisReport \| null }` | None | **Supported** | Persist active analysis ID in context; poll while status is `running`. |
| `getAnalysisReport(id)` | Review, Guard | `GET /api/analyses/:id` | **YES** (`routes/analyses.ts:418`) | Params: `{ id }` | `{ job: AnalysisJob, report?: AnalysisReport \| null }` | None | **Supported** | Parse `report` envelope when analysis lifecycle is `completed`. |
| `getDependencyGraph(repo, id)` | Engineering Graph | `GET /api/repositories/:id/graph` | **MISMATCH** | `GET /api/analyses/:id/impact` | `ImpactReport` (`summary`, `results: ImpactResultItem[]`) | None | **Mismatched** | Transform real backend `ImpactResultItem[]` and `AnalysisReport.changedSymbols` into React Flow nodes and edges. |
| `getChangeReview(id)` | AI Code Review | `GET /api/analyses/:id/review` | **YES** (`routes/analyses.ts:694`) | Params: `{ id }` | `ChangeReviewReport` | None | **Supported** | Add API client method and connect Review screen to real `verifiedFindings`, `suggestedReviewAreas`, and `missingEvidence`. |
| `getPreShipHealth(id)` | Pre-Ship Guard | `GET /api/analyses/:id/health` | **YES** (`routes/analyses.ts:816`) | Params: `{ id }` | `PreShipHealthReport` (`overallStatus`, `checks[]`, counts) | None | **Supported** | Add API client method and connect Guard screen to real deterministic health check checks. |
| `evaluateReleaseGate(id, policy)` | Pre-Ship Guard | `POST /api/analyses/:id/health/gate` | **YES** (`routes/analyses.ts:868`) | `{ policy?: ReleaseGatePolicy }` | `ReleaseGateEvaluation` (`passed`, `gateStatus`, `blockingReasons`) | None | **Supported** | Add API client method and connect to Gate evaluation button and status indicators. |
| `getActions()`, `createAction()`, `approveAction()` | Secure Actions | `GET/POST /api/actions` | **NO** | N/A | N/A | N/A | **Unavailable** | Do not issue requests to non-existent `/actions` endpoints. Display clear "Engine Capability Scheduled" state in Actions interface. |

---

## 3. Analysis Lifecycle Integration Rules

The Fastify backend implements a deterministic, multi-stage analysis pipeline:
1. `POST /api/analyses`: Initiates Git diff extraction, AST symbol extraction, dependency graph generation, impact traversal, risk scoring, and lifecycle completion. Returns `201 Created` with `CreateAnalysisResponse` (`status: "completed"` or `"partial"`).
2. `GET /api/analyses/:id`: Returns `{ job, report }`. When `status === "completed"`, `report` contains deterministic `findings`, `changedSymbols`, `impact`, `readiness`, and `trustMeter`.
3. `GET /api/analyses/:id/impact`: Returns forensic blast radius results (`results: ImpactResultItem[]`).
4. `GET /api/analyses/:id/review`: Returns verified change review findings and suggested focus areas.
5. `GET /api/analyses/:id/health`: Returns 8 pre-ship health checks across Git, AST, Graph, Impact, Risk, and Environment categories.
6. `POST /api/analyses/:id/health/gate`: Evaluates codified release gate policies and returns blocking reasons.

---

## 4. Frontend Transformation & Adapter Architecture

1. **Repository Adapter:**
   - Input: `{ repositories: Array<RepositoryContract> }`
   - Output: `Repository[]` where missing GitHub metadata (`owner`, `openPullRequestsCount`) is explicitly typed as optional/unavailable.
2. **Impact to Engineering Graph Adapter:**
   - Input: `ImpactResultItem[]` from `GET /api/analyses/:id/impact` + `changedSymbols` from `GET /api/analyses/:id`.
   - Output: React Flow nodes (with actual file paths, symbols, line numbers, and classification tags: `root_cause`, `direct`, `transitive`) and edges (from `edgeKeys`, `relationshipTypes`).
3. **Pre-Ship Guard Adapter:**
   - Input: `PreShipHealthReport` from `GET /api/analyses/:id/health` + `ReleaseGateEvaluation` from `POST /api/analyses/:id/health/gate`.
   - Output: Maps health checks to Guard check categories (`git`, `ast`, `graph`, `impact`, `risk`, `environment`).
4. **Error Envelope Normalization:**
   - Fastify returns `{ error: { code: string, message: string } }`.
   - `DevosApiClient` extracts `error.code` and `error.message` with HTTP status retention.

