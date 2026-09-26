# PoE2 Stat Formula Feasibility

## Last updated
2026-09-23. Game state: patch 0.5.5 "Forbidden Rites". Research method: read Path of Building 2's own source directly via the GitHub API (`api.github.com`, base64-decoded contents — `raw.githubusercontent.com` worked for small text files but 404'd on the default branch name until `dev` was used; GitHub's own web/`github.com` domain was not tested directly), cross-checked numeric claims against a third-party guide (Maxroll) and an independent third-party Python reimplementation, and checked our own extracted wiki dataset directly on disk. No repository was cloned; nothing was downloaded except what these read-only fetches pulled through the API.

## Verdict (answer the user's question in three sentences, up front)

Yes, the formulas are publicly available: Path of Building 2 (PoB2) is MIT-licensed and its `CalcDefence.lua` (240KB) plus `CalcPerform.lua` implement exactly this — Life/Mana/ES/Armour/Evasion/resistances/attributes — so porting the logic (not the file) into TypeScript is legally and technically open. The cost is real but bounded for a defence-only slice: the core arithmetic (base + per-level + per-attribute, then increased/more stacking, armour mitigation, resistance caps and the campaign penalty) is maybe a few hundred lines and every number I found was independently cross-checked and consistent across three unrelated sources; the expensive part PoB2's engine exists mainly to solve — parsing arbitrary rolled affix text into typed modifiers — turns out to be substantially pre-solved for us, because our own extracted wiki dataset (`public/data/wiki/2026-08-25/mods/*.json`) already stores affixes as typed `{stat, min, max}` rolls, not display strings, we just don't attach them to stored gear yet. So: build a small defence engine now, and treat "no rolled affixes on stored gear" as the one real blocker to feeding it real items — nothing here requires porting PoB2's mod-parser.

## 1. Does PoB2 implement the calculation, and where

