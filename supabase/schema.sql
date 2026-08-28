-- =============================================================================
-- Project Vaal — Supabase Schema
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
SET search_path = public
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
-- Counts unlisted builds too (a visit via a real share link is a real view) —
-- only private builds, unreachable by anyone but the owner, are excluded.
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

-- Grant execute on the view counter to all roles (including anon)
GRANT EXECUTE ON FUNCTION public.increment_build_view_count(uuid) TO anon, authenticated;

-- The read path for an unlisted build: table-level RLS has no notion of "the
-- request carried a valid share_token" (auth.uid() is the only session
-- context RLS predicates can see), so this can't be a plain SELECT policy the
-- way public/owner reads are. This SECURITY DEFINER function is the one place
-- that logic lives — it bypasses RLS internally and does the token check
-- itself, so the table's own SELECT policy stays exactly "owner OR
-- visibility = public" and never needs to know what a token is.
-- Deliberately excludes visibility = 'private': share_token is assigned on
-- first save regardless of visibility, not only once a build is actually
-- shared, so a token for a build that was never made unlisted/public still
-- shouldn't resolve.
-- Call via: supabase.rpc('get_build_by_share_token', { p_token: token })
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

-- "by <author>" needs to render on any public/unlisted build view — finder
-- cards, the shared viewer, and the fork credit line — for builds owned by
-- someone OTHER than the current viewer. user_profiles' only SELECT policy
-- is "auth.uid() = id" (correctly so: the same row holds raw GGG OAuth
-- tokens, so a broader policy exposing display_name would also expose
-- those). Column-level RLS isn't a thing in Postgres, so the fix is the same
-- shape as get_build_by_share_token: one narrow SECURITY DEFINER function
-- that returns ONLY the one already-public-by-design field, scoped through
-- a build id rather than an arbitrary user id.
-- Call via: supabase.rpc('get_build_author_name', { p_build_id: id })
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

-- ---------------------------------------------------------------------------
-- Table: user_profiles
-- ---------------------------------------------------------------------------
-- Extends auth.users. One row per user, created by trigger on signup.
-- GGG tokens are stored encrypted (pg_crypto); Vault can replace this later.

CREATE TABLE public.user_profiles (
  id                    uuid        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  ggg_account_name      text,
  ggg_realm             text        CHECK (ggg_realm IN ('pc', 'xbox', 'sony')),
  -- Tokens encrypted at rest via pgp_sym_encrypt(value, app_secret).
  -- Decrypt server-side only — never expose raw tokens to the client.
  ggg_access_token      text,
  ggg_refresh_token     text,
  ggg_token_expires_at  timestamptz,
  -- Public-facing name shown as build author/credit (added for the builds
  -- feature, 2026-08-28 — see builds-feature-research.md §9.1). No settings
  -- UI to set/change it yet; NULL falls back to a generic label wherever a
  -- build's author is rendered.
  display_name          text        CHECK (display_name IS NULL OR length(display_name) BETWEEN 1 AND 32),
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
  -- passive_state: { set1: [nodeId, ...], set2: [nodeId, ...], ascendancyNodes: [nodeId, ...] }
  -- (matches plan §6, updated 2026-07-06 for ascendancy support — this file had
  -- drifted behind that update; ascendancyNodes was missing from the default)
  passive_state   jsonb       NOT NULL DEFAULT '{"set1": [], "set2": [], "ascendancyNodes": []}',
  -- gear_state:    { head: {...item}|null, body: {...item}|null, ... }
  gear_state      jsonb       NOT NULL DEFAULT '{}',
  -- gem_state:     { slots: [{ skill: {...gem}, supports: [{...gem}] }] }
  gem_state       jsonb       NOT NULL DEFAULT '{}',

  -- Sharing
  -- private: owner only. unlisted: readable via share_token (see
  -- get_build_by_share_token above), absent from the public finder.
  -- public: readable by anyone, listed in the finder.
  -- Replaced the earlier plain `is_public boolean` 2026-08-28 (see
  -- builds-feature-research.md §9) — "share a link" and "publish to the
  -- finder" are different things a boolean couldn't distinguish.
  visibility      text        NOT NULL DEFAULT 'private'
                              CHECK (visibility IN ('private', 'unlisted', 'public')),
  -- share_token: 21-char nanoid; generated server-side on first save.
  -- NULL until the build is explicitly saved/published.
  -- Never regenerated — invalidate by setting visibility = 'private'.
  share_token     text        UNIQUE,
  view_count      int         NOT NULL DEFAULT 0,

  -- Fork provenance (§9): set on "Copy to my builds". forked_from is
  -- SET NULL on delete deliberately — the denormalized name/user snapshot is
  -- what the credit line actually renders, and it survives the source row
  -- disappearing or going private; only the live link is dropped.
  forked_from       uuid        REFERENCES public.builds ON DELETE SET NULL,
  forked_from_name  text,
  forked_from_user  text,

  -- Derived from gem_state.slots[0] at save time; denormalized for build-
  -- finder filtering only — gem_state remains authoritative.
  main_skill      text,

  -- Patch tracking — important during early access when balance changes constantly.
  -- Shown as "Created in 0.2.0" label in build finder.
  game_version    text        NOT NULL DEFAULT '0.2.0',

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

-- §9.1: the count is private to the build's OWNER, unlike likes below — a
-- bookmark stays a personal "save for later" action for everyone else.
-- Additive alongside the per-user policy above: that one only ever lets a
-- user see their own bookmark rows, this adds the owner's second, different
-- path to the same table (who bookmarked MY build).
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
-- Public signal (contrast build_bookmarks above, whose count stays owner-
-- only). Same PK/shape convention as build_bookmarks: a like is a toggle,
-- not a counter a single user can inflate.

CREATE TABLE public.build_likes (
  user_id     uuid        NOT NULL REFERENCES public.user_profiles ON DELETE CASCADE,
  build_id    uuid        NOT NULL REFERENCES public.builds ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, build_id)
);

CREATE INDEX build_likes_build_id_idx ON public.build_likes (build_id);

ALTER TABLE public.build_likes ENABLE ROW LEVEL SECURITY;

-- Same visibility rule as build_tags: readable on a public build by anyone,
-- or on any of the requester's own builds regardless of visibility.
CREATE POLICY "Likes on own or public builds are readable"
  ON public.build_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_likes.build_id
        AND (b.user_id = (SELECT auth.uid()) OR b.visibility = 'public')
    )
  );

-- Account-age gate enforced here, in WITH CHECK, not just app-side — a
-- request that bypasses the client can't bypass this. Scoped to public
-- builds (+ the owner liking their own): liking an unlisted build reached
-- only via share_token has no RLS-visible session context to check against
-- (same limitation get_build_by_share_token exists to solve for reads) — a
-- like-via-token RPC is a real follow-up, not built here.
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

-- =============================================================================
-- End of schema
-- =============================================================================
-- After applying, generate TypeScript types:
--   npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
-- =============================================================================