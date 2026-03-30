-- AddColumn: visitorId (browser visitor tracking)
ALTER TABLE "Session" ADD COLUMN "visitorId" TEXT;
ALTER TABLE "PlayHistory" ADD COLUMN "visitorId" TEXT;
ALTER TABLE "RecommendPlayHistory" ADD COLUMN "visitorId" TEXT;
CREATE INDEX "Session_visitorId_idx" ON "Session"("visitorId");
CREATE INDEX "PlayHistory_visitorId_idx" ON "PlayHistory"("visitorId");
CREATE INDEX "RecommendPlayHistory_visitorId_idx" ON "RecommendPlayHistory"("visitorId");
