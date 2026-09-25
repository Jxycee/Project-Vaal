# Slice 3 — Structural Validation: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pure functions that look at one checkpoint's tree, gear and gems and return typed warnings (competitor gap #2, structural half). No formulas. Slices 4 and 5 reuse them.

**Architecture:** A fetch-free, React-free module under `src/lib/build/validate/`, unit-tested with failure modes written first, plus one real-data test. The editor runs it on the live checkpoint state and shows the result on test-grade surfaces: a warning marker on the offending gear row, a plain warnings list in the gear sheet, and a reserved-Spirit total in the gem sheet. The off-hand slot is widened to what the game allows, and the rules warn about pairings it forbids.

**Tech Stack:** Next.js 16.2.9, TypeScript, vitest, Playwright. No migration.

**Anchor:** `docs/superpowers/CURRENT-STATE.md`. **Handoff:** `docs/superpowers/handoffs/2026-09-24-slices-3-to-5-handoff.md`.

---

## Global Constraints

Every constraint in `plans/2026-09-23-convergence-integration.md` applies. In particular:

- **AGENTS.md testing rules.** Never write unit tests after the code. Prefer E2E. When testing in isolation, **write every way it could fail first**, then the code.
- **No UI redesign.** New surfaces are test-grade: plain markup, 44px controls, `TEST-GRADE` header comment, portal sheets at `z-40`.
- **The write gate (`src/lib/build/stateInput.ts`) is unchanged by this slice.** Nothing new is stored. Warnings are derived and never persisted.
- **E2E writes to the production database** under the test account. Prefix every build `E2E-`, clean up in `afterAll`, and check the table afterwards.
- **Gates before every commit:** type-check, lint, test, build. Report real output.

---

## Decisions (user, 2026-09-24)

| # | Question | Answer |
|---|---|---|
| 1 | Two-handed occupancy: warn or block | **Warn** — see the reasoning below. The user's framing: a two-hander fills both hands of *its* weapon set (the game draws it in both slots); the *other* weapon set stays free, because the game swaps sets by skill. A conflicting item gets a warning marker. A tooltip is a QoL follow-up. |
| 2 | Off-hand omits Sceptres and dual-wielded one-handers | **Widen + warn.** The off-hand picker offers what PoB2 allows; the rules warn about pairings it rejects. |
| 3 | Reservation vs Spirit | **Show the reserved total now; compare it against Spirit in Slice 5**, whose engine computes Spirit properly. |
| 4 | Attribute choices (`AttributeOverride`) | **Slice 5.** Not touched here. |

