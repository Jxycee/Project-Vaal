# PoB2 Share Code — Decode Findings

**Date:** 2026-09-23
**Status:** Slice 0, Task 4 of `plans/2026-09-23-convergence-integration.md`. This is the gate that Slice 2 (import) is designed against.

Every number below came from decoding one real share code on disk. Nothing here is relayed from another document. The fixture is committed at `src/lib/pob/__fixtures__/sample-pob2-code.txt` so any claim can be re-checked.

## Source

- Build: `https://pobb.in/TUsV2f6hi8cg` — a public, player-authored level-94 Artillery Ballista Witchhunter, Spanish-language notes.
- Raw code fetched from `https://pobb.in/pob/TUsV2f6hi8cg` on 2026-09-23. **11,140 characters** of URL-safe base64.
- Decoded with `base64url → zlib inflate`: **36,691 bytes** of XML. The pipeline in `docs/research/poe2/build-sharing-ecosystem.md` §2.1 is correct as written.
- Root element is `<PathOfBuilding2>`, as that document states.

One caveat that colours everything below: this build's `<Spec>` elements carry `treeVersion="0_2"` and its `<Build>` carries `targetVersion="0_1"`, while our data is a patch-0.5 extract (`public/data/tree/0.5.2/`, wiki dated 2026-08-25). **This is a cross-patch import, which is the normal case** — real shared builds are usually older than the current patch — but it means the hit rates below measure resilience to patch drift, not just format compatibility.

---

## Question 1: does `<Tree>` hold multiple `<Spec>` elements, and `<Skills>` multiple skill sets?

**Tree: YES — 8 `<Spec>` elements, each named and each with its own node list.** `<Tree activeSpec="8">` names the current one.

```
<Spec title="Nivel 31 - Empezamos con Balista" ascendClassId="2" classId="3" treeVersion="0_2" nodes="…"/>
```

| # | Title | Nodes |
|---|---|---|
| 1 | Nivel 31 - Empezamos con Balista | 39 |
| 2 | Nivel 37 - Acto 3 - 2a Ascendencia | 50 |
| 3 | Nivel 44 | 57 |
| 4 | Nivel 49 | 70 |
| 5 | Nivel 56 | 77 |
| 6 | Nivel 63 - 3a Ascendencia | 86 |
| 7 | Nivel 70 | 97 |
| 8 | Nivel 94 | 127 |

This is exactly the leveling-journey shape the gap analysis described from the rendered page, now confirmed in the data. **Slice 1's checkpoint model is validated against a real build**, and the level is recoverable from the title only by parsing free text — PoB has no numeric level field per spec.

**Skills and items: NO — one of each.** `<SkillSet id="1">` and `<ItemSet>` both appear exactly once, alongside 12 `<Item>` elements and 20 `<Gem>` elements.

**This is the finding that matters most for Slice 1.** PoB2's checkpoints are **tree-only**. Our `build_checkpoints` table stores `passive_state`, `gear_state` and `gem_state` per checkpoint, which is a superset — correct, and worth keeping, but an import will populate 8 distinct trees against 8 copies of the same gear and gems. The import report must say so, or a user will reasonably believe their gear varied per checkpoint and it was lost.

---

## Question 2: do `<Spec nodes>` ids match our `0.5.2` tree, and at what rate?

**99.50% — 600 of 603 allocations across all 8 specs.** Exactly **one** distinct node id is unknown to us: `15671`.

| Spec | Matched |
|---|---|
| 1–5 | 39/39, 50/50, 57/57, 70/70, 77/77 — **100%** |
| 6 | 85/86 — 98.8% |
| 7 | 96/97 — 99.0% |
| 8 | 126/127 — 99.2% |

**Gate result: passes the ≥95% threshold comfortably. Slice 2 imports the tree.**

Passive node ids are GGG's own and are stable across patches — a `0_2`-era build resolves against a `0.5.2` export almost perfectly. The single miss is a node that existed then and does not now (or was renumbered); `15671` appears first in spec 6 and persists through spec 8, consistent with one node being removed from the game between patches rather than a systematic offset.

**Implication:** unmatched node ids are rare but real, and must be reported per checkpoint rather than dropped silently. One missing node in a 127-node tree is a materially different build from the one the author shared.

---

## Question 3: what fraction of `<Gem>` entries resolve against `skill-index.json`?

**Exact name match: 8 of 20 — 40%.** With a tier-stripping pass: **12 of 20 — 60%.** Eight remain unresolvable by name at all.

This is the weakest link in the whole import, and it is worth being precise about why, because the first reading of it was wrong.

### It is not missing data. It is two separate naming mismatches.

**Mismatch A — our support gems are tiered by name; PoB's are not.** We store `Vitality I`, `Vitality II`, `Precision I`, `Precision II`, `Overabundance I/II/III`. PoB stores the untiered base name, `Vitality`. Stripping a trailing roman numeral recovers four of the twelve misses.

This also explains a claim in `CURRENT-STATE.md` that has been sitting there without an explanation: *"every sampled Support Gem caps at level 1 in our data."* It does, because **our support gems express progression as separate tiered records rather than as a level curve on one record.** That is why gap #4 gave supports no level field, and that decision still looks right — but the reason is now known rather than merely observed.

**Mismatch B — genuine renames across patches.** Eight gems have no counterpart under any name:

