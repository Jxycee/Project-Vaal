-- 20260923215922_add_build_checkpoints.sql
--
-- Competitor gap #5: a build becomes a sequence of named, leveled checkpoints
-- rather than one static snapshot.
--
-- Done now because public.builds holds exactly ONE row (verified by count
-- immediately before applying this). The same reshape after import populates
-- the table is materially harder, and the first real PoB2 import would
-- otherwise discard seven of its eight tree specs — a real pobb.in build was
-- decoded on 2026-09-23 carrying 8 named specs from "Nivel 31" to "Nivel 94"
-- (docs/superpowers/specs/2026-09-23-pob2-decode-findings.md).
--
-- Note the passive_state default INCLUDES ascendancyNodes, unlike
-- builds.passive_state, whose default omits it and forces every writer to
-- supply all three keys. That older default is a trap, not a pattern; it is
-- deliberately not copied forward.

create table public.build_checkpoints (
  id            uuid primary key default gen_random_uuid(),
  build_id      uuid not null references public.builds(id) on delete cascade,
  position      integer not null,
  name          text not null,
  level         integer not null default 1,
  passive_state jsonb not null default '{"set1": [], "set2": [], "ascendancyNodes": []}'::jsonb,
  gear_state    jsonb not null default '{}'::jsonb,
  gem_state     jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint build_checkpoints_position_unique unique (build_id, position),
  constraint build_checkpoints_level_range check (level between 1 and 100),
  constraint build_checkpoints_name_length check (char_length(name) between 1 and 80)
);

create index build_checkpoints_build_id_position_idx
  on public.build_checkpoints (build_id, position);

comment on table public.build_checkpoints is
  'One snapshot of a build at a point in its leveling journey. position orders them; the builds row mirrors the ACTIVE checkpoint''s three state columns while the finder, MyBuildsList and SharedBuildView still read from there.';
comment on column public.build_checkpoints.position is
  'Zero-based display order, unique per build. Writers use max(position)+1 rather than count, so deleting a middle checkpoint cannot collide.';

alter table public.build_checkpoints enable row level security;

-- Policies mirror build_tags' existing owner-writes / public-parent-reads
-- shape rather than inventing a second pattern for the same question. The
-- (select auth.uid()) form is the initplan-optimised one established by
-- 20260828024222; do not "simplify" it back to a bare auth.uid().
--
-- Note what these policies CANNOT do: a share-link reader is neither the
-- owner nor necessarily looking at a public build, so both policies hide
-- every checkpoint from them. That is solved by a SECURITY DEFINER function
-- in the next migration, exactly as get_build_by_share_token solves it for
-- the builds row itself.

create policy "Owners can do everything with their build checkpoints"
  on public.build_checkpoints for all
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

create policy "Checkpoints on own or public builds are readable"
  on public.build_checkpoints for select
  using (
    exists (
      select 1 from public.builds b
      where b.id = build_checkpoints.build_id
        and (b.user_id = (select auth.uid()) or b.visibility = 'public')
    )
  );

-- Every existing build becomes its own checkpoint 0, named after its level.
-- Guarded by NOT EXISTS so re-running is a no-op rather than a unique
-- violation.
insert into public.build_checkpoints (build_id, position, name, level, passive_state, gear_state, gem_state)
select b.id, 0, 'Level ' || b.level, b.level, b.passive_state, b.gear_state, b.gem_state
from public.builds b
where not exists (
  select 1 from public.build_checkpoints c where c.build_id = b.id
);
