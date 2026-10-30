# DEVOS API Contract Specification

**Version:** v0.1  
**Status:** Canonical Interface Specification  
**Standard Error Shape:** `{ "error": { "code": string, "message": string } }`

---

## Overview

This document specifies the HTTP REST contracts for DEVOS backend services. TypeScript types and Zod validation schemas matching this specification are defined in and exported by `@devos/contracts` (`packages/contracts`).

Implementation Status:
- `IMPLEMENTED`: Actively wired to backend runtime and tested.
- `PLANNED`: Contract defined; scheduled for implementation in upcoming milestones.

---

## Endpoints

### 1. `GET /api/health`

- **Status**: `IMPLEMENTED`
- **Description**: Probes service liveness, build version, and running process uptime.
- **Request**:
  - Headers: None required
  - Query Params: None
  - Body: None
- **Response Schema** (`HealthResponseSchema`):
  - `status` (`string`): Service health status indicator.
  - `version` (`string`): Current semantic version from `package.json`.
  - `uptime` (`number`): Process uptime in seconds.
- **Field Sources**:
  - `status`: Static runtime flag (`"ok"`).
  - `version`: Server build package manifest (`package.json`).
  - `uptime`: Node.js process runtime (`process.uptime()`).
- **Error Cases**:
  - `500 INTERNAL_SERVER_ERROR`: Server runtime fault.
- **Sample Response (DEVELOPMENT FIXTURE)**:
```json
// DEVELOPMENT FIXTURE
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 142.85
}
```

---

### 2. `GET /api/repositories`

- **Status**: `PLANNED`
- **Description**: Retrieves a list of tracked local Git repositories.
- **Request**:
  - Headers: None required
  - Query Params: None
  - Body: None
- **Response Schema** (`GetRepositoriesResponseSchema`):
  - `repositories` (`Repository[]`):
    - `id` (`string`): Unique repository identifier.
    - `name` (`string`): Display name of repository.
    - `path` (`string`): Absolute or relative filesystem path.
    - `defaultBranch` (`string`): Default Git branch (e.g., `"main"`).
    - `createdAt` (`string`): ISO 8601 creation timestamp.
- **Field Sources**:
  - `repositories`: SQLite database `Repository` table queried via Prisma Client.
- **Error Cases**:
  - `500 INTERNAL_SERVER_ERROR`: Database query or connectivity failure.
- **Sample Response (DEVELOPMENT FIXTURE)**:
```json
// DEVELOPMENT FIXTURE
{
  "repositories": [
    {
      "id": "repo_clx876abc0001",
      "name": "devos",
      "path": "/Users/nssiddarth/Documents/devos",
      "defaultBranch": "main",
      "createdAt": "2026-10-31T00:45:00.000Z"
    }
  ]
}
```

---

### 3. `POST /api/repositories`

- **Status**: `PLANNED`
- **Description**: Registers a local Git repository for analysis.
- **Request Body** (`CreateRepositoryRequestSchema`):
  - `name` (`string`, required): Repository human-readable name.
  - `path` (`string`, required): Target repository filesystem path.
  - `defaultBranch` (`string`, optional, default: `"main"`): Primary branch name.
- **Response Schema** (`CreateRepositoryResponseSchema`):
  - `Repository` object (`id`, `name`, `path`, `defaultBranch`, `createdAt`).
- **Field Sources**:
  - `id`: Generated unique ID (CUID).
  - `name`: Client request payload.
  - `path`: Client request payload.
  - `defaultBranch`: Client request payload or default `"main"`.
  - `createdAt`: Database record insertion timestamp.
- **Error Cases**:
  - `400 VALIDATION_ERROR`: Missing or invalid fields in request payload.
  - `409 CONFLICT`: Repository at specified path already registered.
  - `500 INTERNAL_SERVER_ERROR`: Database persistence failure.
- **Sample Response (DEVELOPMENT FIXTURE)**:
```json
// DEVELOPMENT FIXTURE
{
  "id": "repo_clx876abc0002",
  "name": "devos-kernel",
  "path": "/Users/nssiddarth/Documents/devos-kernel",
  "defaultBranch": "main",
  "createdAt": "2026-10-31T01:00:00.000Z"
}
```

---

### 4. `POST /api/analyses`

- **Status**: `PLANNED`
- **Description**: Dispatches an asynchronous code and diff analysis job between two Git SHAs.
- **Request Body** (`CreateAnalysisRequestSchema`):
  - `repositoryId` (`string`, required): Associated repository ID.
  - `baseSha` (`string`, required): Base Git commit SHA.
  - `headSha` (`string`, required): Head Git commit SHA.
