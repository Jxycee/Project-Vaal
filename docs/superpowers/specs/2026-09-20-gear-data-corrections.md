# Gear Data Corrections — Appendix B amendment

**Date:** 2026-09-20
**Amends:** `docs/superpowers/specs/2026-09-16-build-planner-design.md`, Appendix B and its "Two traps" note.
**Source:** `public/data/wiki/2026-08-25/item-index.json` as it stands on disk today (the file was refreshed 2026-09-18; the spec was written against the 2026-09-16 copy).

Read this **with** Appendix B, not instead of it. Appendix B's flask/charm traps are still correct and still matter. What follows is what changed and what it got wrong.

---

## 1. The index grew

| Spec claim | Reality today |
|---|---|
| 4,975 entries | **4,994** |
| 89 distinct categories | **90** |

Not a problem in itself — the wiki data was resynced on 2026-09-18. It is the reason the two corrections below exist, and the reason no count in Appendix B should be treated as load-bearing.

## 2. `Focii` is the unique spelling of `Focus`, not a dead category

Appendix B says:

> `Focii` appears in `ITEM_CATEGORY_GROUPS` but is absent from live data (0 entries). Filter on `Focus` (51 entries).

That is now wrong, and following it hides items:

```
Focus:  51 entries,  0 unique
Focii:   8 entries,  8 unique   ← "Deathrattle", "Threaded Light", "Carrion Call", "Serpent's Lesson", …
```

This is **the same trap Appendix B already documents for flasks**, in a category it declared safe: bases live under one spelling, uniques under another. Filtering the off-hand slot on `Focus` alone offers 51 bases and silently hides every unique focus in the game.

**Off-hand slots must filter `Shield`, `Buckler`, `Focus`, `Focii`, `Quiver`.**

The general lesson, now seen three times in this dataset (`LifeFlask`/`Life Flask`, `ManaFlask`/`Mana Flask`, `Focus`/`Focii`): **never assume one category string covers both bases and uniques.** Check the unique split for every category a slot maps to. The check is one line:

```
node -e "const a=require('./public/data/wiki/2026-08-25/item-index.json');const m=a.filter(e=>e.category==='X');console.log(m.length,m.filter(e=>e.isUniqueItem).length)"
```

A category whose unique count is `0` almost certainly has a sibling spelling holding its uniques.

## 3. `Talisman` is a weapon class and is missing from the mapping entirely

```
Talisman: 37 entries, 6 unique
```

This is not amulet-adjacent, which is the natural guess from the name. **Talisman is the Druid's weapon class**, added in patch 0.4.0 "The Last of the Druids" — confirmed in `docs/research/poe2/classes-and-ascendancies.md:23` and `:121`. Two-handed "Animal Talismans" unlock a shapeshift form (Bear / Wolf / Wyvern); in human form talismans cast nature spells.

Appendix B's `weapon*_main` list has 17 categories and **`Talisman` is not one of them**. As written, a Druid build has zero selectable weapons. Since the spec's own ground-truth table counts Druid among the 8 classes, this would ship as a visibly broken slot for one eighth of the class roster.

**`weapon*_main` must include `Talisman`.**

Note that all 37 live under the single `Talisman` category — there is no separate "Animal Talisman" or "Two Hand Talisman" category to add. One- versus two-handed is a property of the individual item, not the category.

## 4. Corrected Appendix B mapping

Changes from the original are marked. Everything unmarked is unchanged and was re-verified today.

| Slot | Categories | Entries offered |
|---|---|---|
| head | `Helmet` | 310 |
| body | `Body Armour` | 421 |
| gloves | `Gloves` | 239 |
| boots | `Boots` | 216 |
| amulet | `Amulet` | 49 |
| ring1, ring2 | `Ring` | 66 |
| belt | `Belt` | 38 |
| weapon1_main, weapon2_main | `One Hand Sword`, `Two Hand Sword`, `One Hand Axe`, `Two Hand Axe`, `One Hand Mace`, `Two Hand Mace`, `Mace`, `Bow`, `Crossbow`, `Claw`, `Dagger`, `Flail`, `Spear`, `Sceptre`, `Wand`, `Staff`, `Warstaff`, **`Talisman` (added)** | 478 |
| weapon1_off, weapon2_off | `Shield`, `Buckler`, `Focus`, **`Focii` (added)**, `Quiver` | 302 |
| flask1 (Life) | `LifeFlask`, `Life Flask` | 12 |
| flask2 (Mana) | `ManaFlask`, `Mana Flask` | 12 |
| charm1–3 | `Charm`, `UtilityFlask` | 25 |

`FishingRod` (1 entry) is deliberately excluded — it is a joke item with no build relevance. Recorded so nobody rediscovers it as a "missing weapon category".

## 5. Open question for the human — jewels have no home

`Jewel` has **22 entries (13 unique)**, including "Timeless Jewel", "Ruby", "Emerald", "Sapphire".

PoE2 sockets jewels into the **passive tree**, not into gear. The spec's 17 gear slots therefore correctly exclude them — but the spec does not mention jewels anywhere else either, so they are currently unplanned rather than deliberately deferred. The tree's own jewel sockets are not modelled in `passive_state`.

This is a **scope question, not a mapping bug**. Flagging it rather than deciding it: adding jewel sockets means extending `passive_state`'s shape, which is a schema-adjacent decision. Leaving them out means a saved build cannot express a real part of a real character.

## 6. Re-verified as still correct

Every one of these was checked today and matches the spec:

- Flask spellings and counts: `LifeFlask` 9 / `Life Flask` 3 / `ManaFlask` 9 / `Mana Flask` 3, base-versus-unique exactly as described.
- `UtilityFlask` has 13 entries and they are **charms** ("Thawing Charm", "Staunching Charm", "Antidote Charm"), not flasks. `Charm` has 12, all unique. Charm slots need both.
- All 17 original weapon categories exist with non-zero counts.
- `Shield`, `Buckler`, `Focus`, `Quiver` all exist with non-zero counts.
- `Helmet`, `Body Armour`, `Gloves`, `Boots`, `Amulet`, `Ring`, `Belt` all exist with non-zero counts.
- `WikiSearchEntry` carries **no icon field** — icons still require `fetchWikiCardSnippet` at pick time.
- Skill-index `category` values are exactly `Active Skill Gem`, `Support Gem`, `Spirit Gem`, `Unused / Removed`.