**CONFIRMED.** Read the directory listing of `PathOfBuildingCommunity/PathOfBuilding-PoE2` (`dev` branch, which is the repo's default branch) at `src/Modules/` directly via the GitHub contents API. It has the same three-file split as PoE1's PoB:

| File | Size | Role |
|---|---|---|
| `CalcOffence.lua` | 364,029 bytes | DPS/offence — not our target |
| `CalcDefence.lua` | 240,006 bytes | Life/Mana/ES/Armour/Evasion/resistances/block — **our target** |
| `CalcPerform.lua` | 181,821 bytes | Orchestrates attribute → derived-stat application (`doActorAttribsConditions`-style functions), ties offence/defence together |
| `CalcBase.lua`, `CalcBreakdown.lua`, `CalcSetup.lua`, `CalcTools.lua`, `CalcSections.lua`, `Calcs.lua` | 7.8–209KB | Supporting infrastructure (mod-application order, tooltip breakdown UI, calc orchestration) |
| `ModParser.lua` | 677,477 bytes | The largest file in the module — parses item/gear affix **display text** into typed mods. This is the piece that exists because GGG ships item text, not typed data (see §4). |

Within `CalcDefence.lua` I directly read (via targeted searches over the decoded source, not the full 240KB at once — noted as a limitation below):
- An explicit `data.misc.MaxResistCap` constant used as a `m_min(...)` ceiling on resistance stacking.
- The armour mitigation formula in the literal form `armour / (armour + raw * data.misc.ArmourRating)` — the same shape as PoE1's, with a PoE2-specific `ArmourRating` constant (a Maxroll guide independently quotes the constant as 12 for PoE2 — see §3).
- ES modifiers built from `modDB:Sum("BASE", nil, "EnergyShield")` combined with the standard base→increased→more stacking pipeline (`base * (1 + inc/100) * more + total`, confirmed directly in the decoded text for Life/Mana/Spirit pools too).
- Explicit block-chance cap handling with separate spell-block accounting.

**Limitation, stated honestly**: `CalcDefence.lua` and `CalcPerform.lua` are 240KB and 180KB of minified-ish Lua. My fetch tool decodes and searches the full text but summarizes through a smaller model rather than returning raw bytes, so for the biggest files I cannot certify I saw *everything* — only what matched my search terms. One specific readback (see §3) produced internal flag names that look garbled (e.g. `"NoStrokBonusToLife"`, `"HalveStrokLifeFrosh"`) — almost certainly an artifact of the summarization step, not real PoB2 code — so I do not trust that particular pass's flag-name details, only the numeric constants it reported, which I separately cross-checked (§3). Treat exact PoB2 variable/flag names in this doc as UNCERTAIN; treat the cross-checked numeric formulas as CONFIRMED.

## 2. Licence, and what it permits

**CONFIRMED — read `LICENSE.md` directly (both root file listing and raw content via `raw.githubusercontent.com/.../dev/LICENSE.md`).**

The primary code license, quoted verbatim from the top of the file:

> Path of Building Community:
>
> Copyright (c) 2016 David Gowor
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

This is **MIT** — the classic permissive license. It permits use, modification, sublicensing, and distribution, including inside a differently-licensed (or closed/commercial) TypeScript app. The only requirement is including the copyright notice and permission text "in all copies or substantial portions of the Software" — i.e. if we port/derive real chunks of `CalcDefence.lua`'s logic, the honest reading is to keep an attribution note (copyright + this license text) somewhere in our repo/docs near the ported code, crediting David Gowor / Path of Building Community. GitHub's own repo metadata reports the license as `NOASSERTION`/"Other" because the license text isn't a single clean top-of-repo `LICENSE` file with one recognized SPDX license — it's a multi-component license manifest (CONFIRMED, same file) — but the actual text for PoB2's own code (the first section, quoted above) is unambiguous MIT.

The same `LICENSE.md` documents licenses for bundled third-party components (Lua runtime, libcurl, LuaJIT, fonts, etc. — all MIT/BSD/Apache/OFL-style, one LGPL exception: `base64.lua`). None of that matters for us: those are runtime dependencies of the desktop Lua application (curl, graphics, fonts), not part of the calculation logic we'd be reading for reference or porting.

**Net: no licence gate.** Porting the arithmetic in `CalcDefence.lua`/`CalcPerform.lua` into TypeScript is permitted under MIT, with attribution as the only real obligation. This is separate from — and does not touch — GGG's own data/art constraints (AGENTS.md already scopes GGG art strictly to depicting real in-game content; a derived *formula* is not GGG's copyrighted art or text, it's game-mechanics knowledge already published by a third party under MIT).

## 3. Where the base numbers live

Cross-checked across **three independent sources** that agree with each other:

| Source | Kind | What it gave |
|---|---|---|
| `CalcPerform.lua` (PoB2, direct decode+search) | Primary, but see §1 caveat on this specific pass | `Life = Str × 2` contribution; `Mana = Int × 2` contribution; Dexterity→Accuracy via a configurable `data.misc.AccuracyPerDexBase` |
| `maxroll.gg/poe2/getting-started/defence-guide` | Secondary (community guide, but quotes in-game tooltip text directly, in quotation marks) | Life: "+12 Life per Character Level", "+2 maximum Life per Strength". Resistances: 75% default cap, 90% max-achievable cap, "-10% penalty to your Resistances" per Act. Armour: "Armour/(Armour + 12 × Damage taken)", 90% max mitigation. |
| `github.com/HivemindOverlord/poe2-mcp`, `src/calculator/resource_calculator.py` (third-party, independent reimplementation, read via its GitHub mirror) | Secondary, independently authored | `BASE_LIFE_AT_LEVEL_1 = 28`, `LIFE_PER_LEVEL = 12`, `LIFE_PER_STRENGTH = 2`; `BASE_MANA_AT_LEVEL_1 = 34`, `MANA_PER_LEVEL = 4`, `MANA_PER_INTELLIGENCE = 2`, `BASE_MANA_REGEN_PERCENT = 4.0`; `ACCURACY_PER_LEVEL = 6`, `ACCURACY_PER_DEXTERITY = 6`; explicit note that its own code has **no** Armour/Evasion/Resistance formulas |

All three agree on Life = 28 base + 12/level + 2/Strength, and Mana = 34 base + 4/level + 2/Intelligence. **CONFIRMED** by triangulation (I did not read any single source I'd call 100%-certain on its own, given the §1 caveat, but three unrelated sources converging on identical numbers is strong evidence).

**Per-class base attributes** (Str/Dex/Int) were already nailed down in our own prior research (`verified-corrections.md` §1.1, sourced from PoB2's `src/TreeData/0_5/tree.json`, GGG's own official tree export bundled in the PoB2 repo): every class starts with 29 total points, split 15/7/7 or 11/11/7. **CONFIRMED** (already verified with primary data in a prior pass; re-cited, not re-derived, here).

**Energy Shield**: no base-from-level/attribute value exists — ES is purely additive from gear/passives/keystones (`CalcDefence.lua`'s `modDB:Sum("BASE", ...)` pattern, and poe2-mcp's calculator explicitly states "No inherent base value from level or attributes"). **CONFIRMED** by two independent sources.

**Resistance caps and campaign penalty**: 75% default cap, up to 90% with specific modifiers, -10% per completed Act (stacking across the "Normal"/"Cruel" difficulty structure our `verified-corrections.md` §3.2 already confirmed exists) — quoted directly from Maxroll's guide, itself quoting in-game tooltip text. **CONFIRMED**, single source but directly quoting GGG's own UI text.

**Armour formula**: `Armour / (Armour + 12 × incoming_raw_damage)`, capped at 90% mitigation — confirmed independently in both the PoB2 source (`armour / (armour + raw * data.misc.ArmourRating)`) and Maxroll's guide (which supplies the literal constant, 12, that `ArmourRating` evaluates to). **CONFIRMED** by two independent sources agreeing on the exact formula shape and constant.

**What's still open**: exact per-level gains and formulas for Evasion Rating's mitigation curve, and the ailment-threshold math already documented qualitatively in `gems-and-skills.md` §7 (I did not re-derive exact numeric thresholds this pass — that doc already flags them as approximate). Spirit's own base value (poe2-mcp cites a `BASE_SPIRIT_FROM_QUESTS = 100` constant, **UNCERTAIN** — single source, not cross-checked, and contradicts `gems-and-skills.md`'s more careful characterization of Spirit as "primarily a campaign+itemization resource" rather than a flat starting value; don't hardcode 100 without re-checking).

## 4. Scope of a defence-only subset

**Arithmetic itself: small.** Base value → +per-level → +per-attribute → stack as BASE, then apply increased/more multipliers, then clamp (resistance cap, armour/evasion diminishing curves) is the entire shape of every defensive stat PoB2 computes, repeated per stat. This is standard "stat pipeline" code — on the order of a few hundred lines of TypeScript for Life/Mana/ES/Armour/Evasion/Resistances/Spirit/attributes, once the constants in §3 are locked down and re-verified directly (not just cross-checked via three secondary passes).

**The hard part PoB2 actually spends most of its code on is the mod parser, not the arithmetic** — `ModParser.lua` alone is 677KB, nearly triple the size of `CalcDefence.lua`. Its job: take GGG's item-clipboard display text (e.g. `"+12% increased maximum Life"`) and turn it into a typed `{stat: "Life", type: "INC", value: 12}`-style modifier, applied in the correct increased-vs-more-vs-base order, correctly attributed to the right tags (so a "+% increased Fire Damage" mod doesn't leak onto Cold skills, etc.). That is a genuinely large, fiddly engine — regex/tokenizer-driven text parsing against hundreds of mod phrasing templates, order-of-operations bugs are the classic PoB bug-tracker category.

**This is where our situation is materially better than "build what PoB2 built":**
- Per the task brief, our stored gear today is base-item-only, with no rolled affixes attached at all. That means **we currently have zero inputs that would need `ModParser.lua`-style text parsing** — there's nothing to parse yet.
- When affixes do get attached to gear, they don't have to arrive as GGG display text needing a parser: our own extracted wiki dataset already has them **pre-typed**. Confirmed directly by reading `public/data/wiki/2026-08-25/mods/*.json` on disk (e.g. `abyssmod1hmaceamanamuprefixdamageagainstfullyarmourbrokenenemies.json`): each mod entry carries a `rolls: [{stat, min, max}]` array with a stable slugified `stat` id (e.g. `"damage_+%_against_enemies_with_fully_broken_armour"`), plus `category` (Prefix/Suffix), `tier`, `level`, and `tags`, not just the free-text `stats` display strings. **CONFIRMED**, read directly, not inferred.
- So the realistic build-order is: (a) ship the defence arithmetic engine against base-item stats + passive tree + gem data (all of which we already hold with high fidelity), which needs no mod parser at all; (b) when gear affixes get modeled, map our own typed `stat` ids into the same engine's input format — a lookup/normalization problem, not a text-parsing problem, because the typing already happened at wiki-extraction time.

**Estimate**: a defence-only engine covering Life/Mana/ES/Armour/Evasion/Resistances/Spirit off of class+level+attributes+passive tree+base-item stats, with no gear-affix support, is realistically a multi-day, not multi-month, effort for one engineer, given the constants in §3 are re-verified directly against GGG's own text first. Adding gear-affix support later is additional but bounded work (mapping our existing typed mod data into the engine, still no parser to write) rather than a second engine.

## 5. What we can validate TODAY with no engine

All of these use data we already hold, confirmed either in this pass or in the two source docs this research was told to start from:

- **Spirit reservation totals** — `gems-and-skills.md` §5 already confirms our extracted `public/data/wiki/2026-08-25/skills/*.json` carries per-gem `reservation` values directly (e.g. Overwhelming Presence = 30, Skeletal Storm Mage = 120). Summing active Persistent-tagged skills' reservations against a Spirit total is pure arithmetic on data we already have — no formula gap at all, only "what is a character's current max Spirit" (open per §3, campaign+gear sourced, not a flat formula).
- **Passive point budget vs. level** — **CONFIRMED this pass** via WebSearch cross-check (Game8, consistent with the 8-ascendancy-point figure already confirmed in `verified-corrections.md`): base passive points = (Level − 1), plus up to 24 from campaign quests, for a maximum of ~125 at level 100 (further +1/+2 from specific endgame mechanics). This means "does this build's allocated node count exceed what this level/quest-progress could have earned" is checkable today with no stat engine.
- **Support-gem socket limits** — `gems-and-skills.md` §4 already confirms each skill's support sockets start at 2 and cap at 5 (independent of gear, tracked per-skill) — a build with 6 supports on one skill is invalid, checkable with a simple count.
- **Attribute requirements on items** — if item base-type data includes Str/Dex/Int requirements (should be present in `public/data/wiki/.../items/*.json`, not independently re-confirmed this pass but consistent with how base items are typically modeled), comparing against a character's current attribute total (base 29 + allocated tree Str/Dex/Int nodes) is arithmetic, not a formula gap.
- **Ascendancy point cap** — already CONFIRMED at 8 total (2 per trial completion, 4 completions) in `verified-corrections.md` §1.2 — trivially checkable against allocated ascendancy nodes.

None of the above needs Life/ES/Armour numbers at all — they're structural/budget validations, and they're the cheapest, highest-value thing to ship before any stat engine exists.

## 6. Alternatives to porting

- **A community formula reference/wiki page**: no dedicated "PoE2 formulas" reference page equivalent to PoE1's long-standing wiki formula pages was found in this pass. Maxroll's Defence Guide (used in §3) is the closest thing — a prose guide that happens to quote several exact constants — but it is not a structured, complete formula reference; it explicitly omits Evasion and full ES mechanics.
- **A data-dump project (RePoE-equivalent)**: **CONFIRMED to exist** — `SilkroadLabs/rePoE2` (already used in `verified-corrections.md`) mines GGG's client for `base_items.json`, `mods.json`, `keywords.json`, etc. This is a data source (items, mods, keywords), not a formula/calculation source — it doesn't reduce the need for the arithmetic in §3/§4, but it's a second independent corroboration path for base-item and mod data alongside our own wiki extraction.
- **Calling PoB2 rather than porting it**: **not realistically feasible for a web product.** PoB2 is a desktop LuaJIT application with no HTTP API, no headless/server mode documented in this research, and no official web build. Standing up a server that runs LuaJIT + PoB2's full codebase (including its UI-coupled `Classes/*.lua` control layer, which `CalcDefence.lua`'s functions are called from) just to extract defence numbers would mean either (a) actually running the desktop app headlessly — unproven, likely fragile, and outside a normal Vercel/Next.js deploy target — or (b) extracting just the calc modules and re-running them in a Lua sandbox on the server, which is a different kind of port (interpreter-level, not logic-level) with its own real cost and doesn't avoid writing/maintaining the equivalent of §4's engine, it just writes it in Lua instead of TypeScript. Not recommended.
- **A third-party open-source reimplementation exists and independently corroborates our numbers**: `HivemindOverlord/poe2-mcp` (used in §3) is a from-scratch Python reimplementation of exactly the Life/Mana/Spirit/Accuracy formulas we need, MIT-adjacent license ("Other"/NOASSERTION per GitHub, donation-funded, described as intentionally free) — worth reading in full (not just the one file sampled here) as a second, independently-derived reference to cross-check our own TypeScript port against once written, though its own author's code admits it has no Armour/Evasion/Resistance formulas, so it can't replace reading PoB2's `CalcDefence.lua` directly for those.

