# Wiki Visual Redesign — Design

**Status:** Direction approved by Jaycee 2026-08-22, picked from two mocked-up options
([Wiki Redesign Directions](https://claude.ai/code/artifact/7a5c1a57-2899-457f-aa01-94fac900aca7)).

## Decision

The wiki currently looks like "a list of lists" — plain unstyled `<ul>`s, no visual hierarchy,
no sense of place. Two structural directions were mocked up against the app's real dark-gold
tokens (Cinzel headings, oklch charcoal/gold palette, the dashboard's Card hover-glow pattern):
**A — Tooltip Codex** (item cards styled like the in-game tooltip itself, rarity-colored border,
centered icon) and **B — Grimoire Ledger** (reference-book structure: category sidebar, dense
list, infobox stat panel).

**Picked: hybrid.** Browse pages use B's structure (sidebar + dense list). Detail pages use B's
two-column layout (content left, sticky infobox right) reskinned with A's visual language
(colored-border tooltip treatment on the icon/header, gold divider).

## Scope

All three wiki kinds (items, skills, mods) — browse and detail pages for each. Six routes total:
`/wiki/{items,skills,mods}` and `/wiki/{items,skills,mods}/[slug]`.

## Browse pages: category sidebar + dense list

- New client component, category-filter sidebar: groups the already-fetched
  `WikiSearchEntry[]` (from `fetchWikiIndex`, unchanged) by `category`, with a count per group
  and an "All" option. Selecting a category filters the visible list; combines with the existing
  Fuse text search (AND, not OR).
- **`filterEntries` in `WikiSearch.tsx` is not modified.** Its tested contract
  (`filterEntries(entries, query, fuse)`) stays exactly as-is. Category filtering happens as a
  plain array `.filter()` on `category` *before* entries reach `filterEntries` — additive
  composition, not a signature change. `WikiSearch.test.ts` needs no changes.
- List rows: name, category/kind-appropriate subtitle, tag chips — **no icons in the row list**.
  This isn't an oversight: `2026-08-16-wiki-design.md` §5 deliberately kept the search index icon-free
  ("Icons render on detail pages only... avoids turning a 100-row filtered browse result into 100
  image requests"), and `WikiSearchEntry` doesn't carry an `iconUrl` field. Adding icons to every
  row would mean adding a URL to every one of ~22,000 index entries, undoing that tradeoff. The
  mockup's icon-per-row was drawn against a small illustrative set, not against the real cost —
  flagging the deviation rather than silently reproducing it. Icons stay detail-page-only.
- Sidebar is scoped to the *current* kind's categories (Items page → item categories only).
  Cross-kind universal search is explicitly a separate, later feature — not built here.

## Detail pages: A's tooltip styling + B's two-column layout

- Left column: name/header, functional text (description/flavour/scaling — whatever the kind
  has), in reading order.
- Right column: sticky infobox card — gold header bar, stat rows, styled like B's infobox.
- Icon/header block styled per A: bordered box around the icon, colored border matching a
  **per-kind accent**, gold ornament divider (`/ornaments/divider.png`) under the title.

### Accent color per kind

- **Items**: `rarity` field. `normal` → neutral border token; `unique` → a new warm-amber accent
  (`oklch(0.68 0.13 55)`, distinct from the brand gold `--primary` so "this specific item is
  unique-rarity" reads as a different signal than "this is Project Vaal chrome"). This is the
  game's own rarity-color convention (universal ARPG UI language, not any specific wiki's
  copyrighted CSS) filtered through Project Vaal's own palette.
- **Skills**: `color` field (`r`/`g`/`b`/`w` — already a real per-gem attribute, PoE's own
  strength/dexterity/intelligence/universal gem-color convention). Maps directly to an accent
  color per skill — no new data needed, this was sitting unused in `WikiSkillDetail` already.
- **Mods**: no natural per-entry color axis in the data (no rarity, no gem color). Uses the
  brand gold `--primary` as a flat, consistent accent — not a compromise, mods genuinely don't
  have the concept.

### Infobox contents per kind

- **Items**: Item class, Rarity, Stack size (`> 1` only, existing threshold), Drop level,
  Requirements (str/dex/int, `> 0` only), Armour or Weapon stats if present.
- **Skills**: Gem type, Color, Requirement (level/str/dex/int), Tags.
- **Mods**: Domain, Generation type, Tier, Item level, Families.

## New shared components

- `CategorySidebar` — client component, entries + basePath + kind-appropriate label in, selected
  category + filtered-count out (or manages its own filter state alongside a query prop —
  exact composition is an implementation-time call, not fixed here).
- `DetailInfoPanel` — the infobox chrome (gold header bar + stat-row list), parameterized by
  `title`, `accentColor`, `rows: {label, value}[]`. Row *content* stays bespoke per page (the
  three kinds' stat sets don't share a shape worth forcing into one schema) — only the visual
  chrome is shared.
- `RarityIconBox` — the bordered icon container from A's mockup, parameterized by `accentColor`
  and `iconUrl`, shared across all three detail pages.

## Non-goals (this spec)

- Universal cross-kind search — separate future feature, explicitly deferred.
- Sourcing more unique-item mod data — separate future feature, explicitly deferred.
- Icons in browse-list rows — architecture tradeoff, not pursued (see above).
