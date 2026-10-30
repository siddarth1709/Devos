# DEVOS CLI — Developer Onboarding & Getting Started Guide

> **Audience:** Developers, DevOps Engineers, and Quality Owners  
> **Author:** Builder 1 (Frontend, Product Experience & UI/UX Owner)  
> **Companion Document:** [CLI Command Specification](./cli-command-specification.md)

---

## 1. Prerequisites

Before using the DEVOS CLI, ensure your workstation meets the following requirements:

| Tool | Minimum Version | Check Command | Purpose |
|---|---|---|---|
| **Node.js** | `>= 20.0.0` (LTS) | `node --version` | Runtime environment |
| **pnpm** | `>= 9.0.0` | `pnpm --version` | Monorepo package manager |
| **Git** | `>= 2.38.0` | `git --version` | Repository history & diff tracking |
| **GitHub Token** | Optional for local | `devos auth status` | Cloud synchronization & PR comments |

---

## 2. Installation & Local Monorepo Setup

The DEVOS CLI is maintained as a first-class package within the monorepo (`packages/cli`). You do not need to install it from npm during development.

### Step 1: Install Dependencies & Build Packages
From the repository root:

```bash
# Install workspace dependencies
pnpm install

# Build the CLI package using TypeScript
pnpm --filter @devos/cli build
```

### Step 2: Running the CLI Locally
You can execute the compiled CLI binary in two ways:

#### Option A: Convenient Workspace Script (Recommended)
Add a shorthand run script in your shell or use:
```bash
pnpm --filter @devos/cli start <command>
```

#### Option B: Direct Node Invocation
```bash
node packages/cli/dist/index.js <command>
```

#### Option C: Local Symlink (`pnpm link`)
To make `devos` available globally on your workstation for local testing:
```bash
cd packages/cli
pnpm link --global
cd ../..
devos --version
```

---

## 3. First-Time Repository Onboarding

### 3.1 Initializing DEVOS in a Project
Navigate to your repository root and initialize DEVOS:

```bash
node packages/cli/dist/index.js init
```

This generates `.devos.json` containing workspace metadata:
```json
{
  "repository": "siddarth1709/Devos",
  "projectType": "monorepo",
  "defaultBranch": "main",
  "analysis": {
    "engine": "ast-fastify-next",
    "exclude": ["node_modules", "dist", ".next"]
  }
}
```

### 3.2 Authenticating Local Session
Connect your local CLI to the DEVOS backend service and GitHub:

```bash
# Interactive web browser authentication
node packages/cli/dist/index.js auth login --web

# Or with personal access token
node packages/cli/dist/index.js auth login --token <your_personal_token>
```

Check your session status:
```bash
node packages/cli/dist/index.js auth status
```

---

## 4. Daily Developer Workflows

### Workflow A: Pre-Commit Sanity Check
Before committing changes to Git, verify that your changes have not introduced syntactic flaws, broken types, or unauthorized architectural imports:

```bash
# Analyzes local unstaged & staged working tree diff
node packages/cli/dist/index.js analyze
```

If issues are found, inspect the affected symbols and run quality checks:
```bash
node packages/cli/dist/index.js actions run act_lint
node packages/cli/dist/index.js actions run act_typecheck
```

---

### Workflow B: Grounded PR Code Review
When working on a feature branch or reviewing a teammate's pull request:

```bash
# Review active branch against main
node packages/cli/dist/index.js review

# Target specific GitHub PR
node packages/cli/dist/index.js review --pr 2
```

Every review finding includes:
- **Severity & Confidence**: Grounded probability based on AST reconciliation.
- **Evidence References**: File location and exact symbol tokens.
- **Remediation**: Copy-pasteable or interactively applicable patch.

To apply suggested fixes interactively:
```bash
node packages/cli/dist/index.js review --pr 2 --fix
```

---

### Workflow C: Change Impact & Blast Radius Explorer
Before pushing changes to a core library function or shared type, inspect which downstream services, routes, or UI components consume that symbol:

```bash
# Trace downstream blast radius of a symbol
node packages/cli/dist/index.js impact verifyAuthToken --depth 3 --graph
```

This renders the full dependency tree, highlighting:
- Direct consumers
- Indirect cross-package dependents
- Affected API routes and dashboard hooks

---

### Workflow D: Pre-Ship Release Readiness Audit
Before merging a pull request or deploying to staging/production, run the definitive Pre-ship Guard:

```bash
node packages/cli/dist/index.js guard
```

In automated CI/CD pipelines, enforce strict evaluation:
```bash
# Fails with exit code 1 if status is UNSAFE or CONDITIONAL
node packages/cli/dist/index.js guard --strict
```

---

### Workflow E: Safe Bounded Action Execution
Automate common engineering operations without leaving the terminal:

```bash
# View available actions
node packages/cli/dist/index.js actions list

# Execute targeted test runner on affected module
node packages/cli/dist/index.js actions run act_test

# Generate release notes for current diff
node packages/cli/dist/index.js actions run act_rel_notes
```

---

## 5. Understanding Pre-ship Guard Readiness Outcomes

Pre-ship Guard assigns one of four strictly defined readiness states. Here is how engineers should interpret and respond to each outcome:

### 🟢 `SAFE` (Safe to Ship)
- **Meaning:** All 6 check categories completed without failures. Zero critical or high-severity blockers. All tests passing and blast radius is covered.
- **Action:** Approved for merge or deployment. No further action needed.
- **CI Exit Code:** `0`

### 🟡 `CONDITIONAL` (Conditional Release)
- **Meaning:** No critical blockers, but high or medium advisories require human review (e.g. new untracked dependency added, missing telemetry baseline, or test coverage below standard threshold).
- **Action:** A designated lead engineer or security reviewer must explicitly sign off on the condition before shipping.
- **CI Exit Code:** `0` (or `1` if `--strict` is enabled)

### 🔴 `UNSAFE` (Release Blocked)
- **Meaning:** Critical defects detected! Security vulnerabilities, circular workspace dependencies, breaking schema changes, or failing regressions.
- **Action:** **STRICT STOP.** Deployment is blocked. Address the blocking issues listed in the report and re-run `devos guard`.
- **CI Exit Code:** `1`

### ⚪ `UNKNOWN` (Indeterminate Telemetry)
- **Meaning:** Incomplete or missing evaluation data. A required check did not execute, the analysis service was unreachable, or git diff reconciliation failed.
- **Critical Policy:** **UNKNOWN IS NEVER TREATED AS SAFE.**
- **Action:** Verify backend service connectivity, ensure all test suites have reported results, and re-trigger evaluation. Do not deploy when readiness is UNKNOWN.
- **CI Exit Code:** `1`

---

## 6. Troubleshooting Common Issues

### Issue 1: `Backend service offline or unreachable`
- **Cause:** DEVOS API server (`apps/api`) is not running or network proxy is blocking port 3000.
- **Solution:** Ensure `pnpm dev` is active in the repository or configure `--api-url` to point to a running backend instance.

### Issue 2: `Not inside a Git repository`
- **Cause:** Command was executed in a directory without a `.git` folder.
- **Solution:** `cd` to the root of your Git workspace before invoking `devos`.

### Issue 3: `Unknown is never treated as safe`
- **Cause:** CI pipeline failed because one or more verification checks returned status `not_run` or `unavailable`.
- **Solution:** Check the specific failed category in `devos guard --verbose`. Ensure test coverage artifacts and AST parser outputs are generated before running the guard step.

