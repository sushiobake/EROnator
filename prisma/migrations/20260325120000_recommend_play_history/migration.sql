-- CreateTable RecommendPlayHistory (推薦モード完了プレイの1レコード)
CREATE TABLE "RecommendPlayHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recommendSessionId" TEXT NOT NULL,
    "sessionStartedAt" DATETIME,
    "clickedFanza" BOOLEAN NOT NULL DEFAULT false,
    "detailJson" TEXT NOT NULL DEFAULT '{}',
    "topWorkId" TEXT,
    "topWorkTitle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "RecommendPlayHistory_recommendSessionId_key" ON "RecommendPlayHistory"("recommendSessionId");

CREATE INDEX "RecommendPlayHistory_createdAt_idx" ON "RecommendPlayHistory"("createdAt");
