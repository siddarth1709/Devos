# DEVOS CLI — Complete Command & Experience Specification

> **Version:** 1.0.0  
> **Author:** Builder 1 (Frontend, Product Experience & UI/UX Owner)  
> **Status:** Specification Complete  
> **Target Package:** `packages/cli` (Implementation owned by Builder 2)

---

## 1. Executive Summary & Design Principles

The DEVOS CLI is the local, terminal-native companion to the DEVOS web platform. It delivers the same evidence-grounded engineering intelligence directly into developer workflows, pre-commit hooks, CI/CD pipelines, and terminal sessions.

### Core CLI Design Principles

1. **Deterministic & Grounded:** The CLI never speculates or fabricates advice. Every finding, impact radius, or readiness score must map to AST diffs, test telemetry, or static analysis evidence.
2. **Predictable Exit Semantics:** Exit codes are strictly defined for CI/CD pipeline automation (`0` = Clean / Ready, `1` = Blocker / Unsafe, `2` = Input or Precondition failure).
3. **Structured Non-TTY & JSON Parity:** Every command supports `--json` and emits identical schemas as the web API contracts, enabling custom automation.
4. **Safety & Permission Guards:** The CLI never executes arbitrary shell commands or untrusted write mutations. Modifying operations require explicit interactive flags or pre-approved scopes.
5. **Visual Consistency:** Statuses (`SAFE`, `CONDITIONAL`, `UNSAFE`, `UNKNOWN`), severities (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), and terminology mirror the web dashboard exactly.

---

## 2. Terminal Visual Language & Styling System

### 2.1 Color Palette (ANSI 256 / 24-bit TrueColor)

| Token | Hex Equivalent | ANSI 256 | Meaning |
|---|---|---|---|
| **Accent Primary** | `#C7F36B` | 191 | DEVOS Lime; primary brand, focus symbols, passing states |
| **Success / Safe** | `#79D69A` | 114 | Passed checks, verified assertions, Safe to Ship |
| **Warning / Conditional** | `#E9B96E` | 215 | Conditional release, warnings, medium severity |
| **Critical / Unsafe** | `#F07878` | 203 | Blocking defects, Unsafe release, critical/high severity |
| **Neutral Subdued** | `#6E776F` | 243 | Timestamps, metadata, file paths, hash prefixes |
| **Background Dark** | `#0E131F` | 234 | Terminal dark backing |

### 2.2 Box Drawing & Glyphs

Standard UTF-8 Unicode characters are used when `process.stdout.isTTY` is true and `TERM != "dumb"`:

```text
┌────────────────────────────────────────────────────────┐
│ DEVOS Pre-ship Guard — Release Evaluation              │
├────────────────────────────────────────────────────────┤
│ STATUS: UNSAFE TO SHIP                                 │
│ 1 Critical Blocker · 0 Warnings · 11 Checks Passed     │
└────────────────────────────────────────────────────────┘
```

#### ASCII Fallback (`--no-color` or plain terminal):
When `NO_COLOR=1` or non-TTY plain text is requested, glyphs automatically downgrade:
- `✔` / `✓` -> `[PASS]`
- `✖` / `✗` -> `[FAIL]`
- `▲` / `⚠` -> `[WARN]`
- `●` / `○` -> `*`
- Box drawing borders (`─`, `│`, `┌`, `└`) -> `+`, `-`, `|`

---

## 3. Global Options & Exit Codes

### 3.1 Global Options

| Option | Shorthand | Type | Description |
|---|---|---|---|
| `--json` | `-j` | boolean | Output raw structured JSON for automation. Disables spinners and colors. |
| `--verbose` | `-v` | boolean | Include detailed AST debug traces and network request logs. |
| `--quiet` | `-q` | boolean | Suppress decorative banners, tips, and non-essential progress output. |
| `--no-color` | | boolean | Strip ANSI color codes. Honor standard `NO_COLOR=1` environment variable. |
| `--config <path>` | `-c` | string | Explicit path to `.devos.json` or `.devosrc`. |
| `--api-url <url>` | | string | Override API server endpoint (default: `http://localhost:3000` or env `DEVOS_API_URL`). |
| `--help` | `-h` | boolean | Show contextual command help and argument descriptions. |
| `--version` | `-V` | boolean | Output DEVOS CLI semantic version. |

