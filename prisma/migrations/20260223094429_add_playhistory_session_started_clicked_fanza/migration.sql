-- CreateTable
CREATE TABLE "Work" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "isAi" TEXT NOT NULL,
    "popularityBase" REAL NOT NULL DEFAULT 0,
    "popularityPlayBonus" REAL NOT NULL DEFAULT 0,
    "reviewCount" INTEGER,
    "reviewAverage" REAL,
    "productUrl" TEXT NOT NULL,
    "affiliateUrl" TEXT,
    "thumbnailUrl" TEXT,
    "sourcePayload" TEXT DEFAULT '{}',
    "contentId" TEXT,
    "releaseDate" TEXT,
    "pageCount" TEXT,
    "seriesInfo" TEXT,
    "commentText" TEXT,
    "gameRegistered" BOOLEAN,
    "needsReview" BOOLEAN,
    "tagSource" TEXT,
    "aiAnalyzed" BOOLEAN,
    "humanChecked" BOOLEAN,
    "aiChecked" BOOLEAN,
    "needsHumanCheck" BOOLEAN,
    "checkQueueAt" DATETIME,
    "manualTaggingFolder" TEXT,
    "taggedAt" DATETIME,
    "lastCheckTagChanges" TEXT,
    "lastCheckResultJson" TEXT,
    "lastCheckReasoning" TEXT,
    "lastTaggingReasoning" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tagKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "tagType" TEXT NOT NULL,
    "category" TEXT,
    "questionText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workId" TEXT NOT NULL,
    "tagKey" TEXT NOT NULL,
    "derivedSource" TEXT,
    "derivedConfidence" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkTag_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work" ("workId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkTag_tagKey_fkey" FOREIGN KEY ("tagKey") REFERENCES "Tag" ("tagKey") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "aiGateChoice" TEXT,
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "revealMissCount" INTEGER NOT NULL DEFAULT 0,
    "revealRejectedWorkIds" TEXT NOT NULL DEFAULT '[]',
    "weights" TEXT NOT NULL DEFAULT '{}',
    "weightsHistory" TEXT NOT NULL DEFAULT '[]',
    "questionHistory" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submittedTitleText" TEXT NOT NULL,
    "aiGateChoice" TEXT,
    "topCandidates" TEXT DEFAULT '[]',
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PlayHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "questionHistory" TEXT NOT NULL DEFAULT '[]',
    "aiGateChoice" TEXT,
    "resultWorkId" TEXT,
    "submittedTitleText" TEXT,
    "sessionStartedAt" DATETIME,
    "clickedFanza" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Work_workId_key" ON "Work"("workId");

-- CreateIndex
CREATE INDEX "Work_workId_idx" ON "Work"("workId");

-- CreateIndex
CREATE INDEX "Work_isAi_idx" ON "Work"("isAi");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_tagKey_key" ON "Tag"("tagKey");

-- CreateIndex
CREATE INDEX "Tag_tagKey_idx" ON "Tag"("tagKey");

-- CreateIndex
CREATE INDEX "Tag_tagType_idx" ON "Tag"("tagType");

-- CreateIndex
CREATE INDEX "WorkTag_workId_idx" ON "WorkTag"("workId");

-- CreateIndex
CREATE INDEX "WorkTag_tagKey_idx" ON "WorkTag"("tagKey");

-- CreateIndex
CREATE UNIQUE INDEX "WorkTag_workId_tagKey_key" ON "WorkTag"("workId", "tagKey");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionId_key" ON "Session"("sessionId");

-- CreateIndex
CREATE INDEX "Session_sessionId_idx" ON "Session"("sessionId");

-- CreateIndex
CREATE INDEX "Log_timestamp_idx" ON "Log"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "PlayHistory_sessionId_key" ON "PlayHistory"("sessionId");

-- CreateIndex
CREATE INDEX "PlayHistory_sessionId_idx" ON "PlayHistory"("sessionId");

-- CreateIndex
CREATE INDEX "PlayHistory_outcome_idx" ON "PlayHistory"("outcome");

-- CreateIndex
CREATE INDEX "PlayHistory_createdAt_idx" ON "PlayHistory"("createdAt");
