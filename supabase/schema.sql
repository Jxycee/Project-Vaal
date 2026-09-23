-- =============================================================================
-- Project Vaal — Supabase Schema
-- =============================================================================
-- GENERATED FROM THE LIVE DATABASE — do not hand-edit and let it drift.
--
-- Source:           Supabase project `mjxadehorflhncendqiy`
-- Generated:        2026-09-18
-- Latest migration: 20260829195704_add_preferred_price_league_to_user_profiles
--
-- HAND-PATCHED 2026-09-23 for migration `swap_private_unlisted_visibility_semantics`
-- (builds.visibility default, get_build_by_share_token, increment_build_view_count).
-- Everything else in this file still dates from the 2026-09-18 generation, so
-- treat it as a convenience copy and NOT as an authority: verify against the
-- live database before relying on any claim here. This file has already
-- misled work twice.
-- Regenerate by:    introspecting the live project (information_schema for
--                    columns; pg_constraint/pg_get_constraintdef for keys and
--                    checks; pg_indexes for indexes incl. partial-index
--                    predicates; pg_policies + pg_class.relrowsecurity for
--                    RLS; pg_proc/pg_get_functiondef for functions;
--                    pg_trigger/pg_get_triggerdef for triggers;
--                    information_schema.role_routine_grants for function
--                    grants) via the Supabase MCP tools (execute_sql,
--                    list_migrations) and rewriting this file to match.
--
-- Apply via: Supabase dashboard → SQL Editor, or supabase db push
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), token encryption

-- ---------------------------------------------------------------------------
-- Shared utility functions
-- ---------------------------------------------------------------------------

-- Auto-update updated_at on any table
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create a user_profiles row when a new auth.users row is inserted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER                    -- runs as postgres to bypass RLS
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;     -- idempotent — safe if called twice
  RETURN NEW;
END;
$$;

