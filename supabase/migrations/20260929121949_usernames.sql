-- 20260929121949_usernames.sql
--
-- APPLIED to the live database 2026-09-29 (version 20260929121949). Verified
-- the same day in a rolled-back block: bad format -> check_violation; first set
-- leaves display_name_changed_at NULL; first change sets it; a second change
-- within 7 days raises display_name_rate_limited; a case-insensitive duplicate
-- raises unique_violation; role authenticated gets insufficient_privilege on
-- display_name. Data afterwards: 0 names, 0 clocks.
--
-- Usernames (user_profiles.display_name) become a real, public-facing handle:
--   * format: 3-20 characters, letters, digits, '_' or '-'   (CHECK)
--   * unique, case-insensitively                               (unique index)
--   * rate limit: setting a name for the first time is free and
--     does not start the clock; every CHANGE after that must be at
--     least 7 days after the previous change                  (trigger)
--   * the browser can no longer write display_name or
--     display_name_changed_at directly: the "Users can update own
--     profile" RLS policy let any signed-in user UPDATE their own row,
--     which would bypass the server-side word filter and the rate
--     limit. The only writer is the setDisplayName Server Function,
--     which checks the word filter and then writes with the service
--     role. The trigger still applies to that write.
-- Plus get_public_build_authors(), so a page of public builds can show
-- its authors in one call instead of one RPC per build.

-- 1. Rate-limit bookkeeping.
ALTER TABLE public.user_profiles
  ADD COLUMN display_name_changed_at timestamptz;

COMMENT ON COLUMN public.user_profiles.display_name_changed_at IS
  'When display_name was last CHANGED (not first set). Drives the once-per-7-days rule in enforce_display_name_rules.';

-- 2. Format + uniqueness. Verified before applying: 6 rows, 0 non-null names.
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_display_name_format
  CHECK (display_name IS NULL OR display_name ~ '^[A-Za-z0-9_-]{3,20}$');

CREATE UNIQUE INDEX user_profiles_display_name_lower_key
  ON public.user_profiles (lower(display_name))
  WHERE display_name IS NOT NULL;

-- 3. The weekly rule, enforced for every writer (service role included).
CREATE OR REPLACE FUNCTION public.enforce_display_name_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.display_name IS NOT DISTINCT FROM OLD.display_name THEN
    RETURN NEW;
  END IF;

  -- Clearing a name is not offered in the app; allow it (service role only,
  -- e.g. test cleanup) without touching the clock.
  IF NEW.display_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- First set: free, does not start the clock.
  IF OLD.display_name IS NULL THEN
    NEW.display_name_changed_at := OLD.display_name_changed_at;
    RETURN NEW;
  END IF;

  -- A change: allowed if there was no previous change, or it was 7+ days ago.
  IF OLD.display_name_changed_at IS NOT NULL
     AND now() < OLD.display_name_changed_at + interval '7 days' THEN
    RAISE EXCEPTION 'display_name_rate_limited'
      USING ERRCODE = 'P0001',
            DETAIL = to_char((OLD.display_name_changed_at + interval '7 days') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  END IF;

  NEW.display_name_changed_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_profiles_display_name_rules
  BEFORE UPDATE OF display_name ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_display_name_rules();

REVOKE ALL ON FUNCTION public.enforce_display_name_rules() FROM PUBLIC, anon, authenticated;

-- 4. Close the direct-write path for the two name columns. Postgres cannot
-- revoke one column out of a table-level grant, so revoke table UPDATE and
-- grant it back column by column for everything else (behaviour unchanged).
REVOKE UPDATE ON public.user_profiles FROM anon, authenticated;
GRANT UPDATE (
  ggg_account_name,
  ggg_realm,
  ggg_access_token,
  ggg_refresh_token,
  ggg_token_expires_at,
  preferred_price_league,
  updated_at
) ON public.user_profiles TO authenticated;

-- 5. Authors for a page of public builds, in one call. Public builds only:
-- a link-shared or owner-only build's author is never exposed here.
CREATE OR REPLACE FUNCTION public.get_public_build_authors(p_build_ids uuid[])
RETURNS TABLE (build_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, up.display_name
  FROM public.builds b
  JOIN public.user_profiles up ON up.id = b.user_id
  WHERE b.id = ANY (p_build_ids)
    AND b.visibility = 'public';
$$;

REVOKE ALL ON FUNCTION public.get_public_build_authors(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_build_authors(uuid[]) TO authenticated;
