-- 20260828024222_builds_visibility_forks_likes_advisor_fixes.sql
--
-- RECORD ONLY — ALREADY APPLIED. Do not replay this file.
--
-- This migration is live in the production database (Supabase project
-- mjxadehorflhncendqiy). It was applied before this project kept local
-- migration files, so on 2026-09-23 the statement below was recovered
-- verbatim from supabase_migrations.schema_migrations and verified against
-- the md5 the database reports for it.
--
-- Advisor follow-up to the migration above: one missing FK index, a search_path fix, and the (select auth.uid()) initplan rewrite on the policies that migration touched.
--
-- See supabase/migrations/README.md for the rule that applies from here on.
-- ===== RECOVERED STATEMENT BEGINS BELOW — VERBATIM, DO NOT EDIT =====
-- Advisor follow-up for builds_visibility_forks_likes. Scoped to what that
-- migration actually introduced or regressed — not a general RLS/index audit
-- of the whole schema (several pre-existing findings, e.g. the initplan
-- warning on every older policy and the unindexed characters_id/
-- campaign_progress FKs, predate this session and are left alone).

-- 1. Real regression: forked_from is a new FK with no covering index.
CREATE INDEX builds_forked_from_idx ON public.builds (forked_from) WHERE forked_from IS NOT NULL;

-- 2. Pre-existing gap on a function this migration edited (increment_build_view_count
-- already has SET search_path; handle_updated_at never did) — fixed while in the
-- neighborhood, trivial and safe.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3. auth_rls_initplan: only the policies this migration created/rewrote get
-- the (select auth.uid()) fix — not re-litigating every pre-existing policy
-- in the schema, which has the same pattern throughout and is a separate
-- cleanup.
DROP POLICY "Tags on own or public builds are readable" ON public.build_tags;
CREATE POLICY "Tags on own or public builds are readable"
  ON public.build_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_tags.build_id
        AND (b.user_id = (SELECT auth.uid()) OR b.visibility = 'public')
    )
  );

DROP POLICY "Likes on own or public builds are readable" ON public.build_likes;
CREATE POLICY "Likes on own or public builds are readable"
  ON public.build_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_likes.build_id
        AND (b.user_id = (SELECT auth.uid()) OR b.visibility = 'public')
    )
  );

DROP POLICY "Members of 1+ day can like public (or their own) builds" ON public.build_likes;
CREATE POLICY "Members of 1+ day can like public (or their own) builds"
  ON public.build_likes FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = (SELECT auth.uid()) AND up.created_at <= now() - interval '1 day'
    )
    AND EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_likes.build_id
        AND (b.visibility = 'public' OR b.user_id = (SELECT auth.uid()))
    )
  );

DROP POLICY "Users can remove their own like" ON public.build_likes;
CREATE POLICY "Users can remove their own like"
  ON public.build_likes FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY "Build owners can see who bookmarked their builds" ON public.build_bookmarks;
CREATE POLICY "Build owners can see who bookmarked their builds"
  ON public.build_bookmarks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_bookmarks.build_id
        AND b.user_id = (SELECT auth.uid())
    )
  );