- **Response Schema** (`CreateAnalysisResponseSchema`):
  - `AnalysisJob` object:
    - `id` (`string`): Unique job identifier.
    - `repositoryId` (`string`): Target repository identifier.
    - `baseSha` (`string`): Base Git commit SHA.
    - `headSha` (`string`): Head Git commit SHA.
    - `status` (`"queued" | "running" | "done" | "failed"`): Current job execution state.
    - `startedAt` (`string | null`): Execution start timestamp.
    - `finishedAt` (`string | null`): Execution finish timestamp.
    - `error` (`string | null`): Failure error message if status is failed.
- **Field Sources**:
  - `id`: Job scheduler identifier.
  - `repositoryId`, `baseSha`, `headSha`: Client request payload.
  - `status`: Initial queue state (`"queued"`).
  - `startedAt`, `finishedAt`, `error`: Analysis worker lifecycle events.
- **Error Cases**:
  - `400 VALIDATION_ERROR`: Missing or malformed parameters.
  - `404 NOT_FOUND`: Specified `repositoryId` not found.
  - `500 INTERNAL_SERVER_ERROR`: Queue dispatch error.
- **Sample Response (DEVELOPMENT FIXTURE)**:
```json
// DEVELOPMENT FIXTURE
{
  "id": "job_anl_982347102",
  "repositoryId": "repo_clx876abc0001",
  "baseSha": "3a4b5c6d7e8f901234567890abcdef1234567890",
  "headSha": "90abcdef12345678903a4b5c6d7e8f9012345678",
  "status": "queued",
  "startedAt": null,
  "finishedAt": null,
  "error": null
}
```

---

### 5. `GET /api/analyses/:id`

- **Status**: `PLANNED`
- **Description**: Retrieves analysis job status and full report when available.
- **Request**:
  - Route Params: `id` (`string`, required)
- **Response Schema** (`GetAnalysisResponseSchema`):
  - `job` (`AnalysisJob`): Job lifecycle metadata.
  - `report` (`AnalysisReport | null`):
    - `jobId` (`string`): Identifier of analyzed job.
    - `summary` (`string`): Executive summary of findings and readiness.
    - `findings` (`Finding[]`): Detected issues, bugs, and observations.
      - `id` (`string`): Finding ID.
      - `title` (`string`): Finding header.
      - `severity` (`"info" | "low" | "medium" | "high" | "critical"`): Impact level.
      - `description` (`string`): Detailed description.
      - `evidenceIds` (`string[]`): References to supporting evidence artifacts.
      - `origin` (`"deterministic" | "gemma"`): Source of inference.
      - `status` (`"confirmed" | "hypothesis"`): Verification state.
      - `confidence` (`"Low" | "Medium" | "High" | "Very High"`): Confidence score.
    - `changedSymbols` (`string[]`): Affected AST symbols/functions/classes.
    - `impact` (`string`): Architectural or system blast-radius analysis.
    - `readiness` (`"safe" | "conditional" | "unsafe" | "unknown"`): Release readiness state.
    - `confidence` (`"Low" | "Medium" | "High" | "Very High"`): Overall analysis confidence.
    - `limitations` (`string[]`): Known blind spots or unscoped components.
    - `missingEvidence` (`string[]`): Telemetry or artifacts required but unavailable.
    - `trustMeter` (`number`): Quantitative confidence score between 0 and 100.
    - `claimsVerified` (`number`): Count of validated claims.
    - `claimsRejected` (`number`): Count of rejected/falsified claims.
- **Field Sources**:
  - `job`: Analysis job state machine.
  - `findings`, `changedSymbols`: Static code analysis collectors and Gemma LLM reasoning.
  - `evidenceIds`: Artifact collection index (git diff, AST symbols, test execution traces).
  - `trustMeter`, `claimsVerified`, `claimsRejected`: Automated verification and reconciliation engine.
- **Error Cases**:
  - `404 NOT_FOUND`: Analysis job with given `id` not found.
  - `500 INTERNAL_SERVER_ERROR`: Database retrieval failure.
- **Sample Response (DEVELOPMENT FIXTURE)**:
```json
// DEVELOPMENT FIXTURE
{
  "job": {
    "id": "job_anl_982347102",
    "repositoryId": "repo_clx876abc0001",
    "baseSha": "3a4b5c6d7e8f901234567890abcdef1234567890",
    "headSha": "90abcdef12345678903a4b5c6d7e8f9012345678",
    "status": "done",
    "startedAt": "2026-10-31T01:05:00.000Z",
    "finishedAt": "2026-10-31T01:05:42.000Z",
    "error": null
  },
  "report": {
    "jobId": "job_anl_982347102",
    "summary": "Diff analysis identified 1 high-severity validation defect in auth middleware.",
    "findings": [
      {
        "id": "f_sec_01",
        "title": "Unvalidated authorization bearer token format",
        "severity": "high",
        "description": "Token length and structure are unverified prior to subsegment indexing.",
        "evidenceIds": ["ev_diff_01", "ev_ast_02"],
        "origin": "deterministic",
        "status": "confirmed",
        "confidence": "High"
      }
    ],
    "changedSymbols": ["verifyToken", "buildAuthHeader"],
    "impact": "Authentication bypass risk if unformatted headers are supplied.",
    "readiness": "conditional",
    "confidence": "High",
    "limitations": [
      "No production traffic logs available for token format distribution."
    ],
    "missingEvidence": [
      "Integration test coverage for malformed bearer tokens"
    ],
    "trustMeter": 92,
    "claimsVerified": 4,
    "claimsRejected": 0
  }
}
```

---

### 6. `POST /api/analyses/:id/review`

- **Status**: `PLANNED`
- **Description**: Submits human-in-the-loop review, confirming or disputing findings.
- **Request**:
  - Route Params: `id` (`string`, required)
  - Body (`ReviewAnalysisRequestSchema`):
    - `findingsReview` (`array`, optional):
      - `findingId` (`string`, required)
      - `status` (`"confirmed" | "hypothesis" | "rejected"`, required)
      - `notes` (`string`, optional)
    - `comments` (`string`, optional): General reviewer feedback.
- **Response Schema** (`ReviewAnalysisResponseSchema`):
  - `jobId` (`string`): Target analysis job ID.
  - `reviewedAt` (`string`): ISO timestamp of recorded review.
  - `status` (`"reviewed" | "pending_revision"`): Updated review state.
  - `comments` (`string | null`): Captured reviewer comments.
- **Field Sources**:
  - `jobId`: Route parameter.
  - `findingsReview`, `comments`: Client payload.
  - `reviewedAt`: Server timestamp.
  - `status`: Review workflow state evaluation.
- **Error Cases**:
  - `400 VALIDATION_ERROR`: Invalid finding IDs or statuses.
  - `404 NOT_FOUND`: Analysis job not found.
  - `500 INTERNAL_SERVER_ERROR`: Failure persisting review.
- **Sample Response (DEVELOPMENT FIXTURE)**:
```json
// DEVELOPMENT FIXTURE
{
  "jobId": "job_anl_982347102",
  "reviewedAt": "2026-10-31T01:10:00.000Z",
  "status": "reviewed",
  "comments": "Confirmed finding f_sec_01; requested patch."
}
```

---

### 7. `GET /api/analyses/:id/export`

- **Status**: `PLANNED`
- **Description**: Exports the analysis report into serialized JSON or Markdown.
- **Request**:
  - Route Params: `id` (`string`, required)
  - Query Params (`ExportAnalysisQuerySchema`):
    - `format` (`"json" | "markdown"`, default: `"json"`): Desired output format.
- **Response Schema** (`ExportAnalysisResponseSchema`):
  - `jobId` (`string`): Target analysis job ID.
  - `format` (`"json" | "markdown"`): Exported format.
  - `exportedAt` (`string`): ISO timestamp of export generation.
  - `content` (`string`): Serialized report contents.
- **Field Sources**:
  - `jobId`: Route parameter.
  - `format`: Query parameter.
  - `exportedAt`: Generation timestamp.
  - `content`: Formatted markdown template renderer or JSON serializer.
- **Error Cases**:
  - `400 VALIDATION_ERROR`: Invalid format specified.
  - `404 NOT_FOUND`: Analysis job or report not found.
  - `500 INTERNAL_SERVER_ERROR`: Serialization error.
- **Sample Response (DEVELOPMENT FIXTURE)**:
```json
// DEVELOPMENT FIXTURE
{
  "jobId": "job_anl_982347102",
  "format": "markdown",
  "exportedAt": "2026-10-31T01:12:00.000Z",
  "content": "# DEVOS Analysis Report: job_anl_982347102\n\n## Readiness: conditional\n\n### Findings\n- **[HIGH]** Unvalidated authorization bearer token format"
}
```

---

### 8. `POST /api/actions`

