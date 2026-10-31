import type { Repository, PullRequest } from "@/types/api";

export const DEMO_REPOSITORY: Repository = {
  id: "demo-payment-gateway",
  name: "payment-gateway",
  fullName: "demo/payment-gateway",
  owner: "demo",
  defaultBranch: "main",
  visibility: "public",
  updatedAt: new Date().toISOString(),
  openPullRequestsCount: 1,
  openIssuesCount: 0,
};

export const DEMO_PULL_REQUEST: PullRequest = {
  id: "142",
  number: 142,
  title: "refactor(checkout): upgrade webhook signing & idempotent processor",
  description: "Refactors Stripe webhook verification to use async HMAC verification and introduces an idempotency ledger to mitigate duplicate fulfillment under high concurrency.",
  sourceBranch: "feat/stripe-v20",
  targetBranch: "main",
  author: {
    login: "demo-investigator",
    avatarUrl: "/brand/devos-mark.png",
  },
  state: "open",
  createdAt: "2026-10-30T18:00:00Z",
  updatedAt: "2026-10-31T03:00:00Z",
  changedFilesCount: 6,
  additionsCount: 184,
  deletionsCount: 42,
  analysisStatus: "completed",
};