### 3.2 Universal Exit Code Standards

- **`0` — Success / Clean:** Command completed successfully. In evaluation commands (`guard`, `review`), `0` indicates no blocking defects (`SAFE`).
- **`1` — Quality Blocker / Policy Violation:** Command completed evaluation, but identified blocking defects (`UNSAFE` or `CONDITIONAL` under strict enforcement).
- **`2` — Precondition / Usage Error:** Invalid arguments, missing `.git` repository, unauthenticated session, or required configuration missing.
- **`3` — Backend Unavailable / Offline:** Required remote API or telemetry service unreachable.
- **`130` — User Aborted:** Process terminated via `SIGINT` (Ctrl+C).

---

## 4. Command Hierarchy & Specifications

```text
devos
├── init
├── auth
│   ├── login
│   ├── logout
│   └── status
├── connect
├── analyze
├── review
├── impact
├── guard
├── actions
│   ├── list
│   └── run
├── status
└── config
```

---

### 4.1 `devos init`

#### Purpose
Initializes DEVOS configuration in the current working directory, generating `.devos.json` and optionally registering local Git pre-commit hooks.

#### Syntax
```bash
devos init [options]
```

#### Arguments & Options
- `--force`, `-f`: Overwrite existing `.devos.json` if present.
- `--hook`: Automatically install a `.husky` or `.git/hooks/pre-push` check running `devos guard`.

#### Preconditions
- Must be executed inside the root of a Git repository containing a `.git` folder.

#### Formatted Terminal Output
```text
  DEVOS Initializer v1.0.0
  ✔ Located Git root: /Users/nssanjeev/Projects/Devos
  ✔ Detected project type: Next.js + Fastify Monorepo (pnpm)
  ✔ Created configuration: .devos.json
  ✔ Configured default remote: origin (siddarth1709/Devos)
  
  DEVOS is now active. Run 'devos analyze' to index repository symbols.
```

#### JSON Output (`--json`)
```json
{
  "success": true,
  "configPath": "/Users/nssanjeev/Projects/Devos/.devos.json",
  "repository": "siddarth1709/Devos",
  "projectType": "monorepo",
  "hooksInstalled": false
}
```

---

### 4.2 `devos auth`

#### Subcommands

#### `devos auth login`
- **Purpose:** Authenticates the local CLI against the DEVOS API and GitHub OAuth provider.
- **Syntax:** `devos auth login [--token <token>] [--web]`
- **Behavior:**
  - With `--web`: Opens browser to `http://localhost:3000/auth/cli` to exchange one-time token.
  - With `--token`: Directly validates and securely stores personal access token in system keychain or `~/.devos/credentials`.
- **Exit Codes:** `0` on successful authentication, `2` on invalid token, `3` if auth service offline.

#### `devos auth logout`
- **Purpose:** Clears local cached session tokens and credentials.
- **Syntax:** `devos auth logout`

#### `devos auth status`
- **Purpose:** Inspects current authenticated user identity, role, and connected GitHub scopes.
- **Terminal Output:**
```text
  Authentication Status: Logged in
  User:        siddarth1709 (Siddarth)
  Role:        admin
  GitHub Org:  siddarth1709
  API Target:  http://localhost:3000
```

---

### 4.3 `devos analyze`

#### Purpose
Performs local AST symbol extraction, diff indexing, and dependency parsing across the workspace.

#### Syntax
```bash
devos analyze [options]
```

#### Options
- `--diff <base..head>`: Analyze changes between two Git commits or branches (default: `HEAD~1..HEAD` or uncommitted working tree).
- `--scope <path>`: Restrict analysis to a sub-package or directory.
- `--upload`: Upload AST graph and findings to DEVOS backend for team dashboard visibility.

