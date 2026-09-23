-- 20260923220611_add_get_build_checkpoints_by_share_token.sql
--
-- The share-link read path for checkpoints.
--
-- build_checkpoints' two policies both resolve through public.builds: owner,
-- or parent is public. A share-link reader is neither — the build may be
-- 'private', which means "owner plus anyone holding the link" in this app's
-- vocabulary (see CURRENT-STATE.md; the meanings of private and unlisted are
-- deliberately inverted relative to the usual web sense). So RLS hides every
-- checkpoint from them, and a shared build would render exactly one
-- checkpoint and look broken.
--
-- This is the same shape, and the same reasoning, as
-- get_build_by_share_token: table-level RLS cannot see "the request carried a
-- valid token" because auth.uid() is the only session context a policy has.
-- One SECURITY DEFINER function owns that check so no policy has to know what
-- a token is.
--
-- The filter is copied VERBATIM from get_build_by_share_token as read from
-- pg_get_functiondef on 2026-09-23:
--
--     AND visibility IN ('public', 'private')
--
-- Any divergence between the two is a privacy bug, not a style difference.
-- If one is ever changed, change both in the same migration.
--
-- Deliberately a separate function rather than widening
-- get_build_by_share_token: that one RETURNS SETOF builds and its shape is
-- already depended on by SharedBuildRow in src/lib/build/types.ts. Changing
-- its return type would ripple through the shared-build page for no gain.

create or replace function public.get_build_checkpoints_by_share_token(p_token text)
returns setof public.build_checkpoints
language sql
stable
security definer
set search_path to 'public'
as $function$
  select c.*
  from public.build_checkpoints c
  join public.builds b on b.id = c.build_id
  where b.share_token = p_token
    and b.visibility in ('public', 'private')
  order by c.position;
$function$;

-- Same grants as get_build_by_share_token, verified via
-- has_function_privilege on 2026-09-23: authenticated, anon, service_role.
-- anon matters even though all of /builds is auth-gated today, because the
-- sibling function has it and a divergence would be a surprise later.
grant execute on function public.get_build_checkpoints_by_share_token(text) to anon, authenticated;
