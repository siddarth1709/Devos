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

- **Status**: `IMPLEMENTED`
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

- **Status**: `IMPLEMENTED`
- **Description**: Registers a local Git repository for analysis. Validates canonical path via `realpath`, enforces top-level repository root status, and ensures confinement within `ALLOWED_REPO_ROOT` (defaults to current working directory `process.cwd()`; set `ALLOWED_REPO_ROOT` in environment to permit an alternative workspace root for local development).
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

- **Status**: `IMPLEMENTED`
- **Description**: Dispatches code and diff analysis between two Git SHAs. Resolves user-supplied refs (e.g. `HEAD~1`, branch names) to immutable 40-character commit SHAs, validates against option injection, runs `git diff`, and runs repository-wide AST extraction, dependency graph generation, change impact analysis, and deterministic risk evaluation synchronously. Upon completion of the pipeline, the backend validates required stages and returns terminal status (`completed`, `partial`, or `failed`) with `finishedAt` populated.
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
    - `status` (`"queued" | "running" | "completed" | "partial" | "failed" | "done"`): Final job execution state.
    - `startedAt` (`string | null`): Execution start timestamp.
    - `finishedAt` (`string | null`): Execution finish timestamp.
    - `error` (`string | null`): Failure error message if status is failed.
- **Field Sources**:
  - `id`: Job scheduler identifier.
  - `repositoryId`, `baseSha`, `headSha`: Client request payload.
  - `status`: Synchronous pipeline outcome (`"completed"`, `"partial"`, or `"failed"`).
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
  "status": "completed",
  "startedAt": "2026-10-31T01:05:00.000Z",
  "finishedAt": "2026-10-31T01:05:02.000Z",
  "error": null
}
```

---

### 5. `GET /api/analyses/:id`

- **Status**: `IMPLEMENTED`
- **Description**: Retrieves analysis job status and full report when available. While the analysis pipeline is in progress (e.g. after Git diff ingestion prior to AST extraction and AI review), `job.status` is `"running"` and `report` is `null`. The job only transitions to `"done"` once a validated `AnalysisReport` is produced.
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

### 5a. `POST /api/analyses/:id/impact`

- **Status**: `IMPLEMENTED`
- **Description**: Triggers deterministic change impact analysis for an existing analysis ID. Reads changed files, symbols, and dependency graph relationships, performs reverse dependency traversal, and persists results with full provenance.
- **Request**:
  - Route Params: `id` (`string`, required)
- **Response**: `ImpactReport` object containing `summary`, `results`, and `stage` (`impact_analysis_complete` or `impact_analysis_partial`).
- **Error Cases**:
  - `404 NOT_FOUND`: Analysis ID not found.
  - `500 IMPACT_ANALYSIS_FAILED`: Dependency graph missing or failed, or execution error.

---

### 5b. `GET /api/analyses/:id/impact`

- **Status**: `IMPLEMENTED`
- **Description**: Retrieves the persisted change impact report and summary metrics for an analysis.
- **Request**:
  - Route Params: `id` (`string`, required)
- **Response**: `ImpactReport` object.
- **Error Cases**:
  - `404 NOT_FOUND`: Analysis or impact report not found.

---

### 5c. `GET /api/analyses/:id/impact/targets/:targetKey`

- **Status**: `IMPLEMENTED`
- **Description**: Retrieves detailed impact paths and supporting evidence for a specific affected file or symbol targetKey (URL-encoded).
- **Request**:
  - Route Params:
    - `id` (`string`, required): Analysis ID.
    - `targetKey` (`string`, required): Target node key (e.g. `file:src/app.ts` or `symbol:...`).
- **Response**:
  - `targetKey` (`string`): The requested target key.
  - `impacts` (`ImpactResultItem[]`): Array of impact results connecting changes to this target.
- **Error Cases**:
  - `404 NOT_FOUND`: Analysis not found or targetKey not impacted in this analysis.

---

### 5d. `POST /api/analyses/:id/risk`

- **Status**: `IMPLEMENTED`
- **Description**: Triggers or re-executes deterministic, evidence-grounded risk assessment for an existing analysis ID. Evaluates change magnitude, dependency exposure, structural importance, and evidence uncertainty using outputs from Git ingestion, AST extraction, dependency graph, and change impact analysis.
- **Request**:
  - Route Params: `id` (`string`, required)
- **Response**: `RiskAssessmentReport` object containing overall score (0–100), level (`low` | `medium` | `high` | `critical`), severity (0–100), likelihood (0–100), confidence (0–100), uncertaintyScore (0–100), uncertaintyAdjustment, confirmedExposure metrics, potentialExposure metrics, factors, highest-risk targets, limitations, missing evidence warnings, and scoring model version (`v1.1.0-deterministic`).
- **Error Cases**:
  - `404 NOT_FOUND`: Analysis ID not found.
  - `500 RISK_ANALYSIS_FAILED`: Impact analysis missing or failed, or execution error.

---

### 5e. `GET /api/analyses/:id/risk`

- **Status**: `IMPLEMENTED`
- **Description**: Retrieves the persisted risk assessment report and overall risk metrics for an analysis.
- **Request**:
  - Route Params: `id` (`string`, required)
- **Response**: `RiskAssessmentReport` object.
- **Error Cases**:
  - `404 NOT_FOUND`: Analysis or risk assessment report not found.

---

### 5f. `GET /api/analyses/:id/risk/targets/:targetKey`

- **Status**: `IMPLEMENTED`
- **Description**: Retrieves component-level risk assessment, reasons, and supporting evidence for a specific file or symbol targetKey (URL-encoded).
- **Request**:
  - Route Params:
    - `id` (`string`, required): Analysis ID.
    - `targetKey` (`string`, required): Target component key (e.g. `file:src/app.ts` or `symbol:...`).
- **Response**: `RiskTargetComponent` object containing component `score`, `level`, `severity`, `likelihood`, `confidence`, `reasons`, `evidence`, and `unresolvedLimitations`.
- **Error Cases**:
  - `404 NOT_FOUND`: Analysis not found or targetKey not evaluated in this analysis.

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
  - `GET /api/repositories` (`IMPLEMENTED`)
  - `POST /api/repositories` (`IMPLEMENTED`)
  - `POST /api/analyses` (`IMPLEMENTED`)
  - `GET /api/analyses/:id` (`IMPLEMENTED`)
  - `POST /api/analyses/:id/review` (`PLANNED`)
  - `GET /api/analyses/:id/export` (`PLANNED`)
  - `POST /api/actions` (`PLANNED`)
  - `POST /api/actions/:id/approve` (`PLANNED`)
- Updated semantics: analysis lifecycle maintains `status: "running"` with `finishedAt: null` until full DEVOS report generation, and `ALLOWED_REPO_ROOT` defaults safely to `process.cwd()` to prevent unauthorized workspace access.
- Task 2 AST Extraction Integrity Specifications:
  - **Snapshot-Scoped Symbol Identity**: Every symbol is assigned a deterministic `symbolKey` formatted as `${file}#${containerName ? `${containerName}.` : ''}${name}:${kind}:${lineStart}:${colStart}` backed by a database index (`@@index([symbolKey])`). Symbol keys are strictly **snapshot-scoped**:
    - The exact same source file snapshot always generates identical keys.
    - Duplicate symbol names in different files (e.g. `src/a.ts#process:function:1:1` vs `src/b.ts#process:function:1:1`) or different container scopes (e.g. `src/models.ts#User.validate:method:2:3` vs `src/models.ts#Order.validate:method:6:3`) produce distinct keys.
    - Moving or reformatting a declaration shifts line/column coordinates and changes its key.
    - `symbolKey` is snapshot- and commit-scoped; it is **not** a cross-commit invariant identifier across historical code modifications.
  - **Explicit Import & Export Semantics**: Preserves `importKind` (`default | named | namespace | side-effect`), `importedName`, `localName`, `moduleSpecifier`, `exportKind` (`named | default | all`), `exportAlias`, `isReExport`, `reExportModule` without overloading signature fields.
  - **Repository-Wide Commit Extraction**: Enumerates all tracked files at the requested commit via `git ls-tree -r --name-only -z <headSha>`, extracting TypeScript and TSX sources while excluding declaration files (`.d.ts`), build artifacts, and dependency directories.
  - **Honest Extraction Lifecycle**: Persists structured investigation metrics (`filesDiscovered`, `filesProcessed`, `filesSkipped`, `parseErrors`, `extractionErrors`). Assigns `ast_extraction_complete` only when all files parse cleanly, `ast_extraction_partial` when diagnostics or partial failures occur, and `ast_extraction_failed` when no files could be processed.
  - **Decoupled Transactions & Failure Resiliency**: Git tree enumeration and TypeScript AST parsing execute outside database transactions to avoid holding SQLite table locks. AST persistence and previous-symbol cleanup run within short, isolated write transactions. Fatal extraction or persistence errors trigger an atomic failure transition (`status: "failed"`, `finishedAt: timestamp`, `Investigation.stage: "ast_extraction_failed"`).
  - **Retry & Idempotency Semantics**: At the HTTP REST layer, `POST /api/analyses` creates a discrete `AnalysisJob` entity per request. Within the engine, re-running extraction for an existing `analysisId` via `executeAstExtractionForAnalysis` is strictly idempotent: all existing symbols for that `analysisId` are deleted within the write transaction before inserting the new symbols, preventing duplicate symbol accumulation.
