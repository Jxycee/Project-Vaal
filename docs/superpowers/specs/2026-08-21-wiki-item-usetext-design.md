# Wiki Item Use-Text + Stack Size — Design

**Status:** Approved by Jaycee 2026-08-21.

## Background

The wiki's item detail page ([src/app/wiki/items/[slug]/page.tsx](../../../src/app/wiki/items/[slug]/page.tsx)) currently
renders name, category, requirements, armour/weapon stats, and (uniques-only) flavour text. Clicking through to a
currency item like Blacksmith's Whetstone shows almost nothing — no explanation of what it does, no stack size.

Root cause: `@poe2-toolkit/item-extractor`'s `Item` type
(`node_modules/@poe2-toolkit/item-extractor/dist/buildItems.d.ts`) has no field for this. It only carries
`flavourText`, and that's explicitly unique-only lore text sourced from `FlavourText`/`Words`, not a functional
description. Confirmed by reading the shipped `.d.ts` directly — there is no `description` or `stackSize` field
on `Item` anywhere.

Audited all 4,975 synced items by category (`public/data/wiki/2026-08-21/items/*.json`): every gear category
(Body Armour, Helmet, weapons, jewellery, ...) already gets `flavourText` on its unique variants and correctly
has none on normal-rarity bases — gear doesn't need functional text, its behavior comes from mods (a known,
already-documented separate limitation — unique mod values aren't derivable from this pipeline at all, see
[2026-08-16-wiki-design.md](2026-08-16-wiki-design.md)'s "Known limitation"). The real gap is the
non-equippable, "used"-item categories: StackableCurrency (437), SoulCore (295), QuestItem (295),
MapFragment (132), Omen (50), Focus, Incubator, Breachstone, VaultKey, flasks, and others — none of these carry
any text today.

