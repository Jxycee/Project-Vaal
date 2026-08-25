# Wiki Community-Sourced Explanations — Design

**Status:** Approved by Jaycee 2026-08-22.

## Background

Clicking through items/mods/effects turned up two different kinds of "unexplained" gaps:

1. **Tiered-item mention mismatches** (fixed as part of this same pass, not this spec's subject) —
   text says "Jeweller's Orbs" generically, but only Lesser/Greater/Perfect/Tainted variants exist as
   real entries. Fixed via a mention-index fallback that links a generic/plural mention to a pre-filled
   search on the kind's browse page instead of guessing a tier. See `src/lib/wiki/mentions.ts`
   (`familyBaseName`, `resolveMentionTarget`) and `WikiSearch`'s new `initialQuery` prop / `?q=`.

2. **Content genuinely absent from GGPK.** Concrete example: the mod "of Corruption"
   (`mapeclipseitemsdropcorrupted`) has exactly one `stats` line — "Atziri's Influence" — no numbers, no
   description, nothing. Checked `BuffDefinitions` directly: no row for it at all. This is what this spec
   covers.

## Research (this session)

- **poe2wiki.net is disqualified, not just deferred.** Its `robots.txt` explicitly disallows `ClaudeBot`
  (plus GPTBot, Google-Extended, Amazonbot, Bytespider, CCBot, CloudflareBrowserRenderingCrawler,
  meta-externalagent, Applebot-Extended) from the entire site, and a live fetch was independently
  rejected by an Anubis bot-challenge. This is the site explicitly telling AI agents not to access it —
  our own committed bar ("respect robots.txt", [2026-08-16-wiki-design.md](2026-08-16-wiki-design.md)'s
  D4) makes this a hard no, not a judgment call. Its content is also CC BY-NC-SA 3.0 and explicitly
  states it's largely extended from the original PoE1 community wiki, not directly GGPK-derived.
- **poedb.tw is the only remaining candidate.** `robots.txt` is fully permissive (`Allow: /`, no bot
  blocks). Its own disclaimer states CC BY-NC-SA 3.0 licensing.
- **Project Vaal is non-commercial** (confirmed with Jaycee) — CC BY-NC-SA content is legally usable
  with attribution.
- **Spot-checked poedb.tw for the "Atziri's Influence" example — it has nothing either**, and neither
  does a direct guess at a page URL for two sibling mods in the same family ("Transmogrification",
  "Living Weapons"). This is a strong signal these specific mods are dead/orphaned game data (defined in
  the `Mods` table but never live), not a sourcing gap at all — no amount of external searching will fix
  them. They stay unexplained; that's the correct, honest state for content nobody — not GGG's own data,
  not the best community database — actually has.
- **Open risk, not resolved here:** poedb.tw's homepage was showing "0.5.5 / Runes of Aldur" league
  content, a different versioning scheme than our own `WIKI_PATCH_VERSION` (`4.5.4.10.2`, the
  `pathofexile-dat`/`@poe2-toolkit` internal build number). Before trusting *any* pulled poedb.tw text
  as currently accurate, whoever adds an override entry needs to sanity-check it's describing the same
  live mechanic our own sync is pulling, not stale/superseded content from an earlier patch. Flagged
  here rather than silently assumed away.

## Decision: curated overlay, not an automated scraper

Two approaches were considered:

- **Automated scraper in `sync-wiki.ts`** — fetches poedb.tw on every sync run for flagged gaps, parses
  description text out of the HTML. Rejected: HTML-scraping is fragile (silently breaks on redesigns),
  puts recurring load on poedb.tw's servers every sync (not a one-time pull), has no human review (would
  ingest wrong or vandalized content unreviewed), and entangles the data model with per-field license
  provenance tracking at scale.
- **Curated overlay file (chosen).** A human (starting with me, this session) checks poedb.tw for one
  specific gap at a time, and only when real, currently-accurate content is confirmed there, hand-enters
  it into `scripts/wiki/poedb-overrides.json`. No scraping infrastructure, no recurring request load, no
  bot-etiquette question at all since nothing runs unattended. Every field is a verified match. Trade-off:
  grows only as fast as someone reviews entries — acceptable given the "Atziri's Influence" spot-check
  above suggests the real fillable gap is much smaller than the raw list of orphan mentions.

## Implementation

- **`WikiCommunitySource`** (`src/lib/wiki/types.ts`): `{ text: string; sourceUrl: string }`. Added as an
  optional `communitySource?: WikiCommunitySource | null` on the shared `WikiDetailBase`, so it's
  available on all four kinds uniformly. Absent/`null` for the overwhelming majority of entries.
- **`scripts/wiki/poedb-overrides.json`**: `{ item: {}, skill: {}, mod: {}, effect: {} }`, keyed by kind
  then by the entry's own slug. Shipped empty this session — see "What's actually populated" below.
- **`scripts/sync-wiki.ts`**: `loadCommunitySourceOverrides()` reads the file (empty object if missing);
  `applyCommunitySource(kind, details, overrides)` attaches a matching override by slug, returning the
  original array unchanged (not even a copy) when a kind has no overrides — a normal sync with an empty
  overrides file costs nothing extra. Wired into `writeKind`, so every kind picks it up automatically.
- **`src/components/wiki/CommunitySourceNote.tsx`**: renders the note visually distinct from
  GGG-sourced content (dashed border, muted background) with an explicit "Not in the game's own data —
  community-sourced from poedb.tw (CC BY-NC-SA 3.0)" line and a link to `sourceUrl`. Never rendered as if
  it were an official tooltip line.
- Wired into the item, mod, and effect detail pages (`src/app/wiki/{items,mods,effects}/[slug]/page.tsx`),
  gated on `detail.communitySource` being present.
- **`THIRD-PARTY-NOTICES.md`**: new poedb.tw section — CC BY-NC-SA 3.0, explicitly scoped to only the
  `communitySource` fields, not the rest of the (MIT) wiki data.

## What's actually populated (this session)

**Nothing.** `poedb-overrides.json` ships as an empty scaffold. The two concrete candidates checked this
session ("Atziri's Influence", "Transmogrification"/"Living Weapons") turned out to have no real poedb.tw
content to pull — see Research above. Populating this file for real is an ongoing manual-curation task,
one verified entry at a time, whenever a genuinely-unexplained gap turns out to actually have a poedb.tw
page behind it. Building the pipeline now means the next verified find is a one-line JSON addition, not
a design discussion.

## Non-goals

- Bulk/automated content ingestion of any kind (see "Decision" above).
- poe2wiki.net in any capacity (see "Research" above — this is closed, not deferred).
- Re-litigating Phase 1/2 of [2026-08-21-wiki-item-usetext-design.md](2026-08-21-wiki-item-usetext-design.md)
  (GGPK-direct `CurrencyItems` use-text) — already shipped, unrelated mechanism (that's GGG's own data,
  this is a third-party fallback for when GGG's data has nothing at all).
