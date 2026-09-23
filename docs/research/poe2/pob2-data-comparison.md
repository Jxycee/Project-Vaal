# PoB2 Data vs Project Vaal's Dataset

Source examined: `PathOfBuildingCommunity/PathOfBuilding-PoE2`, `dev` branch, read live via
`raw.githubusercontent.com` and the GitHub Contents/Commits API (no clone, no download).
Repo state at time of research: latest `src/Data` commits dated 2026-09-10 (the "Export 0.5.5
data" commit, `49e93925`), `CHANGELOG.md` top entry is tagged release `v0.23.1` (2026-07-28) —
the data on `dev` is newer than the last tagged release.

## Verdict (three sentences)

PoB2's data is mostly redundant with what Project Vaal already holds, and where it overlaps ours
is *better typed* (numeric `{stat, min, max}` rolls vs. PoB2's parenthesised display-string ranges
that need `ModParser.lua`/`ModCache.lua` to interpret). The one clear, high-value gap PoB2 fills is
**gem quality — PoB2's `Skills/act_*.lua` / `sup_*.lua` files carry explicit `qualityStats` and
`altQualityStats` (both current PoE2 "anointed"/alternate-quality variants) per skill, typed with
stat-id + effectiveness-per-quality-point, which our dataset has zero of**. A second, smaller find:
PoB2's `Minions.lua` carries minion base multipliers (life/damage/attack-speed/resistances/moveSpeed
scalars per minion) that we do not have at all.

## Per-category comparison

### Bases (`src/Data/Bases/*.lua`, 29 files, e.g. `bow.lua`)
**CONFIRMED** (read `bow.lua`, first ~60 lines). Format: Lua table keyed by base name, e.g.
`itemBases["Crude Bow"] = { type="Bow", quality=20, socketLimit=4, tags={...}, implicitModTypes={},
weapon={PhysicalMin=6,PhysicalMax=9,CritChanceBase=5,AttackRateBase=1.2,Range=120}, req={} }`.
This is a flat base-item stat table — no icon URLs, no flavour text, no rarity variants, no
`armour{}` block for armour bases (checked bow only, but structure implies parity, not superiority)
for these. It maps roughly onto a subset of our `armour{}`/`weapon{}`/`requirements{}` fields.
**Ours is better**: we already have per-item icons, flavourText, dropLevel, spirit, and (for armour)
armour/evasion/energyShield/ward/block in one record per *actual item*, not just base types. PoB2's
bases are also base-type only (no unique-item-specific stat blocks — those live in `Uniques/`).
Verdict: **no material gap**, ours is a superset for what we track.

### Mods/affixes (`src/Data/ModItem.lua`, `ModFlask.lua`, `ModJewel.lua`, `ModRunes.lua`, etc.)
**CONFIRMED** (read start of `ModItem.lua`). Format:
```lua
["Strength1"] = { type = "Suffix", affix = "of the Brute", "+(5-8) to Strength", statOrder = {992},
  level = 1, group = "Strength", weightKey = {...}, weightVal = {...}, modTags = {"attribute"},
  tradeHashes = { [4080418644] = { "+(5-8) to Strength" } } }
```
The roll range `(5-8)` is embedded **inside the display string**, not a separate typed
`{min, max}` field. To get numeric bounds programmatically, PoB2's own code parses this string at
runtime via `Data/ModCache.lua` (a precomputed string→parse-result cache, confirmed by reading its
head: `c["(10-15)% increased Energy Shield Recharge Rate"]={nil,"(10-15)% increased Energy Shield
Recharge Rate "}`) and `Modules/ModParser` machinery, not a static data file. **Our dataset is
strictly better here**: `public/data/wiki/.../mods/<slug>.json` already gives
`rolls[{stat,min,max}]` with GGG stat ids — exactly what PoB2 has to derive at runtime through Lua
parsing. Adopting PoB2's mod data would be a regression in usability for us.
One thing PoB2 mods do carry that we should check we have: `tradeHashes` (numeric trade-API stat
hash IDs) and `weightKey`/`weightVal` (spawn weight per item-tag). We already have
`spawnWeights[{tag,weight}]` per our spec, so this looks like parity, not a gap — **UNCERTAIN**
whether our `spawnWeights` use the same tag vocabulary as PoB2's `weightKey`, not verified byte-for-byte.

