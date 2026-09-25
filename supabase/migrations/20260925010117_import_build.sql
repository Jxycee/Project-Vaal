-- 20260925010117_import_build.sql
--
-- import_build writes an imported build — the builds row and every one of
-- its checkpoints — in ONE transaction. Slice 2's PoB2 import makes up to
-- dozens of checkpoints; written as separate statements from the Server
-- Function, a failure part-way would leave a build with some of its stages
-- and no way for the user to tell. A function call is one statement, so it
-- all commits or none of it does.
--
-- SECURITY INVOKER: it runs as the caller, under the same owner policies as
-- every other build write. It cannot write anything the caller could not
-- write row by row; it only makes the writes atomic. search_path is empty,
-- so every name below is schema-qualified.
--
-- Inputs are produced by importPobBuild after every state has passed the
-- write gate (src/lib/build/stateInput.ts), and the share token is minted
-- there with nanoid, as POST /api/builds does. The table constraints still
-- apply here: a level outside 1..100 or a checkpoint name outside 1..80
-- characters aborts the whole call.
--
--   p_build:       { name, class, ascendancy, level, notes, main_skill,
--                    share_token, game_version }
--   p_checkpoints: [{ name, level, passive_state, gear_state, gem_state }, ...]
--                  1..100 entries, in order; index 0 becomes position 0.
--
-- How it fits the existing triggers:
--   * create_initial_build_checkpoint (AFTER INSERT on builds) makes
--     checkpoint 0 from the builds row, so entry 0 is written by UPDATING
--     that row, and entries 1..n-1 are inserted at positions 1..n-1.
--   * sync_build_mirror_from_checkpoint (20260923235500) fires on that
--     update and points the build at checkpoint 0.
--   * Finally the build row is pointed at the LAST checkpoint, the furthest
--     stage of the build: its level is the character's level (PoB's own
--     build level), and it is what the finder and build lists should show.
--     This is the same choice repoint_build_mirror_on_checkpoint_delete
--     makes. /tree still opens on position 0, the earliest stage.

create or replace function public.import_build(p_build jsonb, p_checkpoints jsonb)
returns uuid
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_count integer;
  v_build_id uuid;
  v_first_id uuid;
  v_last_id uuid;
  v_entry jsonb;
  v_last jsonb;
  i integer;
begin
  if v_user is null then
    raise exception 'import_build requires a signed-in user' using errcode = '42501';
  end if;

  if jsonb_typeof(p_build) is distinct from 'object' or jsonb_typeof(p_checkpoints) is distinct from 'array' then
    raise exception 'import_build: malformed input' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_checkpoints);
  if v_count < 1 or v_count > 100 then
    raise exception 'import_build: between 1 and 100 checkpoints are required, got %', v_count using errcode = '22023';
  end if;

  for i in 0 .. v_count - 1 loop
    v_entry := p_checkpoints -> i;
    if jsonb_typeof(v_entry) is distinct from 'object'
      or jsonb_typeof(v_entry -> 'passive_state') is distinct from 'object'
      or jsonb_typeof(v_entry -> 'gear_state') is distinct from 'object'
      or jsonb_typeof(v_entry -> 'gem_state') is distinct from 'object' then
      raise exception 'import_build: checkpoint % is malformed', i using errcode = '22023';
    end if;
  end loop;

  v_entry := p_checkpoints -> 0;

  insert into public.builds
    (user_id, name, class, ascendancy, level, notes, main_skill, share_token, game_version,
     passive_state, gear_state, gem_state)
  values
    (v_user,
     p_build ->> 'name',
     p_build ->> 'class',
     p_build ->> 'ascendancy',
     (p_build ->> 'level')::integer,
     p_build ->> 'notes',
     p_build ->> 'main_skill',
     p_build ->> 'share_token',
     p_build ->> 'game_version',
     v_entry -> 'passive_state',
     v_entry -> 'gear_state',
     v_entry -> 'gem_state')
  returning id into v_build_id;

  -- Checkpoint 0 exists: the AFTER INSERT trigger made it.
  update public.build_checkpoints
  set name = v_entry ->> 'name',
      level = (v_entry ->> 'level')::integer,
      passive_state = v_entry -> 'passive_state',
      gear_state = v_entry -> 'gear_state',
      gem_state = v_entry -> 'gem_state'
  where build_id = v_build_id and position = 0
  returning id into v_first_id;

  if v_first_id is null then
    raise exception 'import_build: the first checkpoint was not created' using errcode = 'P0001';
  end if;
  v_last_id := v_first_id;

  for i in 1 .. v_count - 1 loop
    v_entry := p_checkpoints -> i;
    insert into public.build_checkpoints (build_id, position, name, level, passive_state, gear_state, gem_state)
    values (v_build_id, i, v_entry ->> 'name', (v_entry ->> 'level')::integer,
            v_entry -> 'passive_state', v_entry -> 'gear_state', v_entry -> 'gem_state')
    returning id into v_last_id;
  end loop;

  v_last := p_checkpoints -> (v_count - 1);
  update public.builds
  set passive_state = v_last -> 'passive_state',
      gear_state = v_last -> 'gear_state',
      gem_state = v_last -> 'gem_state',
      level = (v_last ->> 'level')::integer,
      active_checkpoint_id = v_last_id
  where id = v_build_id;

  return v_build_id;
end;
$function$;

comment on function public.import_build(jsonb, jsonb) is
  'Creates a build and all of its checkpoints in one transaction (PoB import). SECURITY INVOKER; the build row mirrors the last checkpoint. See 20260925010117_import_build.sql.';

revoke execute on function public.import_build(jsonb, jsonb) from public, anon;
grant execute on function public.import_build(jsonb, jsonb) to authenticated;
