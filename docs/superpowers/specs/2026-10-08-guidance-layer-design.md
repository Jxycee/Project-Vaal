# Authored guidance layer: design (2026-10-08, board item 19)

Status: **design for approval. No app code, no migration file, nothing applied to the database.** The mock is `docs/superpowers/mocks/guidance.html`; open it at 375px.

## What this is

A build today carries state (tree, gear, gems) and one free-text `builds.notes` field. A reader gets the numbers but not the author's reasoning: what to do at each stage, which stats to chase first, how to play the skill, which gem to level next. This adds an owner-authored **Guide** tab to the build page that carries that reasoning, as structured plain text.

## What Maxroll's guides do

From the live read of Maxroll's "Lightning Arrow Deadeye Build Guide" recorded in `2026-09-23-competitor-build-flow-gaps.md` (not re-fetched for this doc). A guide there is a fixed set of sections:

- **Skills**: the skill rotation, plus gem leveling/engraving priority.
- **Ascendancy**, with a "How to Ascend" explainer.
- **Passives**, as named progression stages (Early, Hybrid, Hybrid Crit, CI), each a distinct tree and gear configuration gated on "are you geared enough to swap".
- **Stat priorities**: ranked offensive and defensive lists.
- **Gearing**, per stage.
- **FAQ**, **Summary**, and a dated **Changelog**.

What maps onto us: our checkpoints already are the progression stages (the pobb.in recon found 8 named, leveled checkpoints the same way). The missing pieces are the prose around them: per-stage commentary, stat priorities, rotation, gem priority, FAQ. The changelog is the one Maxroll section we should not build as authored text (see phase 3).

Where we deliberately differ: Maxroll guides are staff-written long pages. Ours are written by any build owner on a phone, so every field is short, capped, plain text and structured (lists, not an editor).

## Decisions

### 1. Where the data lives

Two homes, because the two kinds of content have different lifetimes:

| Content | Home | Why |
|---|---|---|
| Per-checkpoint note | new nullable column `build_checkpoints.note text` | It describes one checkpoint and must live and die with it. Delete cascades, reorder (a `position` change) and duplicate carry it for free. A key inside a build-level jsonb would orphan on delete and need a repair path. |
| Stat priorities, rotation, gem priority, FAQ | new table `build_guides`, one row per build, one `doc jsonb` column | Per-build, not per-checkpoint (see below). A table, not a column on `builds`, for the reasons below. |

**Why a table and not a `builds.guide jsonb` column.** (a) `builds` is the hot, widely read row: the finder, My Builds, the shared view and the mirror triggers all read or write it, and `guard_build_write` runs on every write to it. A guide of up to about 12 KB would ride along every list read for no gain. (b) The guide has its own validator and its own failure modes; keeping it out of `guard_build_write` means the existing, verified guard is untouched. (c) Its own `updated_at` is what a "guide last edited" line and a save-conflict check need, and `builds.updated_at` also moves for unrelated reasons (rename, visibility, mirror syncs). (d) A separate RLS surface can be reasoned about alone. The cost is one more RPC for share-link readers, which is the same pattern as `get_build_checkpoints_by_share_token`.

**Why a table and not one row per section.** The sections are always read and written together, have no cross-section queries, and are small. Relational rows would cost five tables and five RPCs for nothing. jsonb with a database-side validator gives one row, one read, one write.

**Per-checkpoint vs per-build.** Only the note is per-checkpoint. Stat priorities, rotation and FAQ are about the build as a whole (the rotation of a Lightning Arrow Deadeye does not change at level 62 vs 90). Gem priority is one ordered list for the build with target levels; if authors later need it per stage, the note covers it. This keeps the model small: a per-checkpoint doc would multiply every cap by the checkpoint count (a PoB import can have 8).

The `sync_build_mirror_from_checkpoint` trigger fires only on `update of passive_state, gear_state, gem_state, level`, so editing `note` does not fire it and does not move the "active checkpoint" pointer. This is load-bearing and is an E2E assertion below.

### 2. Document shape (`build_guides.doc`, version 1)

```json
{
  "v": 1,
  "offence":  [{ "stat": "...", "why": "...", "tier": "must|good|nice" }],
  "defence":  [{ "stat": "...", "why": "...", "tier": "must|good|nice" }],
  "rotation": [{ "text": "...", "skill": "<gem slug, optional>" }],
  "gems":     [{ "slug": "<gem slug>", "level": 1, "note": "..." }],
  "faq":      [{ "q": "...", "a": "..." }]
}
```

Array order is rank order (first is best). `why`, `skill`, `level` and `note` are optional.

### 3. Caps

| Field | Cap |
|---|---|
| Checkpoint note | 600 characters, newlines allowed |
| Offence list, defence list | 8 entries each; `stat` 1 to 60, `why` up to 140 |
| Rotation | 12 steps; `text` 1 to 160 |
| Gem priority | 10 entries; `note` up to 100; `level` 1 to 40 |
| FAQ | 8 entries; `q` 1 to 100, `a` 1 to 400 |
| Whole `doc` | 16,384 bytes of `jsonb::text` |

Worst-case content by arithmetic is roughly 12 KB, so the 16 KiB total is headroom, not a second cap in practice. All caps live in `src/lib/build/constants.ts` beside `MAX_NOTES_LENGTH` and are mirrored in the SQL, exactly as the 20260926141500 write guard is mirrored by `stateInput.ts`.

### 4. Validation (three layers, same as the existing write gate)

1. **Client**: fields stop accepting input at the cap and show `n / cap`.
2. **Server action** (`saveGuide`, in the same place as `checkpointActions.ts`): full shape check in `src/lib/build/guide.ts`, plus what SQL cannot know: every gem and skill `slug` exists in the current wiki index, and the caller owns the build. Errors come back readable.
3. **Database**: `guide_doc_problem()` plus a BEFORE trigger, because signed-in users can PATCH the table directly through PostgREST (the same reason 20260926141500 exists). It refuses unknown keys, wrong types, over-cap lengths, bad tiers, control characters, and **links**.

**Plain text, no markdown, no links.** Fields are rendered as React text children, never as HTML, so there is no markup injection path. The link ban is separate and about abuse: a shared guide is read by strangers, and a clickable or copyable URL in a public guide is a phishing and spam surface. The check is deliberately conservative (rejects `http(s)://`, `www.`, and a bare `name.com/.net/.org/.gg/.io/.tv/.ly`); a false positive is cured by rewording. Gem `slug`s reuse the existing `build_state_problem()` shape check (`^[a-z0-9_-]{1,120}$`), so there is one slug rule in the database, not two.

### 5. RLS and read paths

Mirrors `build_checkpoints` exactly, including the vocabulary hazard: **`private` means "owner plus anyone with the link", `unlisted` means owner-only** (deliberate inversion, see `20260923051313`). The guide inherits its parent build's visibility and never has its own.

- Owner policy: `for all`, owner of the parent build, `(select auth.uid())` form, both `using` and `with check`.
- Read policy: `select` to `authenticated` only, own build or `visibility = 'public'` (anon is already cut off for builds reads by 20260923234918).
- Share-link readers: `get_build_guide_by_share_token(p_token)`, SECURITY DEFINER, with the filter copied verbatim from `get_build_by_share_token` (`visibility in ('public','private')`). `EXECUTE` revoked from `public, anon`, granted to `authenticated`, as 20260923234918 did for the siblings. If either filter ever changes, change both in one migration.
- Checkpoint notes ride the existing `get_build_checkpoints_by_share_token`, which returns `setof build_checkpoints`; the new column appears with no function change. The TypeScript row type and `load.ts` gain `note`.

### 6. Open decisions for you

1. **Fork**: does a fork copy the author's guide? Proposed default: copy the checkpoint notes (they are part of the checkpoint a fork copies anyway) and **not** the `build_guides` row, so a fork starts as the forker's own voice. Say if you want the opposite.
2. **Duplicate checkpoint** (board item 23): proposed to copy the note with the rest of the checkpoint.
3. Whether a reader of an unauthored build sees the Guide tab at all. Proposed: the tab shows only when a guide or any note exists, or to the owner.

## Phased plan

**Phase 1: notes per checkpoint and stat priorities.** The one migration below. Guide tab with the checkpoint chip strip and note, offence and defence lists, owner edit mode, `saveGuide`, share RPC. The validator accepts the whole v1 shape from day one so phase 2 needs no migration; phase 1 UI simply never writes the other keys.

**Phase 2: rotation, gemcutting priority, FAQ.** UI and server-action changes only, no new column or table. If a field shape must change, that is a `create or replace` of `guide_doc_problem` plus a `v` bump, not a schema change.

**Phase 3 (not planned, listed for completeness): changelog.** Maxroll's dated changelog is best derived, not authored: "checkpoint added/removed" and "guide edited" from `updated_at` values we already keep. Authored changelog entries would be a new capped list in the doc and are not recommended until there is demand.

## Migration (SQL in this document only)

