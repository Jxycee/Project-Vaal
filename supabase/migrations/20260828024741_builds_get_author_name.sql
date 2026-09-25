-- 20260828024741_builds_get_author_name.sql
--
-- RECORD ONLY — ALREADY APPLIED. Do not replay this file.
--
-- This migration is live in the production database (Supabase project
-- mjxadehorflhncendqiy). It was applied before this project kept local
-- migration files, so on 2026-09-23 the statement below was recovered
-- verbatim from supabase_migrations.schema_migrations and verified against
-- the md5 the database reports for it.
--
-- A narrow SECURITY DEFINER function so a build page can render its author name without widening user_profiles, whose rows also hold raw GGG OAuth tokens.
--
-- See supabase/migrations/README.md for the rule that applies from here on.
-- ===== RECOVERED STATEMENT BEGINS BELOW — VERBATIM, DO NOT EDIT =====
-- "by <author>" needs to render on any public/unlisted build view — finder
-- cards, the shared viewer, and the fork credit line — for builds owned by
-- someone OTHER than the current viewer. user_profiles' only SELECT policy
-- is "auth.uid() = id" (correctly so: the same row holds raw GGG OAuth
-- tokens, so a broader policy exposing display_name would also expose
-- those). Column-level RLS isn't a thing in Postgres, so the fix is the same
-- shape as get_build_by_share_token: one narrow SECURITY DEFINER function
-- that returns ONLY the one already-public-by-design field, scoped through
-- a build id rather than an arbitrary user id.
CREATE OR REPLACE FUNCTION public.get_build_author_name(p_build_id uuid)
RETURNS text
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE AS $$
  SELECT up.display_name
  FROM public.builds b
  JOIN public.user_profiles up ON up.id = b.user_id
  WHERE b.id = p_build_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_build_author_name(uuid) TO anon, authenticated;
