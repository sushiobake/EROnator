-- AddColumn: visitorId (browser visitor tracking)
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "visitorId" TEXT;
ALTER TABLE "PlayHistory" ADD COLUMN IF NOT EXISTS "visitorId" TEXT;
ALTER TABLE "RecommendPlayHistory" ADD COLUMN IF NOT EXISTS "visitorId" TEXT;
CREATE INDEX IF NOT EXISTS "Session_visitorId_idx" ON "Session"("visitorId");
CREATE INDEX IF NOT EXISTS "PlayHistory_visitorId_idx" ON "PlayHistory"("visitorId");
CREATE INDEX IF NOT EXISTS "RecommendPlayHistory_visitorId_idx" ON "RecommendPlayHistory"("visitorId");