Not saved as a file, **not applied, and not executed against any database in writing this**. Before it is ever applied it must be run inside `BEGIN ... ROLLBACK` against the live database under `set local role authenticated` with a real user's JWT claims, as 20260926141500 was, and the E2E failure modes below checked. File name when the time comes: `YYYYMMDDHHMMSS_build_guidance_layer.sql`.

```sql
-- build_guidance_layer
--
-- 1. build_checkpoints.note: per-checkpoint author commentary.
-- 2. build_guides: one row per build, one validated jsonb doc.
-- 3. guide_doc_problem(): database-side validator (links, caps, shapes).
-- 4. Guards, RLS, share-link RPC.
--
-- The note column is NOT in the column list of
-- sync_build_mirror_from_checkpoint (after update of passive_state,
-- gear_state, gem_state, level), so saving a note does not fire it and does
-- not change builds.active_checkpoint_id. Do not add note to that list.

-- 1. ------------------------------------------------------------------------
alter table public.build_checkpoints
  add column note text,
  add constraint build_checkpoints_note_length
    check (note is null or char_length(note) <= 600);

comment on column public.build_checkpoints.note is
  'Author commentary for this checkpoint, plain text, newlines allowed, at most 600 characters, no links (guard_build_checkpoint_note).';

-- 2. ------------------------------------------------------------------------
create table public.build_guides (
  build_id   uuid primary key references public.builds(id) on delete cascade,
  doc        jsonb not null default '{"v": 1}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.build_guides is
  'Owner-authored guide for one build: stat priorities, rotation, gem priority, FAQ. Visibility is inherited from the parent build. Shape is enforced by guide_doc_problem().';

create trigger set_build_guides_updated_at
  before update on public.build_guides
  for each row execute function public.handle_updated_at();

-- 3. ------------------------------------------------------------------------
-- True when a value is NOT an acceptable guide string: not a string, outside
-- [min, max] characters, has a control character (newline and tab allowed
-- only when p_multiline), or contains something link-shaped.
create or replace function public.guide_text_bad(
  p_v jsonb, p_min int, p_max int, p_multiline boolean default false
)
returns boolean
language plpgsql
immutable
set search_path to ''
as $function$
declare
  s text;
begin
  -- A missing key arrives as SQL NULL, and jsonb_typeof(NULL) <> 'string' is
  -- NULL, not true, so test for it explicitly.
  if p_v is null or jsonb_typeof(p_v) is distinct from 'string' then
    return true;
  end if;
  s := p_v #>> '{}';
  if char_length(s) < p_min or char_length(s) > p_max then
    return true;
  end if;
  if p_multiline then
    -- control characters other than newline and tab
    if s ~ E'[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]' then
      return true;
    end if;
  elsif s ~ '[[:cntrl:]]' then
    return true;
  end if;
  -- Conservative link check; a false positive is cured by rewording.
  if s ~* '(https?:|www\.|[a-z0-9]\.(com|net|org|gg|io|tv|ly)([^a-z0-9]|$))' then
    return true;
  end if;
  return false;
end;
$function$;

create or replace function public.guide_doc_problem(p_doc jsonb)
returns text
language plpgsql
immutable
set search_path to ''
as $function$
declare
  k     text;
  e     jsonb;
  ekey  text;
  lst   text;
begin
  if p_doc is null then
    return 'doc missing';
  end if;
  if jsonb_typeof(p_doc) <> 'object' then
    return 'doc shape';
  end if;
  if octet_length(p_doc::text) > 16384 then
    return 'doc too large';
  end if;
  if (p_doc -> 'v') is distinct from '1'::jsonb then
    return 'doc version';
  end if;

  for k in select jsonb_object_keys(p_doc) loop
    if k not in ('v', 'offence', 'defence', 'rotation', 'gems', 'faq') then
      return 'unknown key ' || left(k, 20);
    end if;
  end loop;

  -- offence and defence: same entry shape, cap 8
  foreach lst in array array['offence', 'defence'] loop
    if p_doc ? lst then
      if jsonb_typeof(p_doc -> lst) <> 'array' or jsonb_array_length(p_doc -> lst) > 8 then
        return lst || ' list';
      end if;
      for e in select jsonb_array_elements(p_doc -> lst) loop
        if jsonb_typeof(e) <> 'object' then return lst || ' entry'; end if;
        for ekey in select jsonb_object_keys(e) loop
          if ekey not in ('stat', 'why', 'tier') then return lst || ' key'; end if;
        end loop;
        if public.guide_text_bad(e -> 'stat', 1, 60) then return lst || ' stat'; end if;
        if e ? 'why' and public.guide_text_bad(e -> 'why', 1, 140) then return lst || ' why'; end if;
        if (e -> 'tier') is null or (e ->> 'tier') not in ('must', 'good', 'nice') then
          return lst || ' tier';
        end if;
      end loop;
    end if;
  end loop;

  -- rotation, cap 12
  if p_doc ? 'rotation' then
    if jsonb_typeof(p_doc -> 'rotation') <> 'array' or jsonb_array_length(p_doc -> 'rotation') > 12 then
      return 'rotation list';
    end if;
    for e in select jsonb_array_elements(p_doc -> 'rotation') loop
      if jsonb_typeof(e) <> 'object' then return 'rotation entry'; end if;
      for ekey in select jsonb_object_keys(e) loop
        if ekey not in ('text', 'skill') then return 'rotation key'; end if;
      end loop;
      if public.guide_text_bad(e -> 'text', 1, 160) then return 'rotation text'; end if;
    end loop;
  end if;

  -- gems, cap 10 (slug shape is checked below by build_state_problem)
  if p_doc ? 'gems' then
    if jsonb_typeof(p_doc -> 'gems') <> 'array' or jsonb_array_length(p_doc -> 'gems') > 10 then
      return 'gems list';
    end if;
    for e in select jsonb_array_elements(p_doc -> 'gems') loop
      if jsonb_typeof(e) <> 'object' then return 'gems entry'; end if;
      for ekey in select jsonb_object_keys(e) loop
        if ekey not in ('slug', 'level', 'note') then return 'gems key'; end if;
      end loop;
      if (e -> 'slug') is null then return 'gems slug'; end if;
      if e ? 'level' and (
           jsonb_typeof(e -> 'level') <> 'number'
           or (e ->> 'level')::numeric <> trunc((e ->> 'level')::numeric)
           or (e ->> 'level')::numeric not between 1 and 40
         ) then
        return 'gems level';
      end if;
      if e ? 'note' and public.guide_text_bad(e -> 'note', 1, 100) then return 'gems note'; end if;
    end loop;
  end if;

  -- faq, cap 8
  if p_doc ? 'faq' then
    if jsonb_typeof(p_doc -> 'faq') <> 'array' or jsonb_array_length(p_doc -> 'faq') > 8 then
      return 'faq list';
    end if;
    for e in select jsonb_array_elements(p_doc -> 'faq') loop
      if jsonb_typeof(e) <> 'object' then return 'faq entry'; end if;
      for ekey in select jsonb_object_keys(e) loop
        if ekey not in ('q', 'a') then return 'faq key'; end if;
      end loop;
      if public.guide_text_bad(e -> 'q', 1, 100) then return 'faq q'; end if;
      if public.guide_text_bad(e -> 'a', 1, 400, true) then return 'faq a'; end if;
    end loop;
  end if;

  -- One slug rule for the whole database: build_state_problem (returned at the
  -- end) checks every $.**.slug, which covers gems[*].slug. rotation[*].skill
  -- is not a key named slug, so its shape is checked here with the same regex.
  if p_doc ? 'rotation' then
    for e in select jsonb_array_elements(p_doc -> 'rotation') loop
      if e ? 'skill' and (
           jsonb_typeof(e -> 'skill') <> 'string'
           or (e ->> 'skill') !~ '^[a-z0-9_-]{1,120}$'
         ) then
        return 'rotation skill';
      end if;
    end loop;
  end if;
  return public.build_state_problem(p_doc);
end;
$function$;

comment on function public.guide_doc_problem(jsonb) is
  'Validates a build_guides.doc: shape, caps, tiers, no links, slug shapes. NULL when fine, else what is wrong. Mirrors src/lib/build/guide.ts.';

-- Guards
create or replace function public.guard_build_guide_write()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
  problem text;
begin
  problem := public.guide_doc_problem(new.doc);
  if problem is not null then
    raise exception 'guide refused: %', problem using errcode = '23514';
  end if;
  return new;
end;
$function$;

create trigger guard_build_guide_write
  before insert or update on public.build_guides
  for each row execute function public.guard_build_guide_write();

create or replace function public.guard_build_checkpoint_note()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  if new.note is not null and public.guide_text_bad(to_jsonb(new.note), 1, 600, true) then
    raise exception 'checkpoint refused: note' using errcode = '23514';
  end if;
  return new;
end;
$function$;

create trigger guard_build_checkpoint_note
  before insert or update on public.build_checkpoints
  for each row execute function public.guard_build_checkpoint_note();

-- 4. RLS ----------------------------------------------------------------------
alter table public.build_guides enable row level security;

create policy "Owners can do everything with their build guide"
  on public.build_guides for all
  using (
    exists (
      select 1 from public.builds b
      where b.id = build_guides.build_id
        and b.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.builds b
      where b.id = build_guides.build_id
        and b.user_id = (select auth.uid())
    )
  );

create policy "Guides on own or public builds are readable"
  on public.build_guides for select
  to authenticated
  using (
    exists (
      select 1 from public.builds b
      where b.id = build_guides.build_id
        and (b.user_id = (select auth.uid()) or b.visibility = 'public')
    )
  );

-- Share-link read path. The visibility filter is copied verbatim from
-- get_build_by_share_token; any divergence is a privacy bug. 'unlisted'
-- (owner-only in this app) is deliberately excluded.
create or replace function public.get_build_guide_by_share_token(p_token text)
returns setof public.build_guides
language sql
stable
security definer
set search_path to 'public'
as $function$
  select g.*
  from public.build_guides g
  join public.builds b on b.id = g.build_id
  where b.share_token = p_token
    and b.visibility in ('public', 'private');
$function$;

revoke execute on function public.get_build_guide_by_share_token(text) from public, anon;
grant execute on function public.get_build_guide_by_share_token(text) to authenticated;
```

