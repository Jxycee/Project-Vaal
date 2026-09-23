-- 20260731015813_campaign_progress_optional_character.sql
--
-- RECORD ONLY — ALREADY APPLIED. Do not replay this file.
--
-- This migration is live in the production database (Supabase project
-- mjxadehorflhncendqiy). It was applied before this project kept local
-- migration files, so on 2026-09-23 the statement below was recovered
-- verbatim from supabase_migrations.schema_migrations and verified against
-- the md5 the database reports for it.
--
-- Lets campaign progress exist without a linked character.
--
-- See supabase/migrations/README.md for the rule that applies from here on.
-- ===== RECOVERED STATEMENT BEGINS BELOW — VERBATIM, DO NOT EDIT =====
-- Allow campaign progress to exist without a linked character. The character
-- system isn't built yet (0 rows in public.characters, no creation UI), but
-- the campaign tracker is needed now and the ask is explicitly per-user, not
-- per-character. character_id stays on the table for when per-character
-- tracking ships later; a row with character_id NULL represents "general"
-- progress not tied to any specific character.
ALTER TABLE public.campaign_progress
  ALTER COLUMN character_id DROP NOT NULL;

ALTER TABLE public.campaign_progress
  DROP CONSTRAINT campaign_progress_character_id_key;

-- One row per (user, character) pair; NULLS NOT DISTINCT so a user can only
-- ever have one character_id-less "general" row too, not unlimited (Postgres's
-- default unique-constraint behavior treats every NULL as distinct).
ALTER TABLE public.campaign_progress
  ADD CONSTRAINT campaign_progress_user_character_key UNIQUE NULLS NOT DISTINCT (user_id, character_id);
