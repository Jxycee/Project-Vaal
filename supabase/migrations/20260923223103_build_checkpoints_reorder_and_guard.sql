-- 20260923223103_build_checkpoints_reorder_and_guard.sql
--
-- Three corrections to build_checkpoints, found while wiring the checkpoint
-- list operations, plus the reorder function they need.
--
-- 1. The position uniqueness becomes DEFERRABLE INITIALLY DEFERRED.
--
--    A non-deferrable unique constraint is checked row by row DURING an
--    UPDATE, so any reorder that moves a checkpoint into a position another
--    one still holds — every swap — fails mid-statement even though the end
--    state is valid. Deferring the check to commit is the standard fix. Note
--    a deferrable unique constraint cannot arbitrate ON CONFLICT; nothing here
--    uses ON CONFLICT on it.
--
-- 2. The redundant index from 20260923215922 is dropped.
--
--    That migration created build_checkpoints_build_id_position_idx on
--    (build_id, position) AND a unique constraint on the same columns, which
--    creates its own index. pg_indexes on 2026-09-23 showed two identical
--    btrees. The constraint's index stays.
--
-- 3. A build can no longer lose its last checkpoint.
--
--    create_initial_build_checkpoint guarantees every build STARTS with one.
--    Nothing stopped a delete from taking it back to zero, and the save route
--    reads "no checkpoints visible" as "not your build". A BEFORE DELETE
--    trigger refuses to remove a build's last checkpoint while the build
--    itself still exists — which is the condition that lets a cascade from
--    deleting the whole build through.
--
--    Known limit, stated rather than hidden: two concurrent transactions each
--    deleting one of a build's last two checkpoints could both pass the check.
--    A single user editing their own build does not produce that; if it ever
--    matters, the fix is a row lock on the parent build inside the trigger.
--
-- 4. reorder_build_checkpoints(p_build_id, p_ids) — one transaction, so the
--    deferred constraint sees only the finished order.

alter table public.build_checkpoints
  drop constraint build_checkpoints_position_unique;

alter table public.build_checkpoints
  add constraint build_checkpoints_position_unique
  unique (build_id, position) deferrable initially deferred;

drop index if exists public.build_checkpoints_build_id_position_idx;

create or replace function public.prevent_deleting_last_checkpoint()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  if exists (select 1 from public.builds b where b.id = old.build_id)
     and not exists (
       select 1 from public.build_checkpoints c
       where c.build_id = old.build_id and c.id <> old.id
     )
  then
    raise exception 'a build must keep at least one checkpoint'
      using errcode = '23514';
  end if;
  return old;
end;
$function$;

create trigger prevent_deleting_last_checkpoint
  before delete on public.build_checkpoints
  for each row execute function public.prevent_deleting_last_checkpoint();

-- SECURITY INVOKER: runs as the caller, through build_checkpoints' RLS. A
-- caller who does not own the build sees none of its checkpoints, so the
-- completeness check below fails for them before anything is written.
create or replace function public.reorder_build_checkpoints(p_build_id uuid, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  expected int;
  touched  int;
begin
  select count(*) into expected
  from public.build_checkpoints
  where build_id = p_build_id;

  -- The new order must name every checkpoint of the build exactly once.
  -- A partial list would leave the omitted ones colliding with the new
  -- positions; duplicates would give one checkpoint two positions.
  if expected = 0
     or coalesce(array_length(p_ids, 1), 0) <> expected
     or (select count(distinct x) from unnest(p_ids) as x) <> expected
  then
    raise exception 'reorder must list every checkpoint of the build exactly once'
      using errcode = '22023';
  end if;

  update public.build_checkpoints c
  set position = o.ord - 1
  from unnest(p_ids) with ordinality as o(id, ord)
  where c.id = o.id
    and c.build_id = p_build_id;

  -- Right count but an id from some other build: fewer rows match here.
  get diagnostics touched = row_count;
  if touched <> expected then
    raise exception 'reorder named a checkpoint that does not belong to this build'
      using errcode = '22023';
  end if;
end;
$function$;

-- Least privilege. New functions in public are executable by PUBLIC (and so
-- anon) by default. RLS would make an anonymous call fail anyway, but there
-- is no reason to leave the door open: only a signed-in owner reorders.
revoke execute on function public.reorder_build_checkpoints(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_build_checkpoints(uuid, uuid[]) to authenticated;
