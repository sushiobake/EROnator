-- CreateTable
CREATE TABLE "SessionWeightsSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "qIndex" INTEGER NOT NULL,
    "weightsJson" TEXT NOT NULL,
    CONSTRAINT "SessionWeightsSnapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("sessionId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionWeightsSnapshot_sessionId_qIndex_key" ON "SessionWeightsSnapshot"("sessionId", "qIndex");

-- CreateIndex
CREATE INDEX "SessionWeightsSnapshot_sessionId_idx" ON "SessionWeightsSnapshot"("sessionId");