- **Status**: `PLANNED`
- **Description**: Submits an action execution request (e.g., test execution, automated patch, branch checkout).
- **Request Body** (`CreateActionRequestSchema`):
  - `type` (`string`, required): Action type identifier (e.g., `"run_tests"`, `"apply_patch"`).
  - `target` (`string`, required): Affected subsystem or file target.
  - `params` (`record<string, unknown>`, default: `{}`): Execution parameters.
  - `requestedBy` (`string`, default: `"system"`): Actor requesting the action.
- **Response Schema** (`CreateActionResponseSchema`):
  - `ActionRequest` object (`id`, `type`, `target`, `params`, `requestedBy`, `requestedAt`, `status`).
- **Field Sources**:
  - `id`: Action scheduler ID.
  - `type`, `target`, `params`, `requestedBy`: Client request payload.
  - `requestedAt`: Action creation timestamp.
  - `status`: Initial action status (`"pending"`).
- **Error Cases**:
  - `400 VALIDATION_ERROR`: Invalid or missing parameters.
  - `500 INTERNAL_SERVER_ERROR`: Queue insertion error.
- **Sample Response (DEVELOPMENT FIXTURE)**:
```json
// DEVELOPMENT FIXTURE
{
  "id": "act_req_4981023",
  "type": "run_tests",
  "target": "apps/api",
  "params": {
    "filter": "auth"
  },
  "requestedBy": "operator",
  "requestedAt": "2026-10-31T01:15:00.000Z",
  "status": "pending"
}
```

---

### 9. `POST /api/actions/:id/approve`

- **Status**: `PLANNED`
- **Description**: Approves or rejects a pending action execution request.
- **Request**:
  - Route Params: `id` (`string`, required)
  - Body (`ApproveActionRequestSchema`):
    - `approved` (`boolean`, required): Approval decision.
    - `reason` (`string`, optional): Context for approval or rejection.
- **Response Schema** (`ApproveActionResponseSchema`):
  - `action` (`ActionRequest`): Updated action record.
  - `result` (`ActionResult | null`): Execution result if triggered immediately.
    - `actionRequestId` (`string`): Reference to action.
    - `success` (`boolean`): Execution outcome.
    - `output` (`unknown`): Action execution stdout or structured output.
    - `error` (`string | null`): Error details if action failed.
    - `executedAt` (`string`): Execution completion timestamp.
- **Field Sources**:
  - `action`: State machine transition to `"approved"` or `"rejected"`.
  - `result`: Action runner execution outcome.
- **Error Cases**:
  - `400 VALIDATION_ERROR`: Invalid approval payload.
  - `404 NOT_FOUND`: Action request not found.
  - `409 CONFLICT`: Action is not in `"pending"` status.
  - `500 INTERNAL_SERVER_ERROR`: Execution dispatch failure.
- **Sample Response (DEVELOPMENT FIXTURE)**:
```json
// DEVELOPMENT FIXTURE
{
  "action": {
    "id": "act_req_4981023",
    "type": "run_tests",
    "target": "apps/api",
    "params": {
      "filter": "auth"
    },
    "requestedBy": "operator",
    "requestedAt": "2026-10-31T01:15:00.000Z",
    "status": "approved"
  },
  "result": {
    "actionRequestId": "act_req_4981023",
    "success": true,
    "output": {
      "testsPassed": 5,
      "testsFailed": 0,
      "durationMs": 412
    },
    "error": null,
    "executedAt": "2026-10-31T01:15:02.000Z"
  }
}
```

---

## Changelog

### v0.1 (2026-10-31)
- Initial API contract specification release.
- Added schemas for Core Entities: `Repository`, `AnalysisJob`, `Evidence`, `Finding`, `Hypothesis`, `Recommendation`, `ActionRequest`, `ActionResult`, `AnalysisReport`.
- Defined Enums: `ReadinessState`, `Confidence`, `AnalysisStatus`, `EvidenceType`, `FindingSeverity`, `FindingOrigin`, `FindingStatus`, `HypothesisStatus`, `RecommendationPriority`, `ActionStatus`.
- Specified standard Error Response shape `{ error: { code, message } }`.
- Documented 9 endpoints with schemas, field sources, error cases, and developmental fixtures:
  - `GET /api/health` (`IMPLEMENTED`)
  - `GET /api/repositories` (`PLANNED`)
  - `POST /api/repositories` (`PLANNED`)
  - `POST /api/analyses` (`PLANNED`)
  - `GET /api/analyses/:id` (`PLANNED`)
  - `POST /api/analyses/:id/review` (`PLANNED`)
  - `GET /api/analyses/:id/export` (`PLANNED`)
  - `POST /api/actions` (`PLANNED`)
  - `POST /api/actions/:id/approve` (`PLANNED`)