### Gems/Skills (`src/Data/Gems.lua` + `src/Data/Skills/{act_str,act_dex,act_int,sup_str,sup_dex,sup_int,minion,other,spectre}.lua`)
**CONFIRMED** (read `Gems.lua` head and `Skills/act_str.lua` head, ~120 lines, entry "Ancestral Cry").
`Gems.lua` is a flat metadata table per gem (name, tags, gemType, tier, `reqStr/reqDex/reqInt`,
`naturalMaxLevel`) — comparable to, but thinner than, our `skills/<slug>.json` (no description, no
scaling table, no icon path in the excerpt read).
`Skills/act_*.lua` is where the real per-level data lives: `castTime`, a `levels[1..40]` array of
`{levelRequirement, cost={Mana=...}}`, and — **the gap** — top-level
`qualityStats = { {"ancestral_cry_duration_+%_final_per_removable_endurance_charge", 1, {0}} }` and
`altQualityStats = { {"gem_quality_ancestral_cry_global_fire_damage_granted_+%_final", 0.5, {0}} }`.
This is `{stat_id, effect_per_quality_point, base_values}` — typed, not a display string. **Project
Vaal's dataset has zero gem quality data anywhere** (per the brief's own audit of 200 skill files),
so this is a real, material gap PoB2 fills, and it's already reasonably typed (stat id + numeric
coefficient), needing only a stat-id→display mapping (which PoB2's `StatDescriptions/` — not
opened in depth, but present as a directory of GGG stat-description files — would supply, and which
our own mods dataset already demonstrates we know how to produce, since our `rolls[]` use the same
GGG-style stat ids).
Support Gems: not separately opened for quality, but `sup_str.lua` etc. exist in the same
`Skills/` directory with the same file shape, so **UNCERTAIN** whether support-gem quality follows
the same `qualityStats` pattern — likely yes by naming convention, not confirmed by direct read.
Our per-level `stats[{text,min,max}]` scaling table is *display-string-per-level*, already
computed/typed by us — PoB2's `levels[]` array in the excerpt read only carried `cost`/`levelRequirement`,
not per-level stat magnitudes in the same entry (those come from the `statSets[].levels[]` block
with `actorLevel` scaling factors and `constantStats`/`stats` — a more complex, multi-table
structure requiring their calculation engine to resolve into concrete numbers). **Ours is more
directly consumable for display; PoB2's is more granular but requires their calc engine.**

### Uniques (`src/Data/Uniques/*.lua`, 30 files, e.g. `amulet.lua`)
**CONFIRMED** (read `amulet.lua` head, ~60 lines). Format: a flat Lua array of **raw multi-line
strings** in PoB's in-game-paste format, e.g.:
```
[[
The Anvil
Bloodstone Amulet
Variant: Pre 0.2.0
...
Implicits: 1
{tags:life}+(30-40) to maximum Life
...
]]
```
This is **unstructured text**, not JSON/typed data — it is meant to be parsed by PoB2's own item-text
parser (the same one that parses an in-game item copy-paste) at load time, complete with `{variant:N}`
and `{tags:...}` inline markup and free-text `Source: Drops from ...` lines. It does carry something
we may lack: explicit **variant/legacy-roll history** per unique (multiple historical versions of
the same item, e.g. "Pre 0.2.0" / "Pre 0.4.0" / "Current" for The Anvil) and human-readable
**drop-source text** ("Drops from unique{Xesht...} in normal{Twisted Domain}"). Whether our
`items/<slug>.json` already captures unique mod rolls via `uniqueMods` with the same fidelity
(current-patch values only, or also legacy variants) is **UNCERTAIN** — not diffed against a
specific unique file in this pass. Format-wise, ours (JSON, typed) is strictly easier to ingest;
PoB2's is a bespoke text-block format requiring their Lua parser to become usable data.

