-- PostgreSQL / Supabase 用（SQLite 用 migration.sql とは別途手動適用が必要な場合向け）
-- Prisma migrate が SQLite 方言のみの環境では、本番 DB に以下を手動で流してください。

CREATE TABLE IF NOT EXISTS "RecommendPlayHistory" (
    "id" TEXT NOT NULL,
    "recommendSessionId" TEXT NOT NULL,
    "sessionStartedAt" TIMESTAMP(3),
    "clickedFanza" BOOLEAN NOT NULL DEFAULT false,
    "detailJson" TEXT NOT NULL DEFAULT '{}',
    "topWorkId" TEXT,
    "topWorkTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendPlayHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RecommendPlayHistory_recommendSessionId_key" ON "RecommendPlayHistory"("recommendSessionId");

CREATE INDEX IF NOT EXISTS "RecommendPlayHistory_createdAt_idx" ON "RecommendPlayHistory"("createdAt");
