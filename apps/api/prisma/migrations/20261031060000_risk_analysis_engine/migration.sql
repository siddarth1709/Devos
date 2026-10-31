CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "likelihood" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT 'v1.1.0-deterministic',
    "factors" TEXT NOT NULL,
    "highestRiskTargets" TEXT NOT NULL,
    "limitations" TEXT NOT NULL,
    "missingEvidence" TEXT NOT NULL,
    "metadata" TEXT,
    "collector" TEXT NOT NULL DEFAULT 'deterministic-risk-engine',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskAssessment_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RiskAssessment_analysisId_key" ON "RiskAssessment"("analysisId");
CREATE INDEX "RiskAssessment_analysisId_idx" ON "RiskAssessment"("analysisId");
CREATE INDEX "RiskAssessment_level_idx" ON "RiskAssessment"("level");

CREATE TABLE "RiskTargetResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetFile" TEXT,
    "targetSymbol" TEXT,
    "score" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "likelihood" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "reasons" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "unresolvedLimitations" TEXT NOT NULL,
    "collector" TEXT NOT NULL DEFAULT 'deterministic-risk-engine',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RiskTargetResult_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RiskTargetResult_analysisId_targetKey_key" ON "RiskTargetResult"("analysisId", "targetKey");
CREATE INDEX "RiskTargetResult_analysisId_idx" ON "RiskTargetResult"("analysisId");
CREATE INDEX "RiskTargetResult_targetKey_idx" ON "RiskTargetResult"("targetKey");
CREATE INDEX "RiskTargetResult_level_idx" ON "RiskTargetResult"("level");