#### Formatted Terminal Output
```text
  DEVOS AST Analysis Engine
  Indexing symbols in /Users/nssanjeev/Projects/Devos...
  
  [████████████████████████████████] 100% | 42 files indexed
  
  Summary:
  • Extracted Symbols:  248 (42 classes, 186 functions, 20 types)
  • Changed Symbols:    3 (verifyAuthToken, AuthHeaderSchema, TokenPayload)
  • Downstream Impact:  4 affected files across 2 packages
  
  Analysis complete in 382ms. Run 'devos review' to inspect code quality findings.
```

---

### 4.4 `devos review`

#### Purpose
Runs grounded AI code review audit against the active PR or local diff, surfacing evidence-backed findings and remediation patches.

#### Syntax
```bash
devos review [options]
```

#### Options
- `--pr <id>`: Target specific GitHub pull request number.
- `--severity <minSeverity>`: Filter findings by minimum severity (`critical`, `high`, `medium`, `low`).
- `--fix`: Interactively prompt to apply suggested code patches.
- `--json`: Emit full findings array with evidence links.

#### Formatted Terminal Output
```text
┌────────────────────────────────────────────────────────┐
│ DEVOS Grounded Code Review                             │
│ Target: PR #2 (feat/auth-verification)                 │
├────────────────────────────────────────────────────────┤
│ Findings: 1 Critical · 1 High · 1 Medium · 1 Low       │
└────────────────────────────────────────────────────────┘

[CRITICAL] Unchecked Authentication Token Expiration
  File: apps/api/src/auth/jwt.ts:48
  Symbol: verifyAuthToken()
  Confidence: 94% · Grounded AST Evidence: ev_01, ev_02
  Explanation:
    jwt.verify() callback does not enforce expiration timestamp
    validation when algorithms array contains 'none'.
  Suggested Fix:
    Add { maxAge: '24h', complete: false } to verification options.

[HIGH] Missing Input Boundary Validation on Authorization Header
  File: apps/api/src/routes/auth.ts:104
  Symbol: AuthHeaderSchema
  Confidence: 89% · Grounded AST Evidence: ev_03

Review evaluated: 2 blocking issues detected. Exit code: 1.
```

---

### 4.5 `devos impact`

#### Purpose
Explores the blast radius and downstream dependency cascade of changed symbols using the Engineering Graph.

#### Syntax
```bash
devos impact [symbol] [options]
```

#### Options
- `--depth <n>`: Maximum dependency traversal depth (default: 3).
- `--graph`: Render ASCII tree visualization of impacted nodes.
- `--package <name>`: Filter impact by package boundary.

#### Formatted Terminal Output
```text
  DEVOS Blast Radius & Impact Explorer
  Changed Root: verifyAuthToken (apps/api/src/auth/jwt.ts)
  
  Blast Radius: 4 impacted symbols across 2 packages
  
  Impact Tree:
  └── verifyAuthToken (apps/api) [DIRECT_CHANGE]
      ├── authenticateMiddleware (apps/api/src/middleware/auth.ts) [DIRECT_CONSUMER]
      │   ├── GET /api/repositories (apps/api/src/routes/repos.ts) [ROUTE_HANDLER]
      │   └── POST /api/actions (apps/api/src/routes/actions.ts) [ROUTE_HANDLER]
      └── useAuthStore (apps/dashboard/src/hooks/use-auth.ts) [CROSS_PACKAGE_DEPENDENT]
```

---

### 4.6 `devos guard`

#### Purpose
Evaluates deterministic pre-ship release readiness across all 6 verification categories (`SAFE`, `CONDITIONAL`, `UNSAFE`, `UNKNOWN`).

#### Syntax
```bash
devos guard [options]
```

#### Options
- `--strict`: Fail with exit code `1` if readiness is `CONDITIONAL` (default only fails on `UNSAFE` or `UNKNOWN`).
- `--require-tests`: Enforce passing test runs before declaring safe.
- `--json`: Output machine-readable readiness evaluation for CI pipelines.

