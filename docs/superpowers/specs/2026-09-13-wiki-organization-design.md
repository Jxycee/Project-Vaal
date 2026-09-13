# Wiki Reorganization — Design

**Status:** Direction approved by Jaycee 2026-09-13, after a research pass across OSRS Wiki,
Maxroll's PoE2 hub, poe2db.tw, and the community PoE2 Fandom wiki.

## Context

This is an information-architecture pass, not a visual one — the wiki already went through a
visual redesign earlier (`2026-08-22-wiki-visual-redesign-design.md`) and keeps its look
unchanged here. Scope, per Jaycee: "functionality should remain identical outside of if we have
to redo a system." Two systems get redone (filter state, tag exposure); nothing else changes.

## Research findings

- **OSRS Wiki** (best-in-class reference): mobile drops its entire desktop sidebar category tree
  and relies on search + a few big homepage entry tiles instead. This validates something we
  already do — `/wiki`'s home page (5 category tiles + universal search) is already the right
  mobile pattern, not a gap to fix.
- **Maxroll's PoE2 hub**: desktop mega-menu groups related concepts into labeled, color-accented
  columns (Classes & Ascendancies / Campaign / Atlas / Mechanics / …) rather than one flat list —
  confirms grouping-related-things-under-a-label is the right instinct where a kind has enough
  real variety to warrant it (this is exactly what `categoryTaxonomy.ts` already does for Items).
- **poe2db.tw** (closest structured-data analog to our own wiki): splits fundamentally different
  content *kinds* at the top nav level (Items vs. Gems as separate menus) rather than one pile —
  we already do this (Items/Skills/Mods/Effects/Maps are separate top-level sections). But its
  actual category lists are dense, dot-separated inline text links — confirmed painful to tap on
  a real mobile viewport during testing (no discrete touch targets, no visual hierarchy). This is
  the negative pattern to keep avoiding: every category/tag stays a discrete pill/chip with a
  real touch target, never an inline link-wall.
- **PoE2 community Fandom wiki**: too sparse (37 pages) to inform organization at scale, but its
  homepage category-button pattern is the same shape we already use.

## Current state (audited)

Two-tier data: a slim `WikiSearchEntry` (`slug, name, kind, category, tags[]`) ships per kind for
browsing (`{kind}-index.json`); full detail is fetched per-slug on demand. Scale (2026-08-25 data):

| Kind | Entries | Categories |
|---|---|---|
| Items | 4,975 | 89 (grouped into 10 sections via `categoryTaxonomy.ts`) |
| Mods | 5,266 | 9 (flat — already a manageable pill row) |
| Skills | 1,118 | 4 (flat) |
| Effects | 1,225 | 1 (always literal `"Effect"` — no real categorization at all) |
| Maps | 160 | 1 (always literal `"Map"`) |

`WikiBrowse.tsx` already has full tag-filtering *logic* — `selectedTag` state, a
`handleSelectTag` toggle, and `visibleEntries` AND-combines category + tag — but it's only
reachable through a hand-curated `quickFilters` prop that just two pages pass (Items and
Effects get a small hand-picked set of tag chips; Skills/Mods/Maps get none at all). Filter state
(category, tag, search query, scroll position) lives entirely in `sessionStorage`, keyed per kind,
added specifically to survive a detail-page visit + Back without resetting — not in the URL, so a
filtered view can't be bookmarked, shared, or linked to from an ascendancy mention.

## Decision

### 1. Generalize tag exposure into a dynamic facet row (supersedes the "extend taxonomy to
   Effects" idea floated earlier in this conversation)

Replace the hand-curated `quickFilters` prop with a **dynamic tag-facet row**: for the entries
currently visible (after the category filter, if any), compute tag→count the same way
`groupByCategory` already counts categories, drop tags that are noise (near-universal or
singleton — same judgment call that already removed the "default" tag showing on 91% of items),
and render the rest as pill chips above the search box, on **all five kinds**, not just two.

This one mechanism replaces two separate ideas from earlier in the conversation (a hand-curated
quick-filter row, and a proposed second taxonomy-grouping system for Effects) because it solves
both: Effects' "1,225 entries in one undifferentiated bucket" problem is exactly what a tag facet
fixes (its existing tags — Buff/Debuff/Curse/Charge/Shrine/Charm/Immunity, plus the Ailment/Aura
name-shape heuristics — become clickable filters), without inventing a parallel grouping system
that would sit alongside category filtering and mean two different "narrow this down" UIs on one
page. Mods (9 flat categories, already a fine pill row on its own) gets the facet row too, at no
extra design cost, as a bonus rather than a requirement.

**Stays as today:** single-select tag (click again to clear — matches existing `handleSelectTag`
toggle), AND-combined with category, chip styling and the existing `attributeTagColor` convention
(falls back to a neutral tint for tags with no attribute meaning, which is most of them). **Items
keeps its existing `categoryTaxonomy.ts` grouping unchanged** — that system already works and
isn't part of this change.

### 2. URL-addressable filter state (the "redo a system" part)

Move `category`/`tag`/`query` from `sessionStorage`-only into real URL query params
(`?category=…&tag=…&q=…`), synced via Next's router. This is the single most consistent pattern
across every reference wiki checked — filtered views are shareable, bookmarkable, and survive
navigation without a bespoke storage workaround. Search-query updates shallow-replace (no history
entry per keystroke, matching the mention-link `?q=` convention already in place); category/tag
selection can push a history entry the way a normal link click would.

**Stays as today:** scroll-position restoration — a separate concern (not shareable, not
meaningful to bookmark) that already works via `sessionStorage` and isn't part of this change.
The existing mention-link `?q=` priority-over-stored-view behavior carries forward unchanged,
now just reading from the same URL-state mechanism instead of a one-off query param.

### 3. Mobile-first, throughout

Every category pill, taxonomy-section header, and new tag-facet chip keeps a real tap target
(44px+) and lives in a horizontally-scrollable row using the `.themed-scrollbar` utility already
shipped for Prices — never poe2db's inline link-wall. No change to the home page's tile-first
entry pattern; research confirms it's already the right mobile pattern.

## Non-goals (this spec)

- Any visual restyle — the existing wiki visual design (accent-bordered tooltip cards, per-kind
  colors) is unchanged.
- Cross-kind tag browsing (e.g. "everything tagged Fire across Items+Skills+Mods+Effects") — a
  genuinely new capability, not a reorganization of what exists; explicitly out of scope per
  "functionality should remain identical."
- Multi-select tags (AND/OR combinations of several tags at once) — today's single-select toggle
  is preserved as-is; the facet row just becomes dynamic and universal, not more powerful.
- A shared `DetailInfoPanel` component across the 5 detail pages (spec'd once, never built) —
  real technical debt, but a code-structure concern, not an organization-of-content concern this
  pass is scoped to.

## Implementation note

The mod detail-page code comments citing "~16,679 mods" are stale (the actual synced count is
5,266) — not a design decision, just a one-line drive-by fix during implementation since it's
directly adjacent to the mods work in this pass.
