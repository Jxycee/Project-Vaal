-- 20260923223254_build_checkpoints_policy_split_and_rpc_grant.sql
--
-- Two corrections from running Supabase's advisors after
-- 20260923223103, both to work from this session.
--
-- 1. Split the owner policy so it no longer overlaps the read policy.
--
--    20260923215922 said its policies "mirror build_tags". They did not.
--    build_tags has SEPARATE insert and delete policies plus one read policy
--    (verified via pg_policies). build_checkpoints got a single FOR ALL owner
--    policy, which also covers SELECT — so every read evaluated two permissive
--    policies, flagged as multiple_permissive_policies. This makes the
--    original claim true: one SELECT policy, and owner-only INSERT, UPDATE
--    and DELETE, each with the initplan (select auth.uid()) form.
--
-- 2. Revoke anon's EXECUTE on get_build_checkpoints_by_share_token.
--
--    20260923220611 granted anon "to match the sibling function". Checked
--    rather than assumed: get_build_by_share_token genuinely needs anon,
--    because /builds/[shareToken] calls it BEFORE its sign-in check, so
--    revoking it there would turn a signed-out redirect to /login into a 404.
--    This function has no such caller — the page calls it after the check —
--    so anon has no reason to hold it. Least privilege, with no behaviour
--    depending on it. The sibling is left exactly as it is.

drop policy "Owners can do everything with their build checkpoints" on public.build_checkpoints;

create policy "Owners can insert checkpoints on their builds"
  on public.build_checkpoints for insert
  with check (
    exists (
      select 1 from public.builds b
      where b.id = build_checkpoints.build_id
        and b.user_id = (select auth.uid())
    )
  );

create policy "Owners can update checkpoints on their builds"
  on public.build_checkpoints for update
  using (
    exists (
      select 1 from public.builds b
      where b.id = build_checkpoints.build_id
        and b.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.builds b
      where b.id = build_checkpoints.build_id
        and b.user_id = (select auth.uid())
    )
  );

create policy "Owners can delete checkpoints on their builds"
  on public.build_checkpoints for delete
  using (
    exists (
      select 1 from public.builds b
      where b.id = build_checkpoints.build_id
        and b.user_id = (select auth.uid())
    )
  );

-- "Checkpoints on own or public builds are readable" (SELECT) is unchanged
-- and is now the only policy that governs reads.

revoke execute on function public.get_build_checkpoints_by_share_token(text) from public, anon;
grant execute on function public.get_build_checkpoints_by_share_token(text) to authenticated;
