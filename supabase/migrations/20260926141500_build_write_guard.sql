-- 20260926141500_build_write_guard.sql
--
-- The write gate (src/lib/build/stateInput.ts) runs in our server code, but
-- signed-in users can write to `builds` and `build_checkpoints` WITHOUT going
-- through it: the anon key is public, the session JWT is in the browser, and
-- `authenticated` holds INSERT and UPDATE on both tables under owner-only RLS
-- (verified 2026-09-26 in information_schema.role_table_grants). A direct
-- PostgREST PATCH could therefore store
--
--   * an off-origin icon URL, which every viewer of the shared build then
--     loads as <img src> — the tracking pixel the gate exists to prevent;
--   * a path-shaped slug, which viewers' browsers put into a fetch path;
--   * a name of any length, shown in the public finder;
--   * its own view_count, share_token, fork credit or mirror pointer.
--
-- import_build (20260925010117) is callable directly too, with no checks.
--
-- This migration makes the database refuse all of that itself:
--
-- 1. build_state_problem(): the security-relevant subset of the gate, over a
--    jsonb state column — size, every `iconUrl`, every `slug`, every rune.
--    The patterns match src/lib/build/iconUrl.ts and stateInput.ts exactly.
-- 2. BEFORE INSERT/UPDATE triggers on builds and build_checkpoints refuse a
--    state that fails it (SQLSTATE 23514).
-- 3. The builds trigger also pins the columns a client must never choose,
--    when the write comes straight from a client (current_user anon or
--    authenticated, trigger depth 1). SECURITY DEFINER functions
--    (increment_build_view_count) run as their owner, and the mirror
--    triggers run one level deeper, so both keep working unchanged.
-- 4. CHECK constraints bound the short text columns (POST /api/builds now
--    checks the same bounds first, for a readable 400).
-- 5. import_build points the mirror at its last checkpoint by touching that
--    checkpoint, so the mirror trigger does it one level deeper, instead of
--    writing builds.active_checkpoint_id itself (now pinned for clients).
-- 6. user_profiles.created_at is pinned for clients: the build_likes INSERT
--    policy's "member for a day" check reads it.
--
-- Verified before applying, inside BEGIN … ROLLBACK against the live
-- database under `set local role authenticated` with a real user's JWT
-- claims: see the commit that adds this file.

-- 1. -------------------------------------------------------------------------
create or replace function public.build_state_problem(p_state jsonb)
returns text
language plpgsql
immutable
set search_path to ''
as $function$
declare
  v jsonb;