**Why warn, not block (decision 1, controller's call as the user asked):** PoB2's off-hand rule has three keystone and ascendancy exceptions (Giant's Blood, Instruments of Power, Lord of the Wilds). Whether an off-hand item is legal depends on the tree, and the tree changes per checkpoint and mid-edit. A block would either refuse a save or silently remove gear whenever such a node is deallocated. The second breaks the orphan rule jewels already follow ("respeccing must never silently discard a chosen item"). PoB2 itself unequips the item in that case (`ItemsTabClass:ValidateWeaponSlots`); we keep it and warn instead.

---

## Verified facts this plan is built on

Checked 2026-09-24. "PoB2" means `PathOfBuildingCommunity/PathOfBuilding-PoE2`, branch `dev`, fetched raw with curl and read directly, not through a summariser.

| Fact | How verified |
|---|---|
| **Talismans are two-handed.** All 31 Talisman bases carry `two_hand_weapon` and `twohand` in `tags`, and PoB2's `Data.lua` `data.weaponTypeInfo` has `["Talisman"] = { oneHand = false }`. PoB2's `Data/Bases/talisman.lua` tags agree. | script over `items/*.json`; PoB2 `src/Modules/Data.lua:605-625`, `src/Data/Bases/talisman.lua` |
| **Why our data says `twoHanded: false` for them:** `@poe2-toolkit/item-extractor` derives `twoHanded` from a hardcoded `TWO_HANDED_CLASSES` set that omits `Talisman` (added in 0.4.0). Its own `CLASS_TAGS` table, which it says was "validated 1:1 against Path of Building's `Data/Bases`", gives Talisman `two_hand_weapon`. So this is a stale extractor list, not a game fact. Resolves the CURRENT-STATE "Unresolved discrepancy". | `node_modules/@poe2-toolkit/item-extractor/dist/buildItems.js:23-26, 73, 265` |
| Across all items with tags, `twoHanded` vs the `two_hand_weapon` tag differs only for: Talisman (31, flag wrong), Staff (17, flag right; caster staffs carry `twohand` but not `two_hand_weapon`), and 3 `HiddenItem` placeholders | script over `items/*.json` |
| **Uniques carry no tags and no base.** Their `category` is the unique-stash category. For `Mace` (24 uniques) that merges one- and two-handed maces, so **their handedness is unknown to us**. E.g. PoB2 lists Hrimnor's Hymn on Oak Greathammer (2H) and Frostbreath on Slim Mace (1H), while our data gives both category `Mace`, `twoHanded: false`. Unique Bow, Crossbow, Staff and Warstaff are all `twoHanded: true`; unique Talismans are category `Talisman`. | script over `items/*.json`; PoB2 `src/Data/Uniques/mace.lua` |
| **So two-handedness is decidable from a stored item's `category` alone**, with no detail fetch: `Two Hand Sword`, `Two Hand Axe`, `Two Hand Mace`, `Bow`, `Crossbow`, `Staff`, `Warstaff`, `Talisman` → two-handed. `Mace` (uniques only) → unknown. Everything else in the main-hand list → one-handed. | the two rows above, plus `WEAPON_MAIN_CATEGORIES` in `src/lib/build/gearSlots.ts` |
| **PoB2's off-hand rule** (`ItemsTabClass:IsItemValidForSlot`, "Weapon 2" branch): Bow main → Quiver only. Talisman main + Lord of the Wilds → non-unique Sceptre. Staff main + Instruments of Power → Focus. Unarmed, one-handed main, or Giant's Blood with an axe/mace/sword main → Shield, Focus, Sceptre, or a `one_hand_weapon` (not when the main is a Wand or Sceptre; the off-hand may not be a Spear), or with Giant's Blood a two-handed axe/mace/sword. Anything else → not allowed. | PoB2 `src/Classes/ItemsTab.lua:2613-2695` |
| Bucklers are `type = "Shield"` in PoB2, so every Shield rule covers Buckler | PoB2 `src/Data/Bases/shield.lua` |
| `one_hand_weapon` is carried by Claw, Dagger, Flail, One Hand Axe/Mace/Sword and Spear. Wand and Sceptre carry only `onehand`, so they cannot be dual-wielded as an off-hand. Sceptre is allowed off-hand by name. | extractor `CLASS_TAGS`, `buildItems.js:44-77` |
| **Our off-hand today:** `Shield, Buckler, Focus, Focii, Quiver` — no Sceptre, no one-hand weapon | `src/lib/build/gearSlots.ts` `WEAPON_OFF_CATEGORIES` |
| Keystones in our 0.5.2 tree: `32349` Giant's Blood (keystone), `61942` Lord of the Wilds (keystone), `20701` Instruments of Power (**ascendancy** notable, carries `ascendancyId`) | `public/data/tree/0.5.2/data.json` |
| PoB import already refuses an item whose category does not fit the target slot (`mapItems.ts:221`), so widening the off-hand makes imports **keep** dual-wielded weapons they drop today | `src/lib/pob/mapItems.ts:215-223` |
| The write gate does **not** check category against slot: a direct POST, or an older row, can store any category in any slot | `src/lib/build/stateInput.ts` `cleanGearStateInput` |
| **Reservation data:** 109 skill records carry a non-zero `scaling[].reservation` (59 Active, 20 Spirit, **30 Support** gems). It is constant across levels for 100 of them; 9 vary by level. | script over `skills/*.json` |
| A support gem's Spirit reservation **adds** to its skill's: PoB2 turns the support's `spiritReservationFlat` into an `ExtraSpirit` BASE mod on the skill (e.g. Clarity I, 10). Reservation *multipliers* and efficiency are applied later, which is Slice 5's job. | PoB2 `src/Modules/CalcActiveSkill.lua:738-745`, `src/Data/Skills/sup_int.lua` "Clarity I" |
| **Spirit sources are not simple** (why the comparison waits for Slice 5): PoB2 base Spirit 0 (`CalcSetup.lua:958`); quests +30 / +30 / +40 (`Data/QuestRewards.lua`: King in the Mists, Ignagduk, Lythara); item base spirit; tree nodes `+10 to Spirit`, `% increased Spirit`, and nodes that grant Spirit from body-armour ES/Evasion (`8143`), from Life (`46644`), halve it (`61942`) or zero it (`41076`) | PoB2 files named; tree script over node `stats` |
| Our skill data carries **no weapon-type requirement** (Lightning Arrow's tags have no `Bow`; Shockburst Rounds none for Crossbow), so "this skill needs a weapon its set lacks" **cannot** be checked from our data | `skills/lightning-arrow.json`, `skills/shockburst-rounds.json`, tag census of 419 active gems |
| The weapon-set 24-point pool and the 8 ascendancy points are enforced at **edit** time (tree-core toggles; `PassiveTree.tsx:142`), not on **seeding** a stored state. So an import or an older row can exceed them. The level-derived basic budget is already signalled in `TreeControls.tsx`. | code read |

### Unverified, and excluded

- **Support-gem uniqueness** (one copy of a support per character or per skill, and PoE2's gem families like Clarity I/II). Sources disagree, and our data has no `gemFamily`. **Not checked in this slice.**
- **Unique mace handedness.** No rule fires for a unique in category `Mace`, and the warnings list says why when one is equipped with an off-hand.

---

## The rule table (per weapon set, main `M` and off-hand `O`)

`2H` = the category list above. Keystone availability is read from **that set's** allocation (`set1` or `set2`, both of which include shared nodes) plus `ascendancyNodes`.

| `M` | `O` allowed | Otherwise |
|---|---|---|
| empty, or one-handed | Shield, Buckler, Focus, Focii, Sceptre; a one-hand weapon unless `M` is Wand or Sceptre or `O` is Spear | `offhand-not-allowed` |
| Bow | Quiver | `two-handed-occupied` |
| any non-Bow | — (Quiver never) | `quiver-needs-bow` |
| Talisman + Lord of the Wilds | non-unique Sceptre | `two-handed-occupied` |
| Staff + Instruments of Power | Focus, Focii | `two-handed-occupied` |
| Two Hand Axe/Mace/Sword + Giant's Blood | as "one-handed" above, plus Two Hand Axe/Mace/Sword | `offhand-not-allowed` |
| any other 2H | nothing | `two-handed-occupied` |
| unique `Mace` (handedness unknown) | treated as one-handed, **plus** a `handedness-unknown` note when `O` is filled | — |

Plus, independent of pairing:
- `slot-category-mismatch` — any gear slot holding a category `categoriesForSlot` does not list (older rows, direct POSTs).
- `weapon-set-points-over` — nodes in only `set1` (or only `set2`) exceed 24.
- `ascendancy-points-over` — more than `MAX_ASCENDANCY_POINTS` ascendancy nodes.

**Occupied display:** when `M` is 2H and no exception makes any off-hand legal, an **empty** off-hand row reads "Occupied by <M name>", which mirrors the game.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/build/validate/types.ts` | `BuildWarning` (`code`, `target: {kind:'gear', slot} \| {kind:'tree'} \| {kind:'gems'}`, `message`) |
| `src/lib/build/validate/handedness.ts` | `handednessOf(category): 'one' \| 'two' \| 'unknown'` and the category sets. Pure. |
| `src/lib/build/validate/weaponRules.ts` | `offHandRule(main, keystones)` and `validateWeapons(gear, passive)`, following the rule table. Pure. |
| `src/lib/build/validate/keystones.ts` | node ids for the three exceptions, and `keystonesFor(passive, set)`. Pure. |
| `src/lib/build/validate/reservation.ts` | `reservedSpirit(gems, scalingBySlug)` gives per-set totals plus the slugs whose data was missing. Pure. |
| `src/lib/build/validate/index.ts` | `validateCheckpoint({passive, gear})` joins the rules with slot-category and point-count checks. |
| `src/lib/wiki/fetchGemScaling.ts` | add a cached `fetchSkillScaling(slug)`, reusing the existing fetch path |
| `src/lib/build/gearSlots.ts` | widen `WEAPON_OFF_CATEGORIES` |
| `src/components/build/GearSheet.tsx` | per-row warning marker, the "Occupied by" state, and a TEST-GRADE warnings list |
| `src/components/build/GemsSheet.tsx` | TEST-GRADE reserved-Spirit line |
| `e2e/validation.spec.ts` | the primary verification |

---

## Task 1: `handedness.ts` + `keystones.ts` — failure modes first

- [ ] Tests first: every one of the 8 two-handed categories → `'two'`; `Mace` → `'unknown'`; each one-handed main category → `'one'`; an unknown string → `'unknown'`, never `'one'`. `keystonesFor` reads set-specific nodes from the right set only, ascendancy nodes for both sets, and ignores non-numeric junk.
- [ ] **Real-data test:** for every item on disk in a `'two'` category that carries tags, the tags include `twohand`. Every base in a `'one'` main-hand category carries `onehand`. The three keystone ids resolve in `data.json` to the names Giant's Blood, Lord of the Wilds and Instruments of Power.
- [ ] Run FAIL → implement → PASS → gates → commit.

## Task 2: widen the off-hand

- [ ] `WEAPON_OFF_CATEGORIES` += `Sceptre`, `One Hand Sword`, `One Hand Axe`, `One Hand Mace`, `Mace`, `Claw`, `Dagger`, `Flail`, `Two Hand Sword`, `Two Hand Axe`, `Two Hand Mace`. **Not** Spear, and **not** Wand (neither is ever a legal off-hand per PoB2). Each addition gets a comment citing the PoB2 rule.
- [ ] Update `gearSlots.test.ts` expectations **before** the code. Check that `/api/wiki/items?slot=weapon1_off` needs no change (it reads `categoriesForSlot`).
- [ ] PoB import: add a `mapItems` failure-mode test first, showing a PoB `Weapon 2` dagger now maps to `weapon1_off` instead of being dropped. Then check the fixture's expectations are unchanged (its off-hands are not weapons — confirm on the fixture, do not assume).
- [ ] Gates, commit.

## Task 3: `weaponRules.ts` — failure modes first

- [ ] One test per rule-table row, positive and negative, **per set**: a 2H in set 1 never warns about set 2; Bow + Quiver clean, Crossbow + Quiver warns; Talisman + Sceptre warns without Lord of the Wilds and is clean with it, but warns for a *unique* Sceptre; Staff + Focii clean with Instruments of Power as an **ascendancy** node; Giant's Blood allocated only in set 2 does not excuse set 1; Wand main + Dagger off warns; Dagger main + Spear off warns; unique `Mace` + Shield gives only a `handedness-unknown` note; empty main + Dagger off is clean.
- [ ] `offHandRule` exposes "is any off-hand legal", which drives the "Occupied by" display.
- [ ] Run FAIL → implement → PASS → gates → commit.

## Task 4: `reservation.ts` — failure modes first

- [ ] Tests: a loadout counts toward each set in its `sets`; skill reservation is read at the loadout's level (exact level entry, else the nearest lower, else the lowest); supports read at level 1 and **add**; a gem with no reservation adds 0; a slug missing from `scalingBySlug` is reported in `missing` and never counted as 0 silently; an empty loadout contributes nothing.
- [ ] **Real-data test:** Alchemist's Boon at level 1 → 30; with Clarity I as a support → 40.
- [ ] Run FAIL → implement → PASS → gates → commit.

## Task 5: `validateCheckpoint` + the tree checks — failure modes first

- [ ] Tests: slot-category mismatch per slot; weapon-set-only counts above 24 per set (and exactly 24 is clean); ascendancy above 8 (exactly 8 is clean); an empty state gives `[]`; output order is stable (tree, then gear in `GEAR_SLOTS` order).
- [ ] Run FAIL → implement → PASS → gates → commit.

## Task 6: TEST-GRADE wiring

- [ ] `TreeBuildSession` computes `validateCheckpoint` from its live state with `useMemo` and passes the warnings down. No new state, no effect.
- [ ] `GearSheet`: a `⚠`-marked row with `data-testid="gear-warning-<slot>"` and the message in plain text under the name (no tooltip; that is QoL for later). An empty off-hand whose set's `M` makes every off-hand illegal reads "Occupied by <name>". A plain "Warnings" list at the top, listing every warning with `data-testid="build-warning"`.
- [ ] `GemsSheet`: "Spirit reserved — Set I: N · Set II: M (before reservation modifiers; compared with Spirit in a later update)", plus "data missing for: …" when relevant. Scaling comes from the cached `fetchSkillScaling`.
- [ ] `TEST-GRADE` header comments, 44px controls. Gates, commit.

## Task 7: E2E — the primary verification

`e2e/validation.spec.ts`, mobile project, against the live database, `E2E-` names, `afterAll` cleanup, table checked afterwards. **Check ports 3100-3110 first.**

- [ ] Set I: Siege Crossbow main. The empty off-hand reads "Occupied by Siege Crossbow". Add a Shield off-hand and assert **exactly one** `gear-warning-weapon1_off` marker and one `build-warning`. Switch to set II and assert **zero** markers there, a paired positive against a scan that counted both set II rows.
- [ ] Set II: a Dagger main and a Dagger off-hand (the widened picker must offer it) → no warning. Then a Bow main and a Quiver off-hand → no warning.
- [ ] Save, **full reload**, reopen the gear sheet: the Crossbow + Shield warning comes back, and the set II gear comes back populated.
- [ ] Gems: one loadout with Alchemist's Boon + Clarity I, tagged to set I → "Set I: 40 · Set II: 0". Assert the exact text, not just its presence.
- [ ] Tap-target scan of the gear sheet with warnings showing, asserting the scanned count.
- [ ] Full suite, then update `CURRENT-STATE.md` in the same commit range: Talisman resolution, the off-hand widening, what is validated and what is not (support uniqueness, unique-mace handedness, skill weapon types, Spirit comparison).

---

## Open questions carried to later slices

1. **Fix `twoHanded` at the source?** Our normaliser could set `twoHanded` from `twohand` tags. It only reaches disk through a full `npm run sync:wiki`. Nothing here needs it, since the rules use `category`, so it is left for the next planned sync. A toolkit fix (adding `Talisman` to `TWO_HANDED_CLASSES`) is the proper upstream change.
2. **Unique bases.** Knowing a unique's base (and so a unique mace's handedness) needs data we do not extract. PoB import sees the base line (line 3 of a unique) and Slice 4 could keep it.
3. **Weapon-set passive points before endgame.** PoB2 caps them by quest progress (2 per quest, 12 quests, per `QuestRewards.lua`). We warn only above the endgame 24. Slice 5's campaign-progress decision can refine this.
