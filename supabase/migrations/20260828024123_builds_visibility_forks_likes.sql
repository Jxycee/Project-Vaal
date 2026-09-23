-- 20260828024123_builds_visibility_forks_likes.sql
--
-- RECORD ONLY — ALREADY APPLIED. Do not replay this file.
--
-- This migration is live in the production database (Supabase project
-- mjxadehorflhncendqiy). It was applied before this project kept local
-- migration files, so on 2026-09-23 the statement below was recovered
-- verbatim from supabase_migrations.schema_migrations and verified against
-- the md5 the database reports for it.
--
-- Builds Phase 1. NOTE: the visibility semantics this file encodes were later INVERTED by 20260923051313 — read that migration, and CURRENT-STATE.md, for what is true now.
--
-- See supabase/migrations/README.md for the rule that applies from here on.
-- ===== RECOVERED STATEMENT BEGINS BELOW — VERBATIM, DO NOT EDIT =====
-- =============================================================================
-- Builds Phase 1: visibility enum, fork provenance, main_skill, likes
-- Signed off 2026-08-28 (docs/superpowers/specs/2026-08-28-builds-feature-research.md §9)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- builds: is_public -> visibility (private | unlisted | public)
-- ---------------------------------------------------------------------------
-- Drop dependents before the column swap: both a policy on builds itself and
-- one on build_tags read is_public, plus two partial indexes are keyed on it.

DROP POLICY "Public builds are readable by anyone" ON public.builds;
DROP POLICY "Tags on own or public builds are readable" ON public.build_tags;
DROP INDEX IF EXISTS public.builds_public_idx;
DROP INDEX IF EXISTS public.builds_game_version_idx;

ALTER TABLE public.builds
  ADD COLUMN visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'unlisted', 'public'));

-- Backfill from the boolean this replaces (table is empty in production as of
-- this migration, but written to be correct against real data regardless).
UPDATE public.builds SET visibility = CASE WHEN is_public THEN 'public' ELSE 'private' END;

ALTER TABLE public.builds DROP COLUMN is_public;

COMMENT ON COLUMN public.builds.visibility IS
  'private: owner only. unlisted: readable via share_token (see get_build_by_share_token), absent from the public finder. public: readable by anyone, listed in the finder.';

CREATE POLICY "Public builds are readable by anyone"
  ON public.builds FOR SELECT
  TO PUBLIC
  USING (visibility = 'public');

CREATE POLICY "Tags on own or public builds are readable"
  ON public.build_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_tags.build_id
        AND (b.user_id = auth.uid() OR b.visibility = 'public')
    )
  );

CREATE INDEX builds_visibility_idx    ON public.builds (visibility, class, league) WHERE visibility = 'public';
CREATE INDEX builds_game_version_idx  ON public.builds (game_version) WHERE visibility = 'public';

-- ---------------------------------------------------------------------------
-- builds: fork provenance + main_skill
-- ---------------------------------------------------------------------------
-- forked_from is nullable/SET NULL (not a hard requirement) so a "Forked from
-- X by Y" credit line survives the source build being deleted or made
-- private — the denormalized name/user snapshot the credit line actually
-- renders is what needs to survive, not a live join.

ALTER TABLE public.builds
  ADD COLUMN forked_from      uuid REFERENCES public.builds ON DELETE SET NULL,
  ADD COLUMN forked_from_name text,
  ADD COLUMN forked_from_user text,
  ADD COLUMN main_skill       text;

COMMENT ON COLUMN public.builds.forked_from IS
  'Set on copy ("Copy to my builds"). Denormalized name/user are the ones actually rendered — kept even if the source row later disappears or goes private.';
COMMENT ON COLUMN public.builds.main_skill IS
  'Derived from gem_state.slots[0] at save time. Denormalized for build-finder filtering — not authoritative, gem_state is.';

CREATE INDEX builds_main_skill_idx ON public.builds (main_skill) WHERE visibility = 'public';

-- ---------------------------------------------------------------------------
-- increment_build_view_count: is_public -> visibility
-- ---------------------------------------------------------------------------
-- Widened to also count views on unlisted builds (a visit via a real share
-- link is a real view) — only private builds, which nobody but the owner can
-- reach, are excluded.