begin
  if p_state is null then
    return null;
  end if;
  -- The gate caps JSON.stringify at 64 KiB; jsonb's text form adds a space
  -- after every ':' and ',', so this is headroom over that, not a second cap.
  if octet_length(p_state::text) > 131072 then
    return 'state too large';
  end if;
  for v in select jsonb_path_query(p_state, 'lax $.**.iconUrl') loop
    continue when jsonb_typeof(v) = 'null';
    if jsonb_typeof(v) <> 'string'
       or (v #>> '{}') !~ '^/data/wiki/[0-9]{4}-[0-9]{2}-[0-9]{2}/icons/([a-z]+/)?[a-z0-9-]+\.png$' then
      return 'iconUrl';
    end if;
  end loop;
  -- Item, gem and mod slugs alike; mod slugs may also carry '_'.
  for v in select jsonb_path_query(p_state, 'lax $.**.slug') loop
    if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^[a-z0-9_-]{1,120}$' then
      return 'slug';
    end if;
  end loop;
  for v in select jsonb_path_query(p_state, 'lax $.**.runes[*]') loop
    if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^[a-z0-9-]{1,120}$' then
      return 'rune';
    end if;
  end loop;
  return null;
end;
$function$;

comment on function public.build_state_problem(jsonb) is
  'The security-relevant subset of src/lib/build/stateInput.ts over one state column: size, iconUrl, slug and rune shapes. NULL when fine, else what is wrong. See 20260926141500.';

-- 2 and 3. -------------------------------------------------------------------
create or replace function public.guard_build_write()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  problem text;
begin
  if current_user in ('anon', 'authenticated') and pg_trigger_depth() = 1 then
    if tg_op = 'INSERT' then
      new.view_count := 0;
      new.forked_from := null;
      new.forked_from_name := null;
      new.forked_from_user := null;
      new.active_checkpoint_id := null;
      new.created_at := now();
    else
      new.view_count := old.view_count;
      new.share_token := old.share_token;
      new.forked_from := old.forked_from;
      new.forked_from_name := old.forked_from_name;
      new.forked_from_user := old.forked_from_user;
      new.active_checkpoint_id := old.active_checkpoint_id;
      new.created_at := old.created_at;
    end if;
  end if;

  if new.share_token is not null and new.share_token !~ '^[A-Za-z0-9_-]{21}$' then
    raise exception 'build refused: share_token' using errcode = '23514';
  end if;

  problem := coalesce(
    public.build_state_problem(new.passive_state),
    public.build_state_problem(new.gear_state),
    public.build_state_problem(new.gem_state)
  );
  if problem is not null then
    raise exception 'build refused: %', problem using errcode = '23514';
  end if;
  return new;
end;
$function$;

comment on function public.guard_build_write() is
  'BEFORE INSERT/UPDATE on builds: refuses unsafe state (build_state_problem) and, for direct client writes, pins view_count, share_token, fork credit, active_checkpoint_id and created_at. See 20260926141500.';

create trigger guard_build_write
  before insert or update on public.builds
  for each row execute function public.guard_build_write();

create or replace function public.guard_build_checkpoint_write()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  problem text;
begin
  problem := coalesce(
    public.build_state_problem(new.passive_state),
    public.build_state_problem(new.gear_state),
    public.build_state_problem(new.gem_state)
  );
  if problem is not null then
    raise exception 'checkpoint refused: %', problem using errcode = '23514';
  end if;
  return new;
end;
$function$;

comment on function public.guard_build_checkpoint_write() is
  'BEFORE INSERT/UPDATE on build_checkpoints: refuses unsafe state (build_state_problem). See 20260926141500.';

create trigger guard_build_checkpoint_write
  before insert or update on public.build_checkpoints
  for each row execute function public.guard_build_checkpoint_write();

-- 4. -------------------------------------------------------------------------
-- Bounds match src/lib/build/constants.ts (MAX_BUILD_NAME_LENGTH,
-- MAX_BUILD_LABEL_LENGTH, MAX_MAIN_SKILL_LENGTH, MAX_NOTES_LENGTH).
alter table public.builds
  add constraint builds_name_length check (char_length(name) between 1 and 80),
  add constraint builds_class_length check (char_length(class) <= 64),
  add constraint builds_ascendancy_length check (ascendancy is null or char_length(ascendancy) <= 64),
  add constraint builds_league_length check (char_length(league) <= 64),
  add constraint builds_main_skill_length check (main_skill is null or char_length(main_skill) <= 200),
  add constraint builds_notes_length check (notes is null or char_length(notes) <= 4000),
  add constraint builds_description_length check (description is null or char_length(description) <= 4000);

-- 5. -------------------------------------------------------------------------
-- Same body as 20260925010117 except the ending: instead of writing the
-- mirror itself, it re-saves the last checkpoint's level, which fires
-- sync_build_mirror_from_checkpoint (AFTER UPDATE OF … level) one trigger
-- level deeper — so the mirror and active_checkpoint_id are set by the same
-- code path as every other save.
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

  -- The build row mirrors the last checkpoint: re-save its level so the
  -- mirror trigger copies it and points active_checkpoint_id at it.
  update public.build_checkpoints set level = level where id = v_last_id;

  return v_build_id;
end;
$function$;

comment on function public.import_build(jsonb, jsonb) is
  'Creates a build and all of its checkpoints in one transaction (PoB import). SECURITY INVOKER; the build row mirrors the last checkpoint via the mirror trigger. See 20260925010117 and 20260926141500.';

revoke execute on function public.import_build(jsonb, jsonb) from public, anon;
grant execute on function public.import_build(jsonb, jsonb) to authenticated;

-- 6. -------------------------------------------------------------------------
create or replace function public.guard_user_profile_write()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  if current_user in ('anon', 'authenticated') then
    new.created_at := old.created_at;
  end if;
  return new;
end;
$function$;

comment on function public.guard_user_profile_write() is
  'BEFORE UPDATE on user_profiles: a client cannot rewrite created_at, which the build_likes INSERT policy''s account-age check reads. See 20260926141500.';

create trigger guard_user_profile_write
  before update on public.user_profiles
  for each row execute function public.guard_user_profile_write();
