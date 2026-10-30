-- AlterTable
ALTER TABLE "Symbol" ADD COLUMN "symbolKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Symbol" ADD COLUMN "importKind" TEXT;
ALTER TABLE "Symbol" ADD COLUMN "importedName" TEXT;
ALTER TABLE "Symbol" ADD COLUMN "localName" TEXT;
ALTER TABLE "Symbol" ADD COLUMN "moduleSpecifier" TEXT;
ALTER TABLE "Symbol" ADD COLUMN "exportKind" TEXT;
ALTER TABLE "Symbol" ADD COLUMN "exportAlias" TEXT;
ALTER TABLE "Symbol" ADD COLUMN "isReExport" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Symbol" ADD COLUMN "reExportModule" TEXT;
ALTER TABLE "Symbol" ADD COLUMN "metadata" TEXT;

-- CreateIndex
CREATE INDEX "Symbol_symbolKey_idx" ON "Symbol"("symbolKey");
CREATE INDEX "Symbol_analysisId_idx" ON "Symbol"("analysisId");
CREATE INDEX "Symbol_repositoryId_idx" ON "Symbol"("repositoryId");
