ALTER TABLE "Finding" ADD COLUMN "decision" TEXT;
ALTER TABLE "Finding" ADD COLUMN "decisionActor" TEXT;
ALTER TABLE "Finding" ADD COLUMN "decisionAt" DATETIME;
ALTER TABLE "Finding" ADD COLUMN "decisionRationale" TEXT;

ALTER TABLE "ActionExecution" ADD COLUMN "repositoryId" TEXT;
ALTER TABLE "ActionExecution" ADD COLUMN "actionType" TEXT;
ALTER TABLE "ActionExecution" ADD COLUMN "actor" TEXT;
ALTER TABLE "ActionExecution" ADD COLUMN "rejectedBy" TEXT;
ALTER TABLE "ActionExecution" ADD COLUMN "rejectedAt" DATETIME;
ALTER TABLE "ActionExecution" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "ActionExecution" ADD COLUMN "executionLogs" TEXT;

ALTER TABLE "User" ADD COLUMN "githubAccessToken" TEXT;

CREATE TABLE "GuardEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL DEFAULT 'default',
    "policyVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "evaluatedThresholds" TEXT NOT NULL,
    "checks" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "warnings" TEXT NOT NULL,
    "blockingReasons" TEXT NOT NULL,
    "evidenceRefs" TEXT NOT NULL,
    "actor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuardEvaluation_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "GuardEvaluation_analysisId_idx" ON "GuardEvaluation"("analysisId");
CREATE INDEX "GuardEvaluation_decision_idx" ON "GuardEvaluation"("decision");

CREATE TABLE "GuardPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