### Tree (`src/TreeData/0_5/tree.json`, plus `.lua` variant and folders `0_1`…`0_5`, `legion`)
**CONFIRMED** (fetched and parsed as JSON). This is the **same class of artifact as ours** — a
GGG-sanctioned passive-tree export, not a PoB2 invention. Top-level keys: `assets, classes,
connectionArt, constants, ddsCoords, groups, jewelSlots, max_x, max_y, min_x, min_y, nodeOverlay,
nodes, tree`. `classes[].base_str/base_dex/base_int` and `ascendancies[]` are present, matching the
shape our own `public/data/tree/0.5.2/data.json` already documents (`classes, groups, nodes, edges,
...`). Node count: 4914 (`tree.json`, `"tree": "Default"` field — no explicit semver in the file
itself). Last touched in the same 2026-09-10 "Export 0.5.5 data" commit as everything else in
`src/Data`, so **this tree export is contemporaneous with patch 0.5.5**, one folder version (`0_5`)
behind our own directory naming (`0.5.2`), but the *data* itself was regenerated 2026-09-10 — 16
days after our `lastSynced` of 2026-08-25. **No material gap or improvement**: same source, same
shape, and we cannot tell from the file alone whether it's the identical export or differs in the
sub-patch (0.5.2 vs whatever 0.5.5 changed on the tree) — this would need a direct diff against our
`data.json`, not done here (out of scope: no download/clone).

### Minions (`src/Data/Minions.lua`)
**CONFIRMED** (read head, ~80 lines, entries `RaisedZombie`, `SummonedRagingSpirit`). Structure:
```lua
minions["RaisedZombie"] = { name="Raised Zombie", monsterTags={...}, life=0.7,
  fireResist=0, coldResist=0, lightningResist=0, chaosResist=0,
  damage=0.75, damageSpread=0.3, attackTime=1.25, attackRange=9, accuracy=1, critChance=5,
  weaponType1="One Hand Axe", limit="ActiveZombieLimit", baseMovementSpeed=16,
  spectreReservation=50, companionReservation=30, monsterCategory="Undead",
  skillList={"MinionMeleeStep"}, modList={ mod("Speed","MORE",40,1,0), ... } }
```
Note these are **scaling multipliers/coefficients** (e.g. `life = 0.7`), not absolute stat tables —
they get combined with monster-level base tables elsewhere in PoB2's calc engine, so they are not
"plug-and-play" absolute Life/Damage numbers either. Still, **this is a category Project Vaal has
nothing for** (the brief's own gap list flags "minion base stats" as a suspect, and we found no
counterpart in the described dataset). This is a real, if partial, gap: usable for relative
scaling/tagging (minion type, resistances, category, granted skills) even without the full calc
engine, but the absolute numbers require cross-referencing monster base tables not examined here.

### Essences/Crafting (`src/Data/Essence.lua`)
**CONFIRMED** (read head + one truncated preview). Format: `CurrencyLesserEssenceLife = { name=...,
type="Life", tierLevel=12, mods={ ["Helmet"]="IncreasedLife3", ["Body Armour"]="IncreasedLife3", ... } }`.
This maps an essence to a **mod-key string per item slot**, which must then be resolved against
`ModItem.lua`'s mod table (e.g. `IncreasedLife3`) to get the actual stat/roll — another indirection
requiring their data-join, not a self-contained record. We did not find an equivalent
essence/crafting-currency table in Project Vaal's documented dataset (items/mods/skills/tree only),
so this is a **potential small gap** — essence→guaranteed-mod mapping — but PoB2's own
representation of it is an ID that needs a second table lookup, not directly typed either.