Pulled the real PoE2 dat schema (`poe-tool-dev/dat-schema`, `schema.min.json`, `validFor: 2` table set — PoE2, not
PoE1) to check what's actually available at the source. `BaseItemTypes` itself has no `Description`/`StackSize`
column (confirms why a generic item-extractor wouldn't expose it). But a separate `CurrencyItems` table exists,
joined to `BaseItemTypes` via a `BaseItemType` foreign-row column, with:

- `StackSize` (`i32`) — max stack size
- `Description` (`string`) — the exact use-text ("Improves the quality of a martial weapon")
- `Directions` (`string`) — right-click/left-click usage instructions ("Right click this item then left click
  a martial weapon to apply it.")
- `Action` (`string`) — short verb label

**Verified against a real poe2wiki.net item page (Blacksmith's Whetstone, user-supplied screenshot, 2026-08-21):**
the in-game tooltip shows both `Description` and `Directions` as separate lines (blue "Improves the quality of a
martial weapon" + italic "Right click this item then left click a martial weapon to apply it."), plus
`Stack Size: 20` and `Drop Level: 5` — all four map directly onto `CurrencyItems.Description`,
`CurrencyItems.Directions`, `CurrencyItems.StackSize`, and the wiki's existing `dropLevel` field (already synced,
just not rendered on our detail page today — a one-line addition alongside this work). The screenshot's
"Item acquisition" prose ("Obtained by salvaging martial weapons with quality") and "Metadata ID" are poe2wiki-only
enrichment with no `CurrencyItems` equivalent — out of scope, Phase 3 territory if ever pursued.

Same join shape (`BaseItemType` foreign row → `BaseItemTypes` row index) that `@poe2-toolkit/item-extractor`'s own
`buildItems.js` already uses internally for `AttributeRequirements`, `ArmourTypes`, `WeaponTypes`, `ItemSpirit` —
a proven, low-risk pattern to replicate.

This has not yet been verified against **live** decoded data (schema-level column existence only — real row
population and which item categories it actually covers requires running the sync against the CDN). That
verification is Phase 2 below, not assumed here.

## Goal

Give currency-shaped items (and whatever else `CurrencyItems` actually covers once synced for real) their
use-text description, usage directions, and stack size on their wiki detail page, sourced from the same GGPK
pipeline as everything else — no new data source, no licensing change, for this phase.

## Non-goals (this spec)

- Gear/equipment item descriptions — not needed; mods will cover that in a future milestone (existing known
  limitation, unchanged).
- Unique item mod values — existing, separately-tracked limitation, unrelated to this work.
- Any poe2wiki.net integration — deferred to Phase 3, conditional, and out of scope for this spec's
  implementation plan. If Phase 2's audit shows it's needed, that becomes its own follow-up spec (licensing,
  attribution, and scraping-etiquette implications are substantial enough to deserve its own design pass, not a
  bolt-on to this one).

## Phase 1 — GGPK-direct `CurrencyItems` extraction (this implementation)

### 1. Sync pipeline (`scripts/sync-wiki.ts` + its `pathofexile-dat` config)

- Add a `CurrencyItems` table entry to the `pathofexile-dat` decode config (same file/pattern the recon doc
  captured for the existing table list — `scripts/wiki/pathofexile-dat.config.json` per the M1 design), columns:
  `BaseItemType`, `StackSize`, `Description`, `Directions`.
- This is **not** read through `@poe2-toolkit/item-extractor` — that package doesn't expose it and isn't ours to
  patch. Read the decoded `CurrencyItems.json` table directly in `scripts/sync-wiki.ts`, alongside the existing
  `extractItems(source)` call, and build a lookup keyed the same way `item-extractor` itself joins
  `BaseItemType`-keyed side tables (row index → `BaseItemTypes` row), so a currency item's normalized record can
  look up its own `CurrencyItems` row by the same key `item-extractor` already resolves internally.
- If `item-extractor`'s `Item` doesn't expose the row index/join key needed to line this up post-extraction,
  the fallback is to read `BaseItemTypes` ourselves (already partially done via the existing `tablesDir` decode)
  purely to get the row-index↔`Id` mapping needed to join `CurrencyItems`, without duplicating anything
  `item-extractor` already computes. Exact mechanics are an implementation-time detail — the plan should include
  a spike step to confirm the cleanest join point before committing to one, since this touches the boundary
  between "our code" and "the vendored extractor's internals."

### 2. Types (`src/lib/wiki/types.ts`)

Add three fields to `WikiItemDetail`:

```ts
export interface WikiItemDetail extends WikiDetailBase {
  // ...existing fields...
  description: string | null;   // CurrencyItems.Description — use-text, e.g. "Improves the quality of a martial weapon"
  directions: string | null;    // CurrencyItems.Directions — usage instructions, e.g. "Right click this item then left click a martial weapon to apply it."
  stackSize: number | null;     // CurrencyItems.StackSize — max stack size; null for non-stackable/non-currency items
}
```

All three default to `null` for items with no `CurrencyItems` row (i.e. most gear).

### 3. Normalization (`src/lib/wiki/normalize.ts`)

`normalizeItem` gains a new parameter carrying the joined `CurrencyItems` row (or `null` when the item has none),
mirroring how `armour`/`weapon` are already optional per-item joins. Both new fields default to `null` for
non-currency items — most gear will simply never populate them, same as `armour`/`weapon` today.

### 4. Rendering (`src/app/wiki/items/[slug]/page.tsx`)

Add a description block, positioned above the existing flavour-text block (functional text before flavor,
matching in-game tooltip ordering, and matching the reference screenshot's layout) — `item.description` rendered
first, `item.directions` immediately below it in a lighter/italic style (mirrors the in-game tooltip's own
blue-then-italic convention), both only when non-null. Add a stack-size line alongside the existing requirements
list when `item.stackSize` is non-null and greater than 1 (a stack size of 1 isn't worth displaying — it's the
default for non-stackable items generically returned as `1` or `0` depending on how unpopulated rows decode, to
be confirmed empirically in Phase 2).

Also render the existing `dropLevel` field (already synced onto every item, never displayed) as a "Drop Level: N"
line — noticed missing from the current page while comparing against the reference screenshot's "Drop Level: 5".
Small, free addition alongside this work, not gated on `CurrencyItems` at all since every item already carries it.

### 5. Testing

- `normalize.test.ts` (or wherever `normalizeItem` is currently tested): new cases for an item with a
  `CurrencyItems` row (both fields populated) and one without (both `null`).
- `types.test.ts`: extend the `WikiItemDetail` shape check.
- No new DOM-rendering test coverage — same documented gap as the rest of the wiki UI (no `jsdom`/RTL in this
  repo yet, per the wiki-data-gating handoff).

## Phase 2 — Real-data audit (gate before Phase 3)

After Phase 1 lands and a real sync runs (weekly cron or manual `workflow_dispatch`), re-run the category-coverage
audit (`category / count / has-description` breakdown, same shape as the one done during this design's research)
against the new data. Report back: which categories `CurrencyItems` actually populated, and what's still empty.
This determines whether Phase 3 is even needed, and for which categories specifically — not "add poe2wiki for
everything," only for the confirmed residual gap.

## Phase 3 — poe2wiki.net fallback (conditional, separate spec if triggered)

Not implemented as part of this spec. If Phase 2 shows a real residual gap worth closing, that's its own
brainstorming pass — it reopens decision D4 from
[2026-08-16-wiki-design.md](2026-08-16-wiki-design.md#decision-gate-resolutions-d1-d5) ("moot, no CC BY-NC-SA
content in the pipeline"), which stops being true the moment any poe2wiki content ships. Minimum bar already
named in that doc: no bot-detection bypass, respect `robots.txt`, and a real attribution/license entry in
`THIRD-PARTY-NOTICES.md` (or a new `LICENSE.md` section) for CC BY-NC-SA content specifically, scoped only to the
fields actually sourced from there.

## Risks / open items

- **Join mechanics unconfirmed against live data.** Schema-level column existence is confirmed; the actual join
  key format (row index vs. some other identifier) as it flows through `pathofexile-dat`'s JSON output hasn't
  been tested against a real decode. Flagged in Phase 1 §1 as needing a short spike before the join code is
  final.
- **Category coverage unknown until Phase 2.** `CurrencyItems` almost certainly covers StackableCurrency and
  probably Omen/Incubator/DelveSocketableCurrency; QuestItem/MapFragment/Jewel are guesses, not confirmed.
- **`StackSize` semantics for non-currency items.** Whether an unpopulated row decodes to `0`, `null`, or is
  simply absent from the table needs confirming against real data before the ">1" display threshold in Phase 1
  §4 is treated as final.