The SQL is a draft that has never run. Points the rollback run must check specifically: the control-character regexes in `guide_text_bad` (Postgres escape-string handling of `\x` classes), that a missing required key (for example an entry with no `stat`) is refused rather than slipping through a NULL comparison, and that every helper call carries the `public.` prefix because `search_path` is empty.

Rollback, for the record: `drop function public.get_build_guide_by_share_token(text); drop table public.build_guides; drop function public.guard_build_guide_write(); drop function public.guide_doc_problem(jsonb); drop trigger guard_build_checkpoint_note on public.build_checkpoints; drop function public.guard_build_checkpoint_note(); drop function public.guide_text_bad(jsonb,int,int,boolean); alter table public.build_checkpoints drop column note;`

## E2E failure modes

Preferred mechanism is E2E, one narrow spec (`e2e/build-guide.spec.ts`), written before the code. No unit tests unless one guards a real risk; the one candidate is the link detector in `guide.ts`, because false negatives are a security issue and false positives are a usability one, and it is a pure function with sharp edges. Everything below is asserted from the database where the claim is about storage, not from the UI.

1. **Note save must not move the active checkpoint.** Select checkpoint 1 of 3 so the build's active pointer is on 3; save a note on 1. Expect `builds.active_checkpoint_id` and the mirrored state unchanged. Failure if `note` ever lands in the mirror trigger's column list or the save goes through the state-saving path.
2. **Cap edges.** A 600-character note saves; 601 does not (direct PostgREST PATCH refused with 23514, not only the UI). 8 offence entries save, a 9th is refused; the 16,384-byte doc edge is refused.
3. **Link bypass.** `https://x.test`, `www.x.test`, `x.test/y`, and a link split by a newline are refused at the database via direct PATCH. A normal sentence containing "Lv.5" or "e.g." is accepted (false-positive guard).
4. **Direct write skipping the gate.** A signed-in direct PATCH to `build_guides.doc` with an unknown key, a bad tier, or a gem `slug` such as `../x` is refused by the trigger.
5. **Visibility.** `private` build: a reader with the share link sees the guide and notes through the RPC. `unlisted` build: the same reader gets zero rows. A non-owner PATCH is refused by RLS. Copy-paste of the visibility filter is the likeliest defect (docs-are-the-likeliest-bug-source).
6. **Delete and reorder.** Deleting a middle checkpoint removes its note and no one else's; reordering keeps each note with its checkpoint (the reason the note is a column).
7. **Concurrent edit from two devices.** Save on A, then save on B from a stale load. Expect a conflict message on B naming "edited elsewhere", not a silent overwrite. The whole `doc` is replaced per save, so `saveGuide` sends the `updated_at` it loaded and updates `where updated_at = $loaded`.
8. **Empty states.** A build with no guide: the owner sees an empty editor; a reader sees the single "not written" line or no tab (decision 3), never an empty frame or a crash on a missing `build_guides` row (the row is created lazily on first save, so every read path must treat "no row" as normal).
9. **Mobile.** At 375px: no horizontal scroll except the checkpoint chip strip, every control at least 44px, counters visible while the keyboard is open (reuse `measureTapTargets`).
10. **Fork.** Per decision 1: a fork has the source's checkpoint notes and no `build_guides` row; the fork's owner can add their own.

## Out of scope

Rich text or markdown, images, attachments, comments or likes on guides, per-checkpoint stat priorities, guide templates, translations, a changelog UI, and any GGG art. Gem and skill chips use the real wiki icons under the existing "depicting real in-game content" exception; all chrome is original.