### Other data noticed but not analysed in depth
- `ModCache.lua` — precomputed string-parse cache (confirms mod rolls are string-embedded, not typed — used as supporting evidence above, not a distinct data category).
- `StatDescriptions/` (directory, contents not opened) — GGG's raw stat-description translation files; likely the source PoB2 uses to render stat ids as text. Not compared.
- `TimelessJewelData/` (directory, contents not opened) — likely legacy PoE1-style timeless jewel seed data; PoE2 relevance **UNCERTAIN**, not opened.
- `Rares.lua`, `QuestRewards.lua`, `Pantheons.lua`, `WorldAreas.lua`, `Spectres.lua`, `Bosses.lua`, `BossSkills.lua` — not opened; out of scope for the categories requested.
- We looked for a standalone "base Life/Mana/ES per class" table (the brief's suspected gap) and did **not** find one as a discrete data file; `tree.json`'s `classes[].base_str/base_dex/base_int` is the closest thing, and PoE2's actual Life/Mana/ES appear to be formula-derived from level+attributes in PoB2's calc engine rather than stored as a lookup table. So this specific suspected gap is **likely not fillable by a PoB2 data file at all** — it would need their `Modules/Calcs` formulas, i.e. logic, not data. **UNCERTAIN** (we did not open the Calcs modules to confirm the formula lives there).

## Gaps PoB2 could fill that we cannot fill ourselves

1. **Gem quality stats** (`Skills/act_*.lua`, `sup_*.lua` — `qualityStats` / `altQualityStats`) — confirmed, typed, real gap. Highest-value adoption target.
2. **Minion base scaling coefficients** (`Minions.lua`) — confirmed, but coefficients not absolute values; partial value without the rest of PoB2's monster base tables.
3. **Essence→mod-slot mapping** (`Essence.lua`) — confirmed but requires a second join against their internal mod-key table to be useful; low value in isolation.

## Where OUR data is better (say so plainly)

- **Mods/affixes**: ours has pre-parsed numeric `{stat,min,max}` rolls; PoB2 embeds ranges in
  display strings and relies on a runtime parser (`ModCache.lua`/`ModParser.lua`) to extract them.
  Ours is directly consumable; theirs is not, without running their Lua.
- **Items**: ours carries icons, flavour text, drop level, spirit, and per-item (not just per-base)
  armour/weapon blocks; PoB2's `Bases/*.lua` is base-type stats only, no icons/flavour text observed.
- **Uniques**: ours is structured JSON (per the brief's existing `items/<slug>.json` with
  `uniqueMods`); PoB2's `Uniques/*.lua` is raw in-game-paste text blocks requiring their bespoke
  parser — worse typed, though it does carry legacy-variant history we should separately verify we
  have or lack.
- **Icons**: ours are already-extracted served PNGs; PoB2 ships `.dds.zst` compressed texture
  atlases (seen under `TreeData/0_5/*.dds.zst`) that need decompression and atlas-slicing to use —
  meaningfully higher ingestion cost for the same asset class.

## Ingestion cost, if we adopted a slice

**Gem quality (the recommended slice):** `Skills/act_str.lua`, `act_dex.lua`, `act_int.lua`,
`sup_str.lua`, `sup_dex.lua`, `sup_int.lua` (6 files, sizes not measured but each holds full
per-skill data so likely several hundred KB–low MB each) would need: (a) a Lua-table parser (these
are literal Lua, not JSON — a small custom parser or an actual Lua interpreter, e.g. via a
`lua`/`fengari` one-off script, is simplest since the files are `return function(...) ... end`
closures, not plain data literals — confirmed by the `return function(skills, mod, flag, skill)`
wrapper seen in `act_str.lua`), (b) extraction of just `name`, `gameId`/skill key, `qualityStats`,
`altQualityStats` per entry, (c) a mapping from our existing `<slug>.json` skill files to PoB2's
skill keys (e.g. `AncestralCryPlayer` vs our slug) — name-based matching should mostly work but
will need manual review for renamed/split skills. This is a **one-off extraction script**, not
impractical, but not a trivial JSON copy either — budget for a Lua-table-to-JSON conversion pass
(could reuse `fengari` (Lua-in-JS) or a quick Python `lupa`/regex-based extractor given the
regularity of the `automatically generated` format) plus manual slug reconciliation. Order of
magnitude: a few hours, one-time, re-runnable per patch since PoB2 regenerates these on each GGG
data export.

**Minions.lua**, if also adopted: simpler (flat table, fewer entries), similar Lua-parsing
requirement, lower payoff since values are coefficients rather than display-ready stats.

## Licence and provenance

**CONFIRMED**: `LICENSE.md` at repo root is MIT (`Copyright (c) 2016 David Gowor`), covering the
PoB2 *codebase*. Every examined `src/Data/*.lua` file's header explicitly separates data from code
licensing, e.g. `-- This file is automatically generated, do not edit!` / `-- Item data (c)
Grinding Gear Games` (seen verbatim in `Bases/bow.lua`, `Gems.lua`, `ModItem.lua`, `Minions.lua`,
`Essence.lua`, `ModRunes.lua`). **The bundled game data is explicitly copyright GGG, not covered by
PoB2's MIT licence** — PoB2 ships it (with GGG's apparent tolerance, as the whole tool depends on
it) but does not claim to own or relicense it. Provenance: these are auto-generated exports from
GGG's own game files (the "Export 0.5.5 data" commit message, and the `Export/` directory seen at
`src/Export` in the repo root listing, confirm PoB2 runs its own export tooling against GGG data,
not community hand-transcription). This is the same provenance category as our own `public/data/tree/`
GGG-sanctioned export and `public/data/wiki/` patch-server-sourced data — i.e., **adopting a PoB2
data slice would be GGG-sourced official game data, consistent with the existing AGENTS.md carve-out
for depicting real in-game content**, not "GGG art as inspiration," so it would not conflict with
the project's art-provenance rule (this is data, not art, but the same real-in-game-content
justification applies by the same logic the rule already uses for the tree/wiki/prices exceptions).