- Task 3 Dependency Graph Builder Specifications:
  - **Deterministic Graph Model & Canonical Identifiers**:
    - **Dependency Nodes (`DependencyNode`)**: Represents discrete code units. Scoped to analysis and repository.
      - `nodeKey`: Canonical deterministic identifier formatted as `file:<path>` (for source files), `symbol:<symbolKey>` (for symbols), or `module:<specifier>` (for external or unresolved module boundaries). Backed by unique constraint `@@unique([analysisId, nodeKey])`.
      - `nodeType`: Enum discriminator (`file | symbol | module`).
      - Provenance attributes: `analysisId`, `repositoryId`, `filePath`, `symbolKey`, `name`, `moduleSpecifier`, `isExternal`.
    - **Dependency Edges (`DependencyEdge`)**: Represents directional relationships between graph nodes.
      - `edgeKey`: Deterministic identifier formatted as `${fromNodeKey}->${toNodeKey}:${kind}`. Backed by composite unique constraint `@@unique([analysisId, edgeKey])` to prevent duplicate edge accumulation within an analysis.
      - `kind`: Relationship discriminator (`imports_module | imports_symbol | re_exports | contains | references_symbol`).
      - Provenance and source location attributes: Mandatory non-null `analysisId`, `repositoryId`, `commitSha`, `sourceFile`, `sourceLine`, `sourceCol`, `collector`. Validated prior to persistence.
      - `resolutionStatus`: Resolution outcome (`resolved | unresolved | ambiguous`).
      - `metadata`: JSON payload capturing resolution diagnostics, candidate symbols for ambiguous wildcards, or failure reasons.
  - **Comprehensive Module Resolution Rules**:
    - **Relative Specifiers**: Resolves `./` and `../` against the declaring source file's directory.
    - **Extension Handling**: Resolves explicit `.ts` and `.tsx` file paths directly.
    - **NodeNext Specifier Remapping**: Explicit `.js` and `.jsx` specifiers (used in TypeScript `NodeNext` configurations) map deterministically to local `.ts` and `.tsx` files if present.
    - **Extensionless & Directory Index**: Extensionless specifiers resolve in priority order: `<path>.ts` -> `<path>.tsx` -> `<path>/index.ts` -> `<path>/index.tsx`.
    - **External Dependencies**: Non-relative package specifiers (e.g. `fastify`, `@devos/contracts`, `node:child_process`) resolve to external module nodes (`isExternal: true`, `nodeKey: module:<specifier>`).
    - **Unresolved Handling**: Any local specifier that cannot be located within the commit tree produces an unresolved node with `resolutionStatus: "unresolved"`.
  - **Accurate Symbol & Re-Export Resolution**:
    - **Export Kinds**: Resolves named, default (`export default`), aliased, and re-exported declarations.
    - **Re-Export Chains**: Follows re-export chains across multiple intermediate files (e.g. `a.ts -> b.ts -> c.ts`) to locate canonical declaration symbols.
    - **Wildcard Re-Exports**: Inspects `export * from ...` declarations. If multiple barrels export identical symbol names, records `resolutionStatus: "ambiguous"` with candidate symbol keys preserved in metadata.
    - **Circular Reference Safety**: Traverses re-exports with cycle detection; detects circular loops (e.g. `a.ts -> b.ts -> a.ts`) and marks them as unresolved without infinite recursion.
    - **Containment & Intra-File References**: Creates `contains` edges from file nodes to top-level and nested symbols, and `references_symbol` edges between symbols within the file or across resolved imports.
  - **Graph Edge Semantics & Supported Types**:
    - **`imports_module`**: Declared module-level import relationship linking an importing source file (`file:<sourcePath>`) to a resolved target source file (`file:<targetPath>`) or an external/unresolved module specifier (`module:<specifier>`). Covers relative paths, extensionless specifiers, NodeNext `.js` specifiers, and external packages.
    - **`imports_symbol`**: Resolved import relationship linking an importing file to the canonical exported declaration symbol (`symbol:<symbolKey>`), or to an external module node (`module:<specifier>`) when importing external packages, or to target file when namespace importing (`import * as ns`).
    - **`re_exports`**: Re-export relationship linking an exporting source file to a re-exported symbol (`symbol:<symbolKey>`) or re-exported module (`file:<targetPath>` or `module:<specifier>`). Covers named re-exports (`export { a as b }`), default re-exports (`export { default }`, `export { a as default }`), namespace re-exports (`export * as ns from './mod'`), and wildcard re-exports (`export * from './mod'`).
    - **`contains`**: Structural containment hierarchy linking source files (`file:<path>`) to top-level declared symbols (`symbol:<symbolKey>`), and container symbols (classes, interfaces) to member symbols (methods, constructors).
    - **`references_symbol`**: Intra-file signature reference between declared symbols based on explicit signature symbol mentions (e.g., parameter or return types referencing a declared class or type).
    - **Explicitly Unsupported Relationships**:
      - Inter-file call-graph expression traversal across function/method bodies.
      - Dynamic runtime imports (`import(...)` expressions).
      - CommonJS `require()` and `module.exports` resolution.
      - Global ambient declarations (`declare global`, ambient `.d.ts` module augmentations).
  - **Truthful Lifecycle Stages & Investigation Metrics**:
    - `dependency_graph_complete`: All discovered edges resolved cleanly (`unresolvedEdges === 0 && ambiguousEdges === 0`).
    - `dependency_graph_partial`: Graph constructed with partial resolution (one or more unresolved or ambiguous edges recorded, or non-fatal resolution anomalies).
    - `dependency_graph_failed`: Fatal graph construction or persistence failure.
    - Persists structured metrics in `Investigation.metadata`: `nodesCount`, `edgesCount`, `resolvedEdges`, `unresolvedEdges`, `ambiguousEdges`, `externalModulesCount`, `executionTimeMs`.
  - **Idempotency & Transactional Persistence**:
    - In-memory graph resolution is computed pure and outside transaction boundaries.
    - Persistence runs inside short, isolated write transactions (`deleteDependencyEdgesByAnalysis` and `deleteDependencyNodesByAnalysis` followed by batch inserts).
    - Idempotent re-execution replaces previous graph state without orphan records or primary key collisions.
