-- ContactInquiry.email を任意に（お問い合わせフォームでメール未入力を許可）
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ContactInquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ContactInquiry" ("id", "name", "email", "subject", "message", "createdAt") SELECT "id", "name", "email", "subject", "message", "createdAt" FROM "ContactInquiry";
DROP TABLE "ContactInquiry";
ALTER TABLE "new_ContactInquiry" RENAME TO "ContactInquiry";
CREATE INDEX "ContactInquiry_createdAt_idx" ON "ContactInquiry"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