| PoB name | `gemId` | Closest thing we hold |
|---|---|---|
| Acceleration | `SupportGemAcceleration` | `Projectile Acceleration I/II/III` |
| Magnified Effect | `SupportGemMagnifiedEffect` | `Magnified Area I/II` |
| Martial Tempo | `SupportGemMartialTempo` | — (PoB's own `variantId` is `FasterAttackSupport`) |
| Primal Armament | `SupportGemPrimalArmament` | — |
| Cold Infusion | `SupportGemColdInfusion` | — |
| Fast Forward | `SupportGemFastForward` | — |
| Arcane Tempo | `SupportGemArcaneTempo` | — |
| Strip Away | `Metadata/Items/Gem/SupportGemStripAway` | — |

Note the last row: PoB's own data has `Gem` where every other entry says `Gems`. A typo in their dataset, and a reminder not to parse that path strictly.

### Correcting this plan's own earlier claim

The integration plan states that PoB2's XML "keys on display names". **That is incomplete.** Every `<Gem>` carries four identifiers:

```xml
<Gem nameSpec="Martial Tempo" gemId="Metadata/Items/Gems/SupportGemMartialTempo"
     skillId="SupportFasterAttackPlayer" variantId="FasterAttackSupport"
     level="1" quality="0" enabled="true" count="1"/>
```

So PoB carries the GGG metadata id after all. What does not change is the conclusion: **we still cannot join on it, because our own dataset carries no metadata id at any layer** (`@poe2-toolkit/gem-extractor`'s `Gem` interface exposes `name, kind, color, tags, description, req, icon, hoverImage` and no id). The join is still name-based, and name-based joining across a patch boundary lands at 60%.

**This raises the value of putting the metadata id into our extraction pipeline.** It would convert a 60% fuzzy match into an exact one and would also unblock GGG `.build` import, which the plan currently defers for exactly this reason. Worth scoping before Slice 2 rather than after — recorded here as a decision for the controller, not taken.

**Gate result: the import report is not optional.** At 60%, silently dropping unresolved gems would produce a build that looks complete and is not.

---

## Bonus finding: items confirm the plan's first correction, in detail

`<Item>` bodies are PoE clipboard text, exactly as the plan claims:

```
Rarity: UNIQUE
Blueflame Bracers
Goldcast Cuffs
Armour: 44
Energy Shield: 41
Variant: Pre 0.1.1
Variant: Current
Selected Variant: 2
Quality: 20
Sockets: S
Rune: Greater Body Rune
LevelReq: 33
Implicits: 1
{enchant}{rune}8% increased Attack Speed
{variant:2}+20 to maximum Energy Shield
{range:0.5}+(10-20) to Intelligence
{range:0.5}+(5-15)% to Fire Resistance
```

Three things this settles:

1. **Roll ranges live inside display strings** (`+(10-20) to Intelligence`), with the actual roll expressed as a *position* in that range by a sibling `<ModRange range="0.5" id="3"/>` — 0.5 of (10–20) is 15. Reading a real value back therefore needs the display text parsed first. This is `ModParser.lua`'s job and the plan's correction #1 stands, confirmed.
2. **Base item names are recoverable without parsing mods.** Line 2 is the unique's name, line 3 the base (`Blueflame Bracers` / `Goldcast Cuffs`); a non-unique has just the base. Our item index has 4,994 entries with zero duplicate names, so base-item import is the easy part.
3. **Variants, runes and enchants exist and we model none of them.** `Selected Variant: 2` on a unique changes its mods. Report them as dropped.

### Slot mapping is clean, with one gap

PoB's `<Slot name>` values map onto our 17 gear slots directly:

| PoB | Ours |
|---|---|
| `Weapon 1` / `Weapon 2` | `weapon1_main` / `weapon1_off` |
| `Weapon 1 Swap` / `Weapon 2 Swap` | `weapon2_main` / `weapon2_off` |
| `Helmet`, `Body Armour`, `Gloves`, `Boots`, `Belt`, `Amulet` | `head`, `body`, `gloves`, `boots`, `belt`, `amulet` |
| `Ring 1` / `Ring 2` | `ring1` / `ring2` |
| `Flask 1` / `Flask 2` | `flask1` / `flask2` |
| `Charm 1` / `Charm 2` / `Charm 3` | `charm1` / `charm2` / `charm3` |
| **`Ring 3`** | **no equivalent — we model two ring slots** |

`Ring 3` is present and empty in this build. `build-sharing-ecosystem.md` §3.2 flagged a third ring slot in GGG's own data as an unconfirmed live feature; it is confirmed present in PoB's slot model, still unconfirmed as a live game feature. An import that finds `Ring 3` occupied must report it rather than silently discard it.

`<Notes>` is present and carries 1,892 characters, which maps straight onto `builds.notes`.

---

## What this changes in the plan

| Plan claim | Verdict |
|---|---|
| Slice 1 checkpoints are validated by real builds | **Confirmed** — 8 named specs |
| Tree ids join directly | **Confirmed** — 99.5% across a patch boundary |
| Import is lossy for items and must report it | **Confirmed** — and also lossy for gems, variants, runes, enchants and `Ring 3` |
| PoB2 "keys on display names" | **Incomplete** — it carries `gemId`, `skillId` and `variantId` too; we just cannot use them |
| `mapCheckpoints` produces per-checkpoint gear and gems | **Wrong** — PoB checkpoints are tree-only. One `SkillSet`, one `ItemSet`, eight `Spec`s |

**New decision surfaced for the controller:** whether to pull GGG metadata ids through our `@poe2-toolkit` extraction before Slice 2. It would turn a 60% name join into an exact one and unblock GGG `.build` import. Not taken here.
