-- 20260923221444_build_checkpoints_triggers.sql
--
-- Two triggers build_checkpoints should have had from 20260923215922.
--
-- 1. updated_at maintenance. Every table in this schema with an updated_at
--    column carries a `set_<table>_updated_at` BEFORE UPDATE trigger calling
--    handle_updated_at() — builds, campaign_progress, characters,
--    user_profiles, verified via pg_trigger on 2026-09-23. build_checkpoints
--    was created without one, so its updated_at would have frozen at insert
--    time. Same function, same naming.
--
-- 2. Every build gets a checkpoint 0 the moment it is inserted.
--
--    The invariant "every build has at least one checkpoint" was established
--    by a one-off backfill. Nothing kept it true for builds created
--    afterwards, and relying on each caller to remember is how invariants
--    decay. An AFTER INSERT trigger makes it hold atomically with the insert
--    itself: a build cannot exist, even for an instant another transaction
--    could observe, without its first checkpoint.
--
--    SECURITY INVOKER (the default, stated explicitly), not DEFINER. The
--    insert runs as the user who created the build and passes through
--    build_checkpoints' own RLS, whose owner policy reads the parent builds
--    row — visible here because an AFTER trigger sees its own row. Least
--    privilege: this function never needs more authority than the caller
--    already had.

create trigger set_build_checkpoints_updated_at
  before update on public.build_checkpoints
  for each row execute function public.handle_updated_at();

create or replace function public.create_initial_build_checkpoint()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  insert into public.build_checkpoints
    (build_id, position, name, level, passive_state, gear_state, gem_state)
  values
    (new.id, 0, 'Level ' || new.level, new.level, new.passive_state, new.gear_state, new.gem_state);
  return new;
end;
$function$;

comment on function public.create_initial_build_checkpoint() is
  'AFTER INSERT on builds: creates checkpoint 0 from the new row, so every build always has at least one checkpoint.';

create trigger create_initial_build_checkpoint
  after insert on public.builds
  for each row execute function public.create_initial_build_checkpoint();
