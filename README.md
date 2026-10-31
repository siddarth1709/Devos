# DEVOS - Software Change Intelligence Platform

DEVOS is a deterministic, evidence-grounded software change intelligence platform. It analyzes Git modifications, parses AST symbol declarations, builds granular dependency graphs, traces change impact blast radius, evaluates multi-dimensional risk scores, and enforces pre-ship quality gates.

---

## Architecture Overview

```text
               +-------------------------------------------------------+
               |                  Git Repository Changes               |
               +---------------------------+---------------------------+
                                           |
                                           v
               +-------------------------------------------------------+
               |  Task 1: Git Ingestion & Repository Workspace         |
               +---------------------------+---------------------------+
                                           |
                                           v
               +-------------------------------------------------------+
               |  Task 2: Repository-Wide AST Symbol Extraction         |
               +---------------------------+---------------------------+
                                           |
                                           v
               +-------------------------------------------------------+
               |  Task 3: Granular Dependency Graph Construction        |
               +---------------------------+---------------------------+
                                           |
                                           v
               +-------------------------------------------------------+
               |  Task 4: Deterministic Change Impact Analysis          |
               +---------------------------+---------------------------+
                                           |
                                           v
               +-------------------------------------------------------+
               |  Task 5: Multi-Dimensional Risk Analysis Engine       |
               +---------------------------+---------------------------+
                                           |
        +----------------------------------+----------------------------------+
        |                                  |                                  |
        v                                  v                                  v
+---------------+                  +---------------+                  +---------------+
| Smart Commit  |                  | Change Review |                  | Release Notes |
|   Assistant   |                  |    Report     |                  |   Generator   |
+---------------+                  +---------------+                  +---------------+
        |                                  |                                  |
        +----------------------------------+----------------------------------+
                                           |
                                           v
               +-------------------------------------------------------+
               |  Task 6: Pre-Ship Health Checks & Release Gate        |
               +-------------------------------------------------------+
                                           |
        +----------------------------------+----------------------------------+
        |                                                                     |
        v                                                                     v
+---------------+                                                     +---------------+
|   DEVOS CLI   |                                                     |   Dashboard   |
| (Terminal/CI) |                                                     |    (Next.js)  |
+---------------+                                                     +---------------+
```

---

## Workspace Structure

- `apps/api`: Fastify REST API, SQLite/Prisma persistence, and analysis engine pipelines.
- `apps/dashboard`: Next.js 16 web application for engineering graphs, reviews, and release readiness.
- `packages/cli`: Standalone CLI (`devos`) for local terminal and CI/CD workflow automation.
- `packages/contracts`: Shared TypeScript types and Zod schemas.

---

## Prerequisites

- Node.js >= 22.0.0
- pnpm >= 11.0.0
- Git >= 2.38.0

---

## Getting Started

### 1. Install Dependencies

```bash
corepack enable
pnpm install
```

### 2. Setup Database

```bash
pnpm --filter api exec prisma generate --schema prisma/schema.prisma
pnpm --filter api exec prisma migrate deploy --schema prisma/schema.prisma
```

### 3. Build Monorepo

```bash
pnpm --filter api build
pnpm --filter @devos/cli build
pnpm --filter @devos/dashboard build
```

### 4. Run Development Services

Start the backend API server:
```bash
pnpm --filter api dev
```

Start the dashboard frontend:
```bash
pnpm --filter @devos/dashboard dev
```

---

## DEVOS CLI Usage

The CLI (`packages/cli/bin/devos.js`) provides terminal-native access to the DEVOS intelligence pipeline.

### Commands

- `devos analyze [path]`: Run full analysis pipeline on a repository.
- `devos status <id>`: Inspect status and metadata for an analysis.
- `devos report <id>`: View comprehensive risk assessment and blast radius report.
- `devos review <id>`: View change review report separating verified findings from uncertainty.
- `devos health [id]`: Run 10 deterministic pre-ship health checks.
- `devos guard <id> [--policy <file>]`: Evaluate configurable release gate.
- `devos init [path]`: Initialize `.devos.json` project configuration.

### Global Flags

- `-j, --json`: Emit raw structured JSON for automated tooling.
- `--api-url <url>`: Override API endpoint (default: `http://127.0.0.1:3000`).
- `--gate`: Enforce release gate during analysis (exits with code 1 if failed).
- `--policy <file>`: Custom release gate policy JSON.

### Exit Codes

- `0`: Success / Clean / Gate Passed
- `1`: Blocker / Release Gate Failed / Unsafe
- `2`: Precondition / Usage Error
- `3`: API Backend Offline / Connection Refused

---

## Pre-Ship Health Checks

DEVOS executes 10 deterministic pre-ship checks for each change:

1. `git_repository_validity`: Validates Git repository existence and commit SHA format.
2. `git_ingestion_completeness`: Confirms complete changed-file extraction without unhandled truncation.
3. `ast_extraction_completeness`: Confirms AST extraction without fatal parser crashes.
4. `dependency_graph_completeness`: Verifies graph nodes and directional edges are populated.
5. `dependency_resolution_quality`: Measures resolved ratio and flags excessive unresolved references.
6. `change_impact_completeness`: Verifies traversal completed and impact targets evaluated.
7. `risk_and_confidence_evaluation`: Validates risk scores and confidence bounds within [0, 100].
8. `provenance_integrity`: Validates analysis, repository, and commit provenance across all outputs.
9. `test_evidence_availability`: Verifies whether automated tests accompany the modified components.
10. `environment_configuration`: Verifies required environment configuration and database connectivity.

---

## Continuous Integration (GitHub Actions)

A pre-configured GitHub Actions workflow (`.github/workflows/devos-analysis.yml`) executes the DEVOS analysis and enforces release gate policies on pull requests and pushes to `main`.

---

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