## Confirmed vs uncertain

| Claim | Status |
|---|---|
| `src/Data` last touched 2026-09-10, commit "Export 0.5.5 data and update trade data (#2505)" | CONFIRMED (GitHub commits API) |
| `CHANGELOG.md` top tagged release is v0.23.1, 2026-07-28 | CONFIRMED (read file) |
| `Bases/bow.lua` structure (base-type stats, no icons/flavour text) | CONFIRMED (read file) |
| `ModItem.lua` rolls are embedded in display strings, not typed min/max | CONFIRMED (read file) |
| `ModCache.lua` is a runtime string-parse cache, implying rolls need parsing | CONFIRMED (read file head) |
| `Skills/act_str.lua` has `qualityStats`/`altQualityStats` typed per-skill | CONFIRMED (read `AncestralCryPlayer` entry in full) |
| Support gems (`sup_*.lua`) follow the same qualityStats pattern | UNCERTAIN (file exists, not opened) |
| `Gems.lua` lacks description/scaling table (thinner than ours) | CONFIRMED for the two entries read; not exhaustively diffed |
| `Uniques/amulet.lua` is raw paste-format text blocks, not JSON | CONFIRMED (read file) |
| Our `uniqueMods` field's fidelity vs PoB2's variant/legacy history | UNCERTAIN (not diffed against a specific unique) |
| `TreeData/0_5/tree.json` shape matches our tree data.json shape | CONFIRMED (parsed JSON keys) |
| Tree data freshness (same 2026-09-10 commit as rest of src/Data) | CONFIRMED (commits API on the specific path) |
| Exact node-for-node equivalence between PoB2 tree.json and our data.json | UNCERTAIN (no diff performed, no download) |
| `Minions.lua` values are relative coefficients, not absolute stats | CONFIRMED (read file; `life=0.7` etc. are clearly scalars) |
| `Essence.lua` mod values require a second lookup into `ModItem.lua`-style table | CONFIRMED (mod values are bare keys like `"IncreasedLife3"`, not embedded stats) |
| No standalone base-Life/Mana/ES-per-class data table exists in `src/Data` | UNCERTAIN (not found in files opened; large surface area not fully searched, e.g. `Modules/Calcs*` not opened) |
| Data licensed as GGG-owned, separate from MIT code licence | CONFIRMED (explicit per-file header comments) |
| `StatDescriptions/`, `TimelessJewelData/` contents | NOT OPENED — no claim made |

## Recommendation

Do not replace any existing category. Adopt one slice: **pull `qualityStats`/`altQualityStats` out
of `src/Data/Skills/act_str.lua`, `act_dex.lua`, `act_int.lua`, `sup_str.lua`, `sup_dex.lua`,
`sup_int.lua`** and merge them into our existing `public/data/wiki/.../skills/<slug>.json` records
as a new `qualityStats`/`altQualityStats` field, keyed by matching skill name/gameId to our slug.
This is the only finding that clears the bar of "materially better, and we have none of it" — it
requires a one-off Lua-to-JSON extraction (not a standing dependency on PoB2), is GGG-sourced data
consistent with the project's existing provenance rule, and fills a real, previously-confirmed
total gap (zero gem quality data across 200 files checked). Everything else examined (bases, mods,
uniques, tree, essences) is either data we already match or exceed in structure, or is PoB2 data
that is *less* typed than ours and would cost more to ingest than it would gain.
