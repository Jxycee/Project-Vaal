-- 20260923051313_swap_private_unlisted_visibility_semantics.sql
--
-- RECORD ONLY — ALREADY APPLIED. Do not replay this file.
--
-- This migration is live in the production database (Supabase project
-- mjxadehorflhncendqiy). It was applied before this project kept local
-- migration files, so on 2026-09-23 the statement below was recovered
-- verbatim from supabase_migrations.schema_migrations and verified against
-- the md5 the database reports for it.
--
-- THIS IS THE ONE THAT DEFINES TODAY'S SEMANTICS. public = every signed-in user, listed, view-counted. private = owner + anyone holding the share link. unlisted = owner only, and the column default.
--
-- See supabase/migrations/README.md for the rule that applies from here on.
-- ===== RECOVERED STATEMENT BEGINS BELOW — VERBATIM, DO NOT EDIT =====
-- Align builds.visibility with the product's vocabulary (decided 2026-09-23).
--
--   public   — every signed-in user can see it, and it is listed in the finder
--   private  — the owner, plus anyone holding the share link
--   unlisted — the owner only, share link or not
--
-- This swaps the meanings of 'private' and 'unlisted' relative to what the
-- database previously encoded. The CHECK constraint keeps all three values, so
-- only the two SECURITY DEFINER functions, the column default and any existing
-- rows need to move.

-- Link access is now public + private. Without this, share links resolve for
-- exactly the builds that are supposed to be owner-only.
CREATE OR REPLACE FUNCTION public.get_build_by_share_token(p_token text)
RETURNS SETOF builds
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT * FROM public.builds
  WHERE share_token = p_token
    AND visibility IN ('public', 'private');
$function$;

-- View counting is deliberately narrower than link access: counts are only
-- kept for builds that are public. A build shared privately by link is not a
-- published thing and does not accumulate a public view count.
CREATE OR REPLACE FUNCTION public.increment_build_view_count(p_build_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.builds
  SET view_count = view_count + 1
  WHERE id = p_build_id
    AND visibility = 'public';
END;
$function$;

-- A new build is the owner's alone until they choose otherwise.
ALTER TABLE public.builds ALTER COLUMN visibility SET DEFAULT 'unlisted';

-- Preserve each existing build's real-world intent rather than its label: a
-- build that was owner-only must stay owner-only. No rows today, but the
-- migration should be correct on its own terms.
UPDATE public.builds
SET visibility = CASE visibility
  WHEN 'private' THEN 'unlisted'
  WHEN 'unlisted' THEN 'private'
  ELSE visibility
END
WHERE visibility IN ('private', 'unlisted');