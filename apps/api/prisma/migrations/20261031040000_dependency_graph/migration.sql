CREATE TABLE "DependencyNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "nodeKey" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "symbolKey" TEXT,
    "repositoryId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "collector" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DependencyNode_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DependencyNode_analysisId_nodeKey_key" ON "DependencyNode"("analysisId", "nodeKey");
CREATE INDEX "DependencyNode_nodeKey_idx" ON "DependencyNode"("nodeKey");
CREATE INDEX "DependencyNode_analysisId_idx" ON "DependencyNode"("analysisId");

ALTER TABLE "DependencyEdge" ADD COLUMN "repositoryId" TEXT;
ALTER TABLE "DependencyEdge" ADD COLUMN "edgeKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "DependencyEdge" ADD COLUMN "sourceCol" INTEGER;
ALTER TABLE "DependencyEdge" ADD COLUMN "resolutionStatus" TEXT NOT NULL DEFAULT 'resolved';
ALTER TABLE "DependencyEdge" ADD COLUMN "metadata" TEXT;

CREATE INDEX "DependencyEdge_analysisId_idx" ON "DependencyEdge"("analysisId");
CREATE INDEX "DependencyEdge_edgeKey_idx" ON "DependencyEdge"("edgeKey");
CREATE INDEX "DependencyEdge_from_idx" ON "DependencyEdge"("from");
CREATE INDEX "DependencyEdge_to_idx" ON "DependencyEdge"("to");
