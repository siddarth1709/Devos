CREATE TABLE "ImpactResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "resultKey" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetFile" TEXT,
    "targetSymbol" TEXT,
    "sourceChangeKey" TEXT NOT NULL,
    "sourceChangeFile" TEXT NOT NULL,
    "sourceChangeSymbol" TEXT,
    "classification" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "relationshipTypes" TEXT NOT NULL,
    "edgeKeys" TEXT NOT NULL,
    "resolutionStatus" TEXT NOT NULL DEFAULT 'resolved',
    "collector" TEXT NOT NULL DEFAULT 'change-impact-analyzer',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImpactResult_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ImpactResult_analysisId_resultKey_key" ON "ImpactResult"("analysisId", "resultKey");
CREATE INDEX "ImpactResult_analysisId_idx" ON "ImpactResult"("analysisId");
CREATE INDEX "ImpactResult_targetKey_idx" ON "ImpactResult"("targetKey");
CREATE INDEX "ImpactResult_sourceChangeKey_idx" ON "ImpactResult"("sourceChangeKey");
CREATE INDEX "ImpactResult_classification_idx" ON "ImpactResult"("classification");
