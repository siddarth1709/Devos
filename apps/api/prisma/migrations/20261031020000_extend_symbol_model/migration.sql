-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Symbol" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repositoryId" TEXT NOT NULL,
    "analysisId" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "lineStart" INTEGER NOT NULL,
    "lineEnd" INTEGER NOT NULL,
    "colStart" INTEGER,
    "colEnd" INTEGER,
    "isExported" BOOLEAN NOT NULL DEFAULT false,
    "containerName" TEXT,
    "signature" TEXT,
    "commitSha" TEXT NOT NULL,
    "collector" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Symbol_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Symbol_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Symbol" ("collector", "commitSha", "createdAt", "file", "id", "kind", "lineEnd", "lineStart", "name", "repositoryId") SELECT "collector", "commitSha", "createdAt", "file", "id", "kind", "lineEnd", "lineStart", "name", "repositoryId" FROM "Symbol";
DROP TABLE "Symbol";
ALTER TABLE "new_Symbol" RENAME TO "Symbol";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
