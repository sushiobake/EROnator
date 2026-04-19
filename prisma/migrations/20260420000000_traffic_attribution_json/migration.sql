-- Play history traffic source (referrer / landing / utm), captured at /api/start
ALTER TABLE "Session" ADD COLUMN "trafficAttributionJson" TEXT;
ALTER TABLE "PlayHistory" ADD COLUMN "trafficAttributionJson" TEXT;