-- Increment build view_count; runs as DEFINER so caller needs no UPDATE privilege
-- Call via: supabase.rpc('increment_build_view_count', { p_build_id: id })
CREATE OR REPLACE FUNCTION public.increment_build_view_count(p_build_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.builds
  SET view_count = view_count + 1
  WHERE id = p_build_id
    AND visibility = 'public';   -- view counts are kept for public builds only
END;
$$;

-- Grant execute on the view counter to all roles (including anon)
GRANT EXECUTE ON FUNCTION public.increment_build_view_count(uuid) TO anon, authenticated;

-- Look up a build by its share token; runs as DEFINER so a visitor holding a
-- valid link can read a build regardless of its RLS-visible ownership.
-- Only public/private builds are returned — an `unlisted` build's token never
-- resolves. See the visibility comment on the builds table: this app's
-- vocabulary deliberately inverts the usual web meaning of those two words.
CREATE OR REPLACE FUNCTION public.get_build_by_share_token(p_token text)
RETURNS SETOF builds
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.builds
  WHERE share_token = p_token
    AND visibility IN ('public', 'private');
$$;

-- Resolve a build's author display name for public-facing UI (build finder,
-- shared build page). SECURITY DEFINER so it can read user_profiles.display_name
-- across owners without granting broader profile-read access via RLS.
CREATE OR REPLACE FUNCTION public.get_build_author_name(p_build_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT up.display_name
  FROM public.builds b
  JOIN public.user_profiles up ON up.id = b.user_id
  WHERE b.id = p_build_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_build_by_share_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_build_author_name(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Table: user_profiles
-- ---------------------------------------------------------------------------
-- Extends auth.users. One row per user, created by trigger on signup.
-- GGG tokens are stored encrypted (pg_crypto); Vault can replace this later.

CREATE TABLE public.user_profiles (
  id                    uuid        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  -- Public-facing name shown as build author/credit. Nullable — no UI to set
  -- this yet; NULL falls back to a generic label ("Anonymous") wherever it's
  -- rendered. Read cross-user via get_build_author_name(), not direct RLS.
  display_name          text        CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 32),
  ggg_account_name      text,
  ggg_realm             text        CHECK (ggg_realm IN ('pc', 'xbox', 'sony')),
  -- Tokens encrypted at rest via pgp_sym_encrypt(value, app_secret).
  -- Decrypt server-side only — never expose raw tokens to the client.
  ggg_access_token      text,
  ggg_refresh_token     text,
  ggg_token_expires_at  timestamptz,
  -- Last league picked on /prices — restored on sign-in so the switcher
  -- doesn't reset to the default league every session.
  preferred_price_league text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No INSERT policy: trigger handles creation.
-- No DELETE policy: cascades from auth.users deletion.

-- ---------------------------------------------------------------------------
-- Table: characters
-- ---------------------------------------------------------------------------
-- Manually-created or GGG-imported characters. League-scoped.

CREATE TABLE public.characters (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.user_profiles ON DELETE CASCADE,
  ggg_id          text,                        -- null for manually-created characters
  name            text        NOT NULL,
  class           text        NOT NULL,
  ascendancy      text,                        -- null until ascended
  level           int         NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
  league          text        NOT NULL,
  realm           text        NOT NULL DEFAULT 'pc' CHECK (realm IN ('pc', 'xbox', 'sony')),
  is_imported     boolean     NOT NULL DEFAULT false,
  last_synced_at  timestamptz,                 -- null if manually created
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- Prevent duplicate GGG imports; NULL ggg_id values are treated as distinct
  -- in PostgreSQL unique constraints, so multiple manual characters are allowed.
  UNIQUE (user_id, ggg_id)
);

CREATE INDEX characters_user_id_idx ON public.characters (user_id);

CREATE TRIGGER set_characters_updated_at
  BEFORE UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own characters"
  ON public.characters FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Table: builds
-- ---------------------------------------------------------------------------
-- Core build planner data. Supports character-linked and standalone builds.
-- All build state stored as JSONB to survive PoE2 early-access schema churn.

CREATE TABLE public.builds (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.user_profiles ON DELETE CASCADE,
  -- Optional link to a character; SET NULL if character is deleted
  character_id    uuid        REFERENCES public.characters ON DELETE SET NULL,
  name            text        NOT NULL,
  description     text,
  notes           text,
  class           text        NOT NULL,
  ascendancy      text,
  level           int         NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
  league          text        NOT NULL DEFAULT 'Standard',

  -- JSONB build state — shapes documented in schema.md and §6 of planning doc
  -- passive_state: { set1: [nodeId, ...], set2: [nodeId, ...] }
  passive_state   jsonb       NOT NULL DEFAULT '{"set1": [], "set2": []}',
  -- gear_state:    { head: {...item}|null, body: {...item}|null, ... }
  gear_state      jsonb       NOT NULL DEFAULT '{}',
  -- gem_state:     { slots: [{ skill: {...gem}, supports: [{...gem}] }] }
  gem_state       jsonb       NOT NULL DEFAULT '{}',

  -- Derived from gem_state.slots[0] at save time. Denormalized for
  -- build-finder filtering — not authoritative, gem_state is.
  main_skill      text,

  -- Sharing
  -- THIS APP'S VOCABULARY INVERTS THE USUAL WEB MEANING OF THESE WORDS. It is
  -- a deliberate product decision (2026-09-23) and the live database was
  -- migrated to match it; do not "correct" either side towards the
  -- YouTube/Google Docs sense of "unlisted".
  --   unlisted: owner only, share link or not. The default.
  --   private:  owner, plus anyone holding the share link. Absent from the finder.
  --   public:   every signed-in user; listed in the finder; view-counted.
  visibility      text        NOT NULL DEFAULT 'unlisted' CHECK (visibility IN ('private', 'unlisted', 'public')),
  -- share_token: 21-char nanoid; generated server-side on first save.
  -- NULL until the build is explicitly saved/published.
  -- Never regenerated — invalidate a link by setting visibility = 'unlisted'.
  -- NOTE: because the token is never rotated, downgrading public -> private
  -- does NOT revoke access for anyone who already read the token off the
  -- finder. Only 'unlisted' actually revokes.
  share_token     text        UNIQUE,
  view_count      int         NOT NULL DEFAULT 0,

  -- Patch tracking — important during early access when balance changes constantly.
  -- Shown as "Created in 0.2.0" label in build finder.
  game_version    text        NOT NULL DEFAULT '0.2.0',

  -- Forking — set on copy ("Copy to my builds"). forked_from_name/_user are
  -- denormalized: they're what's actually rendered, kept even if the source
  -- build later disappears or goes private.
  forked_from       uuid      REFERENCES public.builds ON DELETE SET NULL,
  forked_from_name  text,
  forked_from_user  text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX builds_user_id_idx       ON public.builds (user_id);
CREATE INDEX builds_share_token_idx   ON public.builds (share_token) WHERE share_token IS NOT NULL;
CREATE INDEX builds_visibility_idx    ON public.builds (visibility, class, league) WHERE visibility = 'public';
CREATE INDEX builds_game_version_idx  ON public.builds (game_version) WHERE visibility = 'public';
CREATE INDEX builds_main_skill_idx    ON public.builds (main_skill) WHERE visibility = 'public';
CREATE INDEX builds_forked_from_idx   ON public.builds (forked_from) WHERE forked_from IS NOT NULL;

CREATE TRIGGER set_builds_updated_at
  BEFORE UPDATE ON public.builds
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can do everything with their builds"
  ON public.builds FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public builds are readable by anyone"
  ON public.builds FOR SELECT
  TO PUBLIC
  USING (visibility = 'public');

-- ---------------------------------------------------------------------------
-- Table: build_tags
-- ---------------------------------------------------------------------------
-- Freeform tags for build filtering in the build finder.

CREATE TABLE public.build_tags (
  build_id  uuid  NOT NULL REFERENCES public.builds ON DELETE CASCADE,
  tag       text  NOT NULL CHECK (length(tag) BETWEEN 1 AND 32),
  PRIMARY KEY (build_id, tag)
);

CREATE INDEX build_tags_tag_idx ON public.build_tags (tag);

ALTER TABLE public.build_tags ENABLE ROW LEVEL SECURITY;

-- Tags inherit the visibility of their parent build
CREATE POLICY "Tags on own or public builds are readable"
  ON public.build_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_tags.build_id
        AND (b.user_id = (SELECT auth.uid()) OR b.visibility = 'public')
    )
  );

CREATE POLICY "Owners can insert tags on their builds"
  ON public.build_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_tags.build_id
        AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can delete tags on their builds"
  ON public.build_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_tags.build_id
        AND b.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Table: build_bookmarks
-- ---------------------------------------------------------------------------
-- Users save community builds from the build finder to their library.

CREATE TABLE public.build_bookmarks (
  user_id     uuid        NOT NULL REFERENCES public.user_profiles ON DELETE CASCADE,
  build_id    uuid        NOT NULL REFERENCES public.builds ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, build_id)
);