- Task 5 Deterministic Risk Analysis Engine Specifications:
  - **Deterministic Multi-Dimensional Risk Model**:
    - **Scoring Dimensions**:
      - *Change Magnitude*: Evaluates total files, symbols, additions, modifications, renames, and deletions.
      - *Confirmed Dependency Exposure*: Evaluates strictly resolved, evidence-supported direct and transitive dependents, traversal depth, and impacted files/symbols (`confirmedExposure`).
      - *Potential Exposure & Uncertainty*: Evaluates unresolved dependencies and ambiguous candidate references (`potentialExposure`). Reduces confidence, increases uncertainty, and applies an explicitly named conservative `uncertaintyAdjustment` to severity without being counted as confirmed affected components or increasing measured likelihood.
      - *Structural Importance*: Evaluates changes to exported public APIs, re-export/barrel files (`index.ts`, `public.ts`), and central shared dependencies.
      - *Evidence Quality & Uncertainty*: Measures completeness of AST extraction, dependency graph, and change impact results. Penalizes confidence for unresolved or ambiguous dependencies and partial upstream analysis stages.
    - **Transparent Scoring Formula**:
      - `severity` (0–100): Calculated as $\min(100, \text{round}(0.30 \times M + 0.40 \times E_{\text{confirmed}} + 0.30 \times S) + \text{uncertaintyAdjustment})$.
      - `likelihood` (0–100): Calculated strictly from confirmed defect probability: $\min(100, \text{round}(0.40 \times S + 0.35 \times \min(100, 25 \times D_{\text{direct}}) + 0.25 \times \min(100, 25 \times N_{\text{del}} + 10 \times N_{\text{mod}})))$. Unresolved and ambiguous edges do NOT increase measured likelihood.
      - `confidence` (0–100): Starts at 100, penalized by unresolved dependencies (-10 each), ambiguous dependencies (-15 each), partial upstream stages (-20 to -25 each), missing git diff statistics (-15), or unverified empty diffs (-60). Floor at 10.
      - `overallScore` (0–100): Calculated as $\text{round}(0.55 \times \text{severity} + 0.45 \times \text{likelihood})$ (0 when verified 0 files changed).
      - `level`: Discrete classification: `low` (0–25), `medium` (26–50), `high` (51–75), `critical` (76–100).
      - `modelVersion`: Deterministic model identifier: `v1.1.0-deterministic`.
  - **Uncertainty & Safety Invariants**:
    - Uncertainty is tracked strictly separately from severity and likelihood; incomplete evidence or missing edges can never artificially reduce risk score or produce an unearned clean bill of health.
    - When evidence is incomplete ($C < 70$) and observed score is low ($\le 25$), explicit warnings are attached stating safety cannot be guaranteed.
    - Explicit missing evidence disclosures for runtime execution telemetry, production traffic, operational tier, and test coverage.
  - **Component-Level Risk Results**:
    - Individual risk evaluations per changed file, changed symbol, and downstream affected target (`RiskTargetResult`).
    - Stored with database-enforced uniqueness per `[analysisId, targetKey]` with specific reasons, supporting evidence, and unresolved limitations.
    - Targets affected ONLY through unresolved or ambiguous dependency paths have `isConfirmed: false` and are not classified as confirmed affected targets.
  - **Truthful Lifecycle Stages**:
    - `risk_analysis_complete`: Fully evaluated without unresolved dependencies or upstream partial stages.
    - `risk_analysis_partial`: Completed with unresolved/ambiguous dependencies or partial upstream stages.
    - `risk_analysis_failed`: Failed prerequisite (missing or failed impact analysis, failed Git ingestion) or execution error.
  - **Persistence & Idempotency**:
    - Scoped strictly to `analysisId`, `repositoryId`, and `commitSha`.
    - Transactions atomically replace previous risk assessment and target results for that `analysisId`.
