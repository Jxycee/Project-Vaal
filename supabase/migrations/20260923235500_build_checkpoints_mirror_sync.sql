-- 20260923235500_build_checkpoints_mirror_sync.sql
--
-- The builds row mirrors one checkpoint's state (passive_state, gear_state,
-- gem_state, level) because the finder, MyBuildsList and SharedBuildView
-- still read it from there (see build_checkpoints' table comment). Until now
-- only POST /api/builds kept that mirror, and not reliably:
--
--   * Deleting the mirrored checkpoint left the builds row showing a
--     checkpoint that no longer existed. Nothing re-synced it.
--   * The save route writes the checkpoint, then the builds row, as two
--     separate statements. If the second failed, the checkpoint had already
--     moved and the mirror had not.
--
-- The database now owns the mirror, so it cannot drift:
--
-- 1. builds.active_checkpoint_id records WHICH checkpoint the row mirrors:
--    the one whose state was saved most recently. Deliberately no foreign
--    key: build_checkpoints already references builds (on delete cascade),
--    and a second FK back would make the two tables mutually dependent for
--    no gain. The triggers below are what keep it pointing at a real row.
--
-- 2. AFTER UPDATE OF passive_state, gear_state, gem_state, level on a
--    checkpoint copies that state into its build and points the build at it
--    — in the same statement as the checkpoint write, so the two commit or
--    fail together. Renames (name) and reorders (position) do not list those
--    columns and so do not fire it; they are not saves.
--
-- 3. BEFORE DELETE of the mirrored checkpoint re-points the build at the
--    highest-position checkpoint left (the furthest stage of the build) and
--    copies its state. Named so it sorts after prevent_deleting_last_checkpoint
--    (BEFORE triggers fire alphabetically): refusing to delete the last
--    checkpoint happens first, and there is always a survivor to re-point to.
--    Skipped when the build itself is being deleted, by the same
--    "does the build still exist" test prevent_deleting_last_checkpoint uses.
--
-- 4. create_initial_build_checkpoint also points a new build at its
--    checkpoint 0.
--
-- 5. Backfill: each existing build points at the checkpoint whose state
--    matches its mirror, else its highest-position one.
--
-- All SECURITY INVOKER, like the existing checkpoint triggers: every write
-- here is to a build the caller already owns, through the owner policies.

alter table public.builds add column active_checkpoint_id uuid;

comment on column public.builds.active_checkpoint_id is
  'The build_checkpoints row this build''s passive_state/gear_state/gem_state/level mirror: the one saved most recently. Maintained by triggers on build_checkpoints; no FK by design (see 20260923235500).';

-- 2. A checkpoint save updates the mirror atomically.
create or replace function public.sync_build_mirror_from_checkpoint()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  update public.builds
  set passive_state = new.passive_state,
      gear_state = new.gear_state,
      gem_state = new.gem_state,
      level = new.level,
      active_checkpoint_id = new.id
  where id = new.build_id;
  return new;
end;
$function$;

comment on function public.sync_build_mirror_from_checkpoint() is
  'AFTER UPDATE OF passive_state, gear_state, gem_state, level on build_checkpoints: copies the saved state into the parent build and makes it the active checkpoint.';

create trigger sync_build_mirror_from_checkpoint
  after update of passive_state, gear_state, gem_state, level on public.build_checkpoints
  for each row execute function public.sync_build_mirror_from_checkpoint();

-- 3. Deleting the mirrored checkpoint re-points the mirror.
create or replace function public.repoint_build_mirror_on_checkpoint_delete()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  survivor public.build_checkpoints%rowtype;
begin
  if exists (
    select 1 from public.builds b
    where b.id = old.build_id
      and (b.active_checkpoint_id is null or b.active_checkpoint_id = old.id)
  ) then
    select * into survivor
    from public.build_checkpoints c
    where c.build_id = old.build_id and c.id <> old.id
    order by c.position desc
    limit 1;

    if found then
      update public.builds
      set passive_state = survivor.passive_state,
          gear_state = survivor.gear_state,
          gem_state = survivor.gem_state,
          level = survivor.level,
          active_checkpoint_id = survivor.id
      where id = old.build_id;
    end if;
  end if;
  return old;
end;
$function$;

comment on function public.repoint_build_mirror_on_checkpoint_delete() is
  'BEFORE DELETE on build_checkpoints: if the build mirrors the checkpoint being deleted, re-points it at the highest-position survivor and copies that state.';

create trigger repoint_build_mirror_on_checkpoint_delete
  before delete on public.build_checkpoints
  for each row execute function public.repoint_build_mirror_on_checkpoint_delete();

-- 4. A new build starts pointed at its checkpoint 0. Same body as
-- 20260923221444 plus the pointer.
create or replace function public.create_initial_build_checkpoint()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  first_id uuid;
begin
  insert into public.build_checkpoints
    (build_id, position, name, level, passive_state, gear_state, gem_state)
  values
    (new.id, 0, 'Level ' || new.level, new.level, new.passive_state, new.gear_state, new.gem_state)
  returning id into first_id;

  update public.builds set active_checkpoint_id = first_id where id = new.id;
  return new;
end;
$function$;

-- 5. Backfill.
update public.builds b
set active_checkpoint_id = coalesce(
  (select c.id from public.build_checkpoints c
   where c.build_id = b.id
     and c.passive_state = b.passive_state
     and c.gear_state = b.gear_state
     and c.gem_state = b.gem_state
   order by c.position desc limit 1),
  (select c.id from public.build_checkpoints c
   where c.build_id = b.id
   order by c.position desc limit 1)
)
where b.active_checkpoint_id is null;
