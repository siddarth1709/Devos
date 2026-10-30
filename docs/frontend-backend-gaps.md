# DEVOS — Frontend & Backend API Contract Gaps & Coordination Ledger

> **Author:** Builder 1 (Frontend, Product Experience & UI/UX Owner)  
> **Target Audience:** Builder 2 (Backend & Engine Owner), Product Architects  
> **Status:** Active Tracking Document  
> **Last Updated:** October 31, 2026

---

## 1. Executive Summary

This document audits the integration boundaries between the Frontend Dashboard (`apps/dashboard`), the Backend API (`apps/api`), and the CLI (`packages/cli`).

In strict compliance with Prompt 06 Section 0 (Non-Negotiable Rules) and Section 1.1 (Honest Data Handling):
- Frontend **never invents fake backend telemetry** or simulates unverified execution.
- Missing endpoints and incomplete data trigger truthful `UNKNOWN` or `UNAVAILABLE` states.
- Mock specifications are strictly isolated as dev-only fixture previews with persistent disclaimer banners.

---

## 2. API Contract Status Inventory

| Endpoint | Method | Builder 1 Contract Status | Builder 2 Backend State | Impact / Frontend Mitigation | Builder 2 Action Item |
|---|---|---|---|---|---|
| `/api/auth/session` | GET | `CONSUMED` | `IMPLEMENTED` | Live authentication and user profile state active. | None. Healthy. |
| `/api/repositories` | GET | `CONSUMED` | `IMPLEMENTED` | Repository list displays live data with fallback to empty state. | None. Healthy. |
| `/api/repositories/:id/pulls` | GET | `CONSUMED` | `IMPLEMENTED` | Pull request selector populated with real PRs. | None. Healthy. |
| `/api/repositories/:id/graph` | GET | `CONSUMED` | `PARTIAL` | Graph renders AST nodes and dependency edges when present. When empty, informs user to trigger indexing. | Ensure edge classification (`imports`, `calls`, `inherits`) is included on all graph responses. |
| `/api/analyses/:id` | GET | `CONSUMED` | `PARTIAL` | Analysis report displays findings, evidence links, and recommendations. | Include `readiness` field directly on report response rather than requiring client recalculation. |
| `/api/guard/evaluation` | GET | `PLANNED` | `MISSING` | Guard currently derives readiness from `/api/analyses/:id`. A dedicated evaluation endpoint is required. | Implement `GET /api/guard/evaluations/:repoId/:prId` returning check breakdown and history. |
| `/api/guard/history` | GET | `PLANNED` | `MISSING` | Historical runs truthfully display "Historical runs unavailable: evaluation persistence pending". | Persist historical audit records in `EvaluationRun` table. |
| `/api/actions` | GET | `CONSUMED` | `PLANNED` | Dashboard displays predefined catalogue. History displays truthful offline message when empty. | Return recent records from Prisma `ActionExecution` table. |
| `/api/actions` | POST | `CONSUMED` | `PLANNED` | Submits structured parameters. Frontend displays confirmation/offline warning upon return. | Connect endpoint to queue runner (e.g. BullMQ or child process). |
| `/api/actions/:id/approve` | POST | `CONSUMED` | `PLANNED` | Two-step approval flow wired up in UI. | Update `ActionExecution.status` from `awaiting_approval` to `approved` and trigger execution. |

---

## 3. Detailed Gap Specifications & Schema Alignments

### Gap 1: Pre-ship Guard Dedicated Evaluation Endpoint

#### Current Frontend Handling:
The Pre-ship Guard view (`/app/guard`) consumes `useAnalysisReport()`. It computes readiness dynamically based on critical and high-severity findings.

#### Desired Backend Schema (`GET /api/guard/evaluations/:repoId/:prId`):
```typescript
interface GuardEvaluationResponse {
  repositoryId: string;
  pullRequestId: string;
  commitSha: string;
  readiness: "safe" | "conditional" | "unsafe" | "unknown";
  readinessReason: string;
  evaluatedAt: string;
  checks: Array<{
    id: string;
    category: "change_integrity" | "code_quality" | "test_health" | "dependency_health" | "runtime_configuration" | "review_integrity";
    name: string;
    status: "passed" | "failed" | "warning" | "not_run" | "unavailable";
    description: string;
    evidenceSource?: string;
    lastExecutedAt?: string;
  }>;
  blockers: Array<{
    id: string;
    severity: "critical" | "high";
    title: string;
    explanation: string;
    filePath?: string;
    line?: number;
    evidenceIds: string[];
    findingId?: string;
  }>;
}
```

---

### Gap 2: Action Execution Engine & Prisma Schema Alignment

#### Prisma Schema Presence:
`apps/api/prisma/schema.prisma` already defines the `ActionExecution` model:
```prisma
model ActionExecution {
  id          String   @id @default(uuid())
  actionType  String
  target      String
  parameters  Json
  status      String   // awaiting_approval, running, completed, failed
  requestedBy String
  createdAt   DateTime @default(now())
}
```

#### Frontend Expectation:
1. `POST /api/actions`:
   - Validates that `actionType` is one of the allowed bounded catalogue actions (`run_lint`, `run_typecheck`, `run_tests`, `generate_release_notes`, etc.).
   - Disallows arbitrary shell command execution.
   - Creates a pending record and returns `{ success: true, data: { id, status: "awaiting_approval" } }`.
2. `POST /api/actions/:id/approve`:
   - Enforces role verification (developer/reviewer/admin).
   - Transitions status to `running`, executes the bounded task, and updates output and duration upon completion.

---

## 4. Frontend Mitigation Strategy

To provide a seamless developer and reviewer experience without violating audit truthfulness:
1. **Live First:** Whenever the backend returns data, the dashboard displays that live data.
2. **Explicit Offline State:** When the backend service is offline, a prominent banner states:
   > *"Backend Service Offline: [Feature] requires live analysis data from Builder 2. Currently, the service is offline or unreachable."*
3. **Specification Preview Mode:** Developers can click *"Inspect Specification Preview"* to view the UI populated with isolated fixture data (`FIXTURE_GUARD_EVALUATION`, `ACTION_CATALOGUE`, `FIXTURE_ACTION_HISTORY`).
   The preview displays a persistent orange banner indicating that the view is for UI verification only.
4. **Zero Fabrication:** The dashboard never claims an action executed or a repository is safe when the backend is offline.