CREATE INDEX build_bookmarks_user_id_idx  ON public.build_bookmarks (user_id);
CREATE INDEX build_bookmarks_build_id_idx ON public.build_bookmarks (build_id);

ALTER TABLE public.build_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bookmarks"
  ON public.build_bookmarks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Build owners can see who bookmarked their builds"
  ON public.build_bookmarks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_bookmarks.build_id
        AND b.user_id = (SELECT auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Table: build_likes
-- ---------------------------------------------------------------------------
-- Users like community builds from the build finder. Separate from
-- build_bookmarks (bookmarks = "save to my library", likes = a public signal).

CREATE TABLE public.build_likes (
  user_id     uuid        NOT NULL REFERENCES public.user_profiles ON DELETE CASCADE,
  build_id    uuid        NOT NULL REFERENCES public.builds ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, build_id)
);

CREATE INDEX build_likes_build_id_idx ON public.build_likes (build_id);

ALTER TABLE public.build_likes ENABLE ROW LEVEL SECURITY;

-- Likes inherit the visibility of their parent build
CREATE POLICY "Likes on own or public builds are readable"
  ON public.build_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_likes.build_id
        AND (b.user_id = (SELECT auth.uid()) OR b.visibility = 'public')
    )
  );

-- Anti-abuse: the liking account must be at least one day old, and the
-- target build must be public (or the liker's own).
CREATE POLICY "Members of 1+ day can like public (or their own) builds"
  ON public.build_likes FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = (SELECT auth.uid())
        AND up.created_at <= now() - INTERVAL '1 day'
    )
    AND EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_likes.build_id
        AND (b.visibility = 'public' OR b.user_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "Users can remove their own like"
  ON public.build_likes FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Table: campaign_progress
-- ---------------------------------------------------------------------------
-- Checkpoint completion, optionally scoped to a character. One row per
-- (user, character) pair.
--
-- character_id is nullable (loosened 2026-07-30, campaign_progress_optional_character
-- migration): the character system isn't built yet (0 rows in `characters`,
-- no creation UI), but the campaign tracker shipped ahead of it and is
-- explicitly per-user. A row with character_id NULL is a user's "general"
-- progress, not tied to any character. Once character creation ships, a
-- per-character row can be added alongside without a schema change.
-- JSONB merge (progress || updates) prevents concurrent overwrites.

