-- 20260923234918_builds_reads_require_sign_in.sql
--
-- "No signed-out user may see any build" (product decision, 2026-09-23) was
-- enforced by the app only: proxy.ts, the pages and the Server Functions. The
-- database itself still answered the anon role, and the anon key ships in the
-- client bundle, so anyone could skip the app and ask PostgREST directly:
--
--   GET /rest/v1/builds?select=*             -> every public build
--   GET /rest/v1/build_checkpoints?select=*  -> every checkpoint of those
--   (and the same for build_tags, build_likes)
--
-- Verified against pg_policy on 2026-09-23: all four "readable" SELECT
-- policies were TO PUBLIC, and anon held SELECT on the tables. The owner
-- policies were never a problem (auth.uid() is null for anon, so they match
-- nothing), which is why only these four change.
--
-- 1. The four read policies become TO authenticated. Their USING expressions
--    are untouched. The builds one is renamed, since "by anyone" is now false.
--
-- 2. get_build_author_name filters on visibility. It is SECURITY DEFINER and
--    returned the owner's display_name for ANY build id, including 'unlisted'
--    (owner-only) builds. Its only caller, /builds/[shareToken], renders
--    public and private builds only, so the filter matches
--    get_build_by_share_token's exactly.
--
-- 3. anon loses EXECUTE on the three SECURITY DEFINER build functions it
--    still held. get_build_by_share_token kept it only because
--    /builds/[shareToken] loaded the build BEFORE checking sign-in (see
--    20260923223254's note); that page now checks sign-in first, in the same
--    commit as this migration. get_build_author_name and
--    increment_build_view_count were only ever called after that check —
--    and increment_build_view_count let anyone inflate a public build's view
--    count by id.

alter policy "Public builds are readable by anyone" on public.builds to authenticated;
alter policy "Public builds are readable by anyone" on public.builds
  rename to "Public builds are readable by signed-in users";

alter policy "Checkpoints on own or public builds are readable" on public.build_checkpoints to authenticated;
alter policy "Tags on own or public builds are readable" on public.build_tags to authenticated;
alter policy "Likes on own or public builds are readable" on public.build_likes to authenticated;

create or replace function public.get_build_author_name(p_build_id uuid)
returns text
security definer
set search_path = public
language sql
stable as $$
  select up.display_name
  from public.builds b
  join public.user_profiles up on up.id = b.user_id
  where b.id = p_build_id
    and b.visibility in ('public', 'private');
$$;

revoke execute on function public.get_build_author_name(uuid) from public, anon;
grant execute on function public.get_build_author_name(uuid) to authenticated;

revoke execute on function public.get_build_by_share_token(text) from public, anon;
grant execute on function public.get_build_by_share_token(text) to authenticated;

revoke execute on function public.increment_build_view_count(uuid) from public, anon;
grant execute on function public.increment_build_view_count(uuid) to authenticated;