- Intelligence & Pre-Ship Health Verification Endpoints:
  - **`GET /api/analyses/:id/review`**:
    - Produces a comprehensive, grounded change review report (`ChangeReviewReport`).
    - Explicitly segregates `verifiedFindings` (grounded in AST and confirmed graph edges) from `uncertainObservations` (unresolved imports, ambiguous exports, unconfirmed targets).
    - Identifies critical dependency paths, prioritized suggested review areas, and explicit missing evidence limitations.
  - **`GET /api/analyses/:id/commit-message`**:
    - Generates conventional commit message proposals (`CommitMessageResult`).
    - Infers scope deterministically from changed paths without LLM speculation.
    - Classifies commit type (`feat`, `fix`, `refactor`, `test`, `chore`) using AST symbols and diff metadata.
  - **`GET /api/analyses/:id/release-notes`**:
    - Generates human-readable Markdown and structured JSON (`ReleaseNotesReport`).
    - Categorizes changes into breaking changes, features, bug fixes, refactoring, and other changes.
    - Highlights blast radius, confirmed exposure metrics, and recommended testing areas.
  - **`GET /api/analyses/:id/health`**:
    - Evaluates 10 deterministic pre-ship health checks (`PreShipHealthReport`):
      1. `git_repository_validity`: Valid repository and commit SHA.
      2. `git_ingestion_completeness`: Changed files extracted without unhandled diff truncations.
      3. `ast_extraction_completeness`: AST parsed without fatal extraction errors.
      4. `dependency_graph_completeness`: Graph nodes and edges populated.
      5. `dependency_resolution_quality`: Edge resolution quality and uncertainty metrics.
      6. `change_impact_completeness`: Traversal and impact results evaluated.
      7. `risk_and_confidence_evaluation`: Scores and confidence within [0, 100].
      8. `provenance_integrity`: Validates analysis, repository, and commit provenance.
      9. `test_evidence_availability`: Checks for test file presence in change set.
      10. `environment_configuration`: Environment configuration and DATABASE_URL verified.
    - Yields `overallStatus`: `HEALTHY`, `DEGRADED`, or `UNHEALTHY`.
  - **`POST /api/analyses/:id/health/gate`**:
    - Evaluates configurable release gate policy (`ReleaseGateEvaluation`).
    - Request payload accepts custom thresholds: `{ policy: { maxRiskScore?: number, minConfidence?: number, blockOnAnyFailedCheck?: boolean, allowedRiskLevels?: string[] } }`.
    - Returns `passed: boolean`, `gateStatus: "PASSED" | "FAILED" | "WARNED"`, `blockingReasons: string[]`, and `warnings: string[]`.