#### Formatted Terminal Output
```text
┌────────────────────────────────────────────────────────┐
│ DEVOS PRE-SHIP GUARD — RELEASE AUDIT                   │
│ Target: PR #2 (feat/auth-verification @ 2b73459e)      │
├────────────────────────────────────────────────────────┤
│ READINESS: UNSAFE TO SHIP                              │
│ Critical security findings block production release.   │
└────────────────────────────────────────────────────────┘

Check Categories:
  ✔ Change Integrity        (2/2 passed)
  ✖ Code Quality & Static   (1 failed · 2 blockers)
  ✔ Test Health & Coverage  (2/2 passed)
  ✔ Dependency Health       (1/1 passed)
  ▲ Runtime Configuration   (1 passed · 1 unavailable)
  ✔ Review Integrity        (2/2 passed)

Blocking Issues (1 Critical, 1 High):
  1. [CRITICAL] Unchecked Authentication Token Expiration
     apps/api/src/auth/jwt.ts:48
  2. [HIGH] Missing Input Boundary Validation on Auth Header
     apps/api/src/routes/auth.ts:104

Remediation Required:
  Resolve the 2 blocking review findings or execute 'devos review --fix'.
  Release is strictly blocked until criteria are satisfied.

Pre-ship evaluation failed. Exit code: 1.
```

---

### 4.7 `devos actions`

#### Subcommands

#### `devos actions list`
- Lists available predefined actions, required permissions, and approval requirements.
```text
  Available DEVOS Actions:
  ID               CATEGORY               APPROVAL    DESCRIPTION
  act_lint         code_quality           Auto        Run ESLint checks on changed files
  act_typecheck    code_quality           Auto        Run tsc --noEmit compile check
  act_test         code_quality           Required    Execute unit tests on affected suite
  act_rel_notes    change_management      Auto        Synthesize release notes from diff
  act_dep_report   repository_maintenance Required    Compile SBOM audit to disk
```

#### `devos actions run <actionId>`
- **Options:**
  - `--yes`, `-y`: Confirm execution without interactive prompt (only works for non-destructive actions).
  - `--params <json>`: Pass structured execution parameters.
- **Safety Rule:** Stateful actions (`modifiesState: true`) prompt the user with blast radius confirmation unless `--yes` is explicitly passed in non-destructive modes.
- **Terminal Confirmation Prompt:**
```text
  Action: Execute Unit & Integration Tests (act_test)
  Target: apps/api (filter: auth)
  Permissions Required: read:repo, execute:tests
  Reversibility: Fully Reversible
  Impact: Spawns ephemeral Vitest process.
  
  Do you approve and wish to execute this action? [y/N]: y
  
  ✔ Action submitted to execution runner (Execution ID: act_rec_091).
  ✔ Execution completed in 3.8s. (6 tests passed, 0 failed).
```

---

## 5. Developer Experience, Tooling & Onboarding

### 5.1 CI/CD Integration Example (GitHub Actions)

```yaml
name: DEVOS Pre-Ship Quality Gate

on:
  pull_request:
    branches: [main]

jobs:
  devos-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm --filter @devos/cli build
      
      # Run pre-ship guard in strict mode
      - name: Evaluate Release Readiness
        run: node packages/cli/dist/index.js guard --strict
        env:
          DEVOS_API_URL: ${{ secrets.DEVOS_API_URL }}
          DEVOS_TOKEN: ${{ secrets.DEVOS_TOKEN }}
```

---

## 6. Alignment Guarantee with Dashboard

The CLI guarantees 100% semantic identity with the web application:
- **Readiness:** `SAFE`, `CONDITIONAL`, `UNSAFE`, `UNKNOWN`.
- **Finding Severities:** `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`.
- **Evidence Verification:** Every AST finding references grounded evidence IDs (`ev_*`).
- **Safety:** Unrestricted shell command injection is technically prevented by strongly typed parameter schemas.

