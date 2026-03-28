-- PostgreSQL / Supabase（手動適用用）
ALTER TABLE "RecommendPlayHistory" ADD COLUMN IF NOT EXISTS "clickedFanzaWorkId" TEXT;