CREATE TABLE public.campaign_progress (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.user_profiles ON DELETE CASCADE,
  character_id  uuid        REFERENCES public.characters ON DELETE CASCADE,
  -- progress shape: { [checkpointId: string]: boolean }
  -- Checkpoint IDs come from the static campaign dataset, src/lib/campaign/data.ts.
  -- Example: { "a1-clearfell-beira-of-the-rotten-pack": true }
  progress      jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- NULLS NOT DISTINCT so a user gets exactly one character_id-less "general"
  -- row too, not unlimited (Postgres's default unique behavior treats every
  -- NULL as distinct from every other NULL).
  UNIQUE NULLS NOT DISTINCT (user_id, character_id)
);

CREATE TRIGGER set_campaign_progress_updated_at
  BEFORE UPDATE ON public.campaign_progress
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.campaign_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own campaign progress"
  ON public.campaign_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Table: ladder_entries
-- ---------------------------------------------------------------------------
-- Cached GGG ladder data. Written only by cron (service role).
-- Composite PK (league, realm, rank) — upsert replaces stale entries cleanly.

CREATE TABLE public.ladder_entries (
  league          text  NOT NULL,
  realm           text  NOT NULL CHECK (realm IN ('pc', 'xbox', 'sony')),
  rank            int   NOT NULL CHECK (rank BETWEEN 1 AND 1000),
  account_name    text  NOT NULL,
  character_name  text  NOT NULL,
  class           text  NOT NULL,
  ascendancy      text,
  level           int   NOT NULL,
  -- Full GGG API response stored for future extensibility without re-sync
  snapshot        jsonb,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league, realm, rank)
);

CREATE INDEX ladder_entries_class_idx ON public.ladder_entries (league, realm, class);

ALTER TABLE public.ladder_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ladder data is publicly readable"
  ON public.ladder_entries FOR SELECT
  TO PUBLIC
  USING (true);

-- No INSERT/UPDATE/DELETE policies for public or authenticated roles.
-- All writes go through the service role (cron job) which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Table: price_entries
-- ---------------------------------------------------------------------------
-- Cached currency/item price data for the /prices page, sourced from
-- poe2scout.com's CDN (see src/lib/prices/poe2scout.ts). Written only by
-- cron (service role). Composite PK (league, category, api_id) — upsert
-- replaces stale entries cleanly, same pattern as ladder_entries.

CREATE TABLE public.price_entries (
  league          text  NOT NULL,
  category        text  NOT NULL,
  api_id          text  NOT NULL,
  name            text  NOT NULL,
  icon_url        text,
  exalted_value   numeric,
  divine_value    numeric,
  -- Full upstream API response stored for future extensibility without re-fetch
  snapshot        jsonb,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league, category, api_id)
);

CREATE INDEX price_entries_name_idx ON public.price_entries (league, name);

ALTER TABLE public.price_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Price data is publicly readable"
  ON public.price_entries FOR SELECT
  TO PUBLIC
  USING (true);

-- No INSERT/UPDATE/DELETE policies for public or authenticated roles.
-- All writes go through the service role (cron job) which bypasses RLS.

-- ---------------------------------------------------------------------------
-- View: price_entry_leagues
-- ---------------------------------------------------------------------------
-- Distinct list of leagues with cached price data, backing the /prices
-- league switcher (added in add_price_entry_leagues_view migration).

CREATE VIEW public.price_entry_leagues AS
  SELECT DISTINCT league
  FROM public.price_entries
  ORDER BY league;

-- =============================================================================
-- End of schema
-- =============================================================================
-- After applying, generate TypeScript types:
--   npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
-- =============================================================================