CREATE OR REPLACE FUNCTION public.increment_build_view_count(p_build_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.builds
  SET view_count = view_count + 1
  WHERE id = p_build_id
    AND visibility IN ('public', 'unlisted');
END;
$$;

-- ---------------------------------------------------------------------------
-- get_build_by_share_token: the read path for unlisted builds
-- ---------------------------------------------------------------------------
-- Table-level RLS has no notion of "the request carried a valid token" (auth.uid()
-- is the only session context RLS predicates can see), so an unlisted build
-- can't be modeled as a plain SELECT policy the way public/owner reads are.
-- This SECURITY DEFINER function is the one place that logic lives: it
-- bypasses RLS internally and does the token check itself, so the plain
-- table policy above can stay exactly "owner OR visibility = public" — no
-- policy anywhere needs to know what a token is.
--
-- Deliberately does NOT match visibility = 'private': a token guessed or
-- leaked for a private build (one never actually shared) still shouldn't
-- resolve, since share_token is assigned on first save regardless of
-- visibility, not only once a build is actually shared.
CREATE OR REPLACE FUNCTION public.get_build_by_share_token(p_token text)
RETURNS SETOF public.builds
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE AS $$
  SELECT * FROM public.builds
  WHERE share_token = p_token
    AND visibility IN ('public', 'unlisted');
$$;

GRANT EXECUTE ON FUNCTION public.get_build_by_share_token(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- user_profiles: display_name
-- ---------------------------------------------------------------------------
-- Discovered while wiring "by <author>" into the builds viewer/finder: no
-- public-facing name exists anywhere on user_profiles today (ggg_account_name
-- is optional/feature-flagged, auth.users.email is not something to ever
-- expose). Adding the column here since the builds feature is unbuildable
-- without SOME author-facing name; the settings UI to let a user set/change
-- it, and what a build page renders before one is ever set, are separate,
-- not-yet-built UI decisions — this migration only unblocks the schema.

ALTER TABLE public.user_profiles
  ADD COLUMN display_name text CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 32);

COMMENT ON COLUMN public.user_profiles.display_name IS
  'Public-facing name shown as build author/credit. Nullable — no UI to set this yet; NULL falls back to a generic label ("Anonymous") wherever it is rendered.';

-- ---------------------------------------------------------------------------
-- Table: build_likes
-- ---------------------------------------------------------------------------
-- Public signal (unlike build_bookmarks, whose count stays owner-only — see
-- the SELECT policy added below on that table). Same PK/shape convention as
-- build_bookmarks: a like is a toggle, not a counter a single user can
-- inflate.

CREATE TABLE public.build_likes (
  user_id     uuid        NOT NULL REFERENCES public.user_profiles ON DELETE CASCADE,
  build_id    uuid        NOT NULL REFERENCES public.builds ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, build_id)
);

CREATE INDEX build_likes_build_id_idx ON public.build_likes (build_id);

ALTER TABLE public.build_likes ENABLE ROW LEVEL SECURITY;

-- Same visibility rule as build_tags: readable on a public build by anyone,
-- or on any of your own builds regardless of visibility (so an owner can see
-- who liked a private/unlisted build too).
CREATE POLICY "Likes on own or public builds are readable"
  ON public.build_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_likes.build_id
        AND (b.user_id = auth.uid() OR b.visibility = 'public')
    )
  );

-- Account-age gate lives here, in the WITH CHECK, not just app-side — a
-- request that bypasses the client can't bypass this. Scoped to public
-- builds (+ the owner liking their own): liking an unlisted build reached
-- only via share_token has no RLS-visible session context to check against,
-- same limitation get_build_by_share_token exists to solve for reads — a
-- like-via-token RPC is a real follow-up, not built here.
CREATE POLICY "Members of 1+ day can like public (or their own) builds"
  ON public.build_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.created_at <= now() - interval '1 day'
    )
    AND EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_likes.build_id
        AND (b.visibility = 'public' OR b.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can remove their own like"
  ON public.build_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- build_bookmarks: owner-visible aggregate (§9.1 — count is private to the
-- build's owner, unlike likes)
-- ---------------------------------------------------------------------------
-- The existing "Users can manage own bookmarks" policy only lets a user see
-- THEIR OWN bookmark rows (auth.uid() = user_id) — it never let a build's
-- owner see who bookmarked their build, which is exactly what §9.1 asks for.
-- Additive: does not touch the existing per-user policy or its INSERT/DELETE
-- behavior, just adds a second SELECT path for the owner's side.

CREATE POLICY "Build owners can see who bookmarked their builds"
  ON public.build_bookmarks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_bookmarks.build_id
        AND b.user_id = auth.uid()
    )
  );

CREATE INDEX build_bookmarks_build_id_idx ON public.build_bookmarks (build_id);
