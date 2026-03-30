-- PostgreSQL / Supabase
ALTER TABLE "PlayHistory" ADD COLUMN IF NOT EXISTS "failListContextJson" TEXT;