## Confirmed vs uncertain

| # | Claim | Status | How checked |
|---|---|---|---|
| 1 | PoB2 has `CalcDefence.lua` (240KB), `CalcOffence.lua` (364KB), `CalcPerform.lua` (182KB) as distinct modules | CONFIRMED | Read `src/Modules/` directory listing directly via GitHub contents API |
| 2 | `CalcDefence.lua` contains an explicit `MaxResistCap`, an armour formula `armour/(armour+raw*ArmourRating)`, ES built from `modDB:Sum("BASE",...,"EnergyShield")`, and base/inc/more stacking | CONFIRMED (searched, not fully read) | Direct decode+search of the file via GitHub API; explicitly could not certify the full 240KB was reviewed |
| 3 | `ModParser.lua` is 677KB, the largest module in `src/Modules/` | CONFIRMED | Same directory listing |
| 4 | PoB2's own code is MIT-licensed (David Gowor, 2016) | CONFIRMED | Read `LICENSE.md` verbatim via `raw.githubusercontent.com/.../dev/LICENSE.md` |
| 5 | MIT permits porting into a differently-licensed TS app, with attribution required | CONFIRMED | Standard MIT term read directly in the same file |
| 6 | Bundled runtime deps (Lua, libcurl, LuaJIT, fonts) are separately licensed, mostly MIT/BSD/Apache/OFL, one LGPL (`base64.lua`) | CONFIRMED | Same `LICENSE.md`, full text summarized by fetch tool |
| 7 | Life = 28 + 12×level + 2×Strength; Mana = 34 + 4×level + 2×Intelligence | CONFIRMED (triangulated) | 3 independent sources: PoB2 code read, Maxroll guide quoting tooltip text, poe2-mcp's independent Python constants — all agree |
| 8 | Armour mitigation = Armour/(Armour + 12×damage), 90% cap | CONFIRMED (triangulated) | PoB2 code (formula shape) + Maxroll guide (exact constant + cap) |
| 9 | Resistance cap 75% (90% max), -10%/Act campaign penalty | CONFIRMED | Maxroll guide, directly quoting in-game tooltip text |
| 10 | Energy Shield has no base-from-level/attribute component | CONFIRMED | PoB2 code pattern + poe2-mcp's explicit statement, both independent |
| 11 | Per-class base Str/Dex/Int totals (29 pts, 15/7/7 or 11/11/7 split) | CONFIRMED | Re-cited from `verified-corrections.md` §1.1 (GGG's own `tree.json` export), not re-derived this pass |
| 12 | Passive points = (Level−1) + up to 24 campaign + minor endgame bonuses, ~125 max at level 100 | CONFIRMED | WebSearch (Game8), single source this pass but internally consistent with prior confirmed ascendancy-point figures |
| 13 | Spirit's own base value is a flat 100 from quests | UNCERTAIN | Single source (poe2-mcp), contradicts our own more careful `gems-and-skills.md` characterization — do not hardcode |
| 14 | Exact Evasion mitigation formula and curve | UNCERTAIN / not found | Neither PoB2 pass nor Maxroll guide gave it; not resolved this session |
| 15 | Our wiki dataset stores affixes as typed `{stat,min,max}` rolls, not display text | CONFIRMED | Read `public/data/wiki/2026-08-25/mods/*.json` directly on disk |
| 16 | Stored gear currently has no rolled affixes attached | Taken as given (stated in task brief) — not independently re-derived against the live gear schema this pass, since `supabase/schema.sql` is flagged stale by prior project memory and no gear/item table definition was found in it | Not verified this pass |
| 17 | A dedicated "PoE2 formulas" community reference page (RePoE-style, formula-focused) exists | NOT FOUND | Maxroll's guide is the closest, but is prose + partial constants, not a full reference |
| 18 | `rePoE2` (SilkroadLabs) mines GGG client data (items/mods/keywords) | CONFIRMED — re-cited from `verified-corrections.md`, already primary-source-adjacent | Not re-fetched this pass |
| 19 | PoB2 has no server/headless mode suitable for "call it instead of porting it" | UNCERTAIN (absence claim) — no documentation of one was found, but exhaustive search for a hidden CLI/server mode was not performed | Inferred from repo structure (UI-coupled `Classes/*.lua`), not exhaustively ruled out |

## Recommendation

Do not skip the defensive stat sheet — it's buildable. Concretely:

1. **Ship the structural validations first (§5)** — Spirit reservation vs. total, passive point budget vs. level/quests, support-socket counts, ascendancy point cap. Zero formula risk, all data already in hand, delivers real user-facing validation (the "reservation bar turns red" UX) immediately.
2. **Build the defence arithmetic engine next (§4)** as a small, self-contained TypeScript module (a few hundred lines), scoped to Life/Mana/ES/Armour/Evasion/Resistances/Spirit off class+level+attributes+passive tree+base-item stats — explicitly deferring gear affixes, since stored gear has none yet anyway. Before writing it, re-verify every constant in §3 directly against in-game tooltips or a first-hand PoB2 read (this research's numbers are triangulated-confident, not first-hand-certain, per the §1 caveat) — a handful of hours of direct verification, not a blocker.
3. **Attribute the MIT source** wherever the ported arithmetic lives (a code comment plus a NOTICE/credits entry is enough) per §2.
4. **Treat gear-affix support as a later, separate, and smaller-than-feared phase** — when it's time, map our own typed wiki mod data (`public/data/wiki/.../mods/*.json`) into the engine's inputs; this is not the `ModParser.lua` problem, because the text-parsing work already happened once at wiki-extraction time.
5. **Do not attempt to call PoB2 as a service** (§6) — not worth the operational cost versus just finishing the small TypeScript port.
6. **Skip/defer**: full offence/DPS calculation (`CalcOffence.lua`, 364KB — explicitly out of scope per the task), exact Evasion formula and Spirit's precise base-value mechanic until directly re-verified (§3 open items), and anything gear-affix-dependent until gear-affix storage exists.

---

## Second verification, 2026-09-25 (Slice 5 planning)

- **The armour constant is 10 in PoB2 today, not 12.** `src/Modules/Data.lua` sets `data.misc.ArmourRatio = 10`, and `CalcDefence.lua:62-64` computes `armour / (armour + raw × ArmourRatio)`. The "12" above came from Maxroll. Rows 8 and §3 are wrong on the constant; the formula's shape is right.
- **Confirmed first-hand** (raw PoB2 files): Life `12 × level + 16` and Mana `4 × level + 30`, from GGG-exported `life_per_level` / `mana_per_level` (`Data/Misc.lua:156-157`, `CalcSetup.lua:955-956`); +2 Life per Str, +2 Mana per Int, +6 Accuracy per Dex (`CalcPerform.lua:494-519`); resistance cap 75, max 90; base Spirit 0.
- **Spirit from quests** (§3, "UNCERTAIN"): PoB2's `Data/QuestRewards.lua` has +30 (Act 1, King in the Mists), +30 (Act 3, Ignagduk) and +40 (Interlude 3, Lythara), 100 in all, **earned by quest, not flat**.
- The tree's stats are available typed from GGG's `PassiveSkills` table. See `docs/superpowers/plans/2026-09-25-slice5-defence-engine.md`.

## Controller verification, 2026-09-23

Two claims in this report were re-checked independently before it was acted on.

**CONFIRMED — our mod data is typed.** `public/data/wiki/2026-08-25/mods/` holds **5,267** files, each carrying `rolls: [{stat, min, max}]` alongside `tier`, `level`, `generationType`, `families` and `spawnWeights` — e.g. `{"stat":"warcry_cooldown_speed_+%","min":17,"max":25}` beside the display string `"(17-25)% increased Warcry Cooldown Recovery Rate"`. This is the report's most consequential finding and it holds: affixes are a mapping problem against typed data we already own, not a text-parsing problem.

> **This correction was itself wrong (found 2026-09-24).** The raw root `LICENSE.md` on `dev`, fetched with curl and read directly, opens "Path of Building Community: … Copyright (c) 2016 David Gowor", and the name "Xavier Wang" appears nowhere in it. **The report body was right.** `THIRD-PARTY-NOTICES.md` has used the David Gowor line all along. The paragraph below is kept as the record.

~~**CORRECTED — the licence holder.**~~ The report states "Copyright David Gowor, 2016". The actual root `LICENSE.md` on the `dev` branch reads **"Copyright (c) 2018 Xavier Wang"**, and the repository has exactly one licence file at root (24 root entries, verified via the GitHub contents API). The MIT conclusion is unaffected — permissive, attribution required — but any attribution we ship must use the real line, and per-file headers should be checked for the specific modules we port from.

**NOT independently verified:** the numeric constants (Life = 28 + 12/level + 2/Str, etc.), the contents of the large Lua calc files, and the claim that no headless PoB2 API exists. These are relayed from the report, which cross-checked them against three sources. Treat them as strong but unconfirmed until something is built on them.
