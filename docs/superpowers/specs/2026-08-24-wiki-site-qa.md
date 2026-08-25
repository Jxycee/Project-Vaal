# Wiki Site QA — Our-Own-Bugs Pass

**Status:** In progress. All fixes below are verified live and covered by tests. Two questions are
open (see "Open questions" — need Jaycee's call before acting). The effects-taxonomy question is
deliberately deferred to the `/design` reformatting pass that follows this doc, not decided here.

## Why this doc exists

After the GGPK source-scrubbing pass (`2026-08-22-wiki-ggpk-source-audit.md`), Jaycee asked for a
separate pass: engage with the site as a user and find *our own* bugs, distinct from data-source
gaps. This is that pass's findings and fixes.

## Fixed (objective bugs, not preferential — done without asking)

1. **"default" tag chip showed on 91% of items** (4,535/4,975 in a live decode) with zero
   information value — GGPK's own catch-all/base-variant tag, not a real distinguishing category.
   Filtered out in `toSearchEntry` (normalize.ts). 0 skills carried it, so the filter is a no-op
   there.
2. **Raw, unhumanized category/tag identifiers shown verbatim** everywhere they appear —
   `StackableCurrency` instead of "Stackable Currency", `quality_currency` instead of "quality
   currency". Added `src/lib/wiki/humanizeCategory.ts` (PascalCase/snake_case → spaced words, no-op
   on anything already readable) and wired it into: `CategorySidebar.tsx` (both the flat and
   sectioned category-pill branches), `WikiSearch.tsx` (each row's category subtitle and tag
   chips), the item detail page's subtitle fallback, and the skill detail page's tag list.
   - **Regression caught live, not by tests**: the general PascalCase splitter turned "AoE" (Area
     of Effect - a real, common skill tag) into "Ao E", since the lowercase "o" isn't a real word
     boundary. Checked the whole live dataset for other tags/categories shaped this way - "AoE" is
     the *only* one - fixed with a short explicit exception list rather than a smarter heuristic.
3. **Deprecated/unused/removed content was mixed into normal categories** with no way to tell it
   apart from real content while browsing - `[DNT-UNUSED]`/`[DNT]`-prefixed entries and an exact
   "Removed Skill" name (GGG's own internal dev/QA markers) sat inside their nominal category
   ("Axe Chop" next to real skill gems), and for items specifically, four `_OLD`-suffixed legacy
   item classes (`PinnacleKey_OLD`, `UncutSkillGem_OLD`, `UncutReservationGem_OLD`,
   `UncutSupportGem_OLD`) did the same. **Per Jaycee's direction** ("add them to their own separate
   category... allow players to see 'history'"), these now get their own dedicated "Unused /
   Removed" category across all four kinds instead of being hidden or left scattered - 92 items, 44
   skills, 37 effects, 0 mods. Implementation: `UNUSED_OR_REMOVED_NAME_RE` /
   `UNUSED_OR_REMOVED_CATEGORY` / `isUnusedOrRemoved` in normalize.ts, applied in `toSearchEntry` -
   reassigns only the *search-index* category (browse-page grouping), never the detail record's own
   real category, so the entry's own page (if you visit it directly) still shows its true original
   category. `ITEM_CATEGORY_GROUPS` (categoryTaxonomy.ts) gained a matching top-level section so
   these land in their own labeled group instead of the generic "Other" fallback.
4. **Real page-level horizontal overflow** on every browse page - a tag chip with `shrink-0` and no
   width cap could force its row (and the whole page) wider than the viewport. Pre-existing, not
   something introduced this session; just not caught until a live check with `document.body
   .scrollWidth` after other changes made it visible. Fixed: each chip is now `inline-block max-w-
   [6rem] truncate` (with a `title` attribute carrying the full humanized text). Verified via
   `document.body.scrollWidth === document.body.clientWidth` on items/mods/effects browse pages
   after the fix.
5. **`WIKI_DATA_VERSION` wasn't bumped** despite several real resyncs this session - every fetch hit
   the same URL (`/data/wiki/2026-08-21/...`), so the browser's normal HTTP caching kept serving
   stale data after each sync, making live fixes look like they hadn't landed. This is the project's
   own documented cache-busting mechanism (see its doc comment in types.ts) working exactly as
   designed - the miss was on the testing side (me), not a code bug. Bumped to `2026-08-24`, did one
   more real sync into the new path, removed the old `public/data/wiki/2026-08-21/` directory from
   the repo (`git rm -r --cached` + `rm -rf`) so only one version is ever tracked at a time, and
   fixed the one test (`load.test.ts`) that hardcoded the old version in an expected icon path.

## Open questions (need Jaycee's call before acting)

- **Should tag chips show on browse rows at all, now that they're humanized/truncated/safe?**
  They're still somewhat arbitrary internal grouping tags (`quality_currency`, `currency_duplicate`,
  `ezomyte_basetype`) - now readable and non-overflowing, but arguably still not that useful to a
  wiki reader versus just being visual noise. Not acted on either way yet.
- **Internal-state entries mixed into the Effects list** - "Cutscene In Progress", "Grace Period",
  and a literal test entry "Block Test" (not DNT-marked, so the Unused/Removed fix above doesn't
  catch it) sit alongside real ailments/buffs like "Ignited"/"Poisoned". Worth its own bucket too,
  or leave as-is? Small in count, low urgency, flagging for the same conversation as the tag-chip
  question above.

## Round 2 (same day, Jaycee's follow-up directives)

Answered the two open questions from round 1, plus three more issues found live during this round:

- **Internal-state effects folded into Unused/Removed** (Jaycee's call on the open question) -
  extended `isUnusedOrRemoved` (normalize.ts): the `[DNT`/`[UNUSED]` name-prefix regex now also
  matches `[UNUSED]` (not just `[DNT...]` - real data has both, e.g. "[UNUSED] Heist Test Weapon"),
  and a new explicit `UNUSED_EFFECT_NAMES` set covers "Grace Period", "Cutscene in Progress", and 8
  literal QA-test-named effects ("Block Test", "Spiral Test Cheat", etc). Effect-only, not a
  cross-kind "Test" pattern - items have real content shaped like that ("Test of Strength Barya", a
  genuine Trial of the Sekhemas room) that would have false-positived.
- **Real bug: back-navigation reset scroll position, selected category, and search query to
  nothing**, every time - `WikiBrowse` is client-fetched (loads after mount), so neither the browser
  nor Next's own scroll restoration had a tall-enough page to restore into. Fixed with a
  `sessionStorage`-backed view state (`src/components/wiki/WikiBrowse.tsx`) keyed per kind: category,
  query, and scroll position all persist across a remount, restored via `useLayoutEffect` once real
  content has painted (not during the "Loading…" placeholder). A `?q=` mention-link arrival still
  wins over a stored view (fresh intent, not "continue where I left off"). `WikiSearch.tsx` gained an
  `onQueryChange` callback so `WikiBrowse` can observe query changes without lifting the whole input.
  Verified live: scrolled to 1500px, visited a detail page, hit Back, landed back at 1500px.
- **Tag chips: kept, but reworked per Jaycee's directive** -
  - Strength/Dexterity/Intelligence mod-family tags and the matching item armour/shield/jewel tags
    (`str_armour`, `dex_shield`, etc.) now get a color tint - red/green/blue, reusing the same tokens
    `skillAccentColor` already uses for gem colors (`src/lib/wiki/attributeTagColor.ts`). A hybrid tag
    (`str_dex_armour`) gets a fixed blended solid color (amber/purple/teal) rather than a live
    gradient - tried the gradient first, but on a short, often-truncated chip it just read as its
    first color (confirmed via computed styles: the CSS was technically correct, the visual result
    wasn't legible). All-three (`str_dex_int_armour`) reuses the existing `--wiki-gem-w` "universal"
    token. New CSS custom properties `--wiki-attr-str-dex`/`-str-int`/`-dex-int` in globals.css,
    theme-aware (light/dark blocks).
  - Currency items (`StackableCurrency`/`Currency` raw category, not the broader taxonomy group -
    SoulCore/Omen/VaultKey keep their own real tags) now show no tags except `incursion_currency`.
  - The `essence` tag is gone entirely - essence items get their own "Essence" category instead (new
    leaf in `ITEM_CATEGORY_GROUPS`), 82 items.
  - Redundant tags dropped: a tag that reads identically to the entry's own category ("dagger" on a
    `Dagger` item), and the bare "onehand"/"twohand" half of a pair when the fuller
    "one_hand_weapon"/"two_hand_weapon" tag is also present (342 items carried both halves of one of
    these pairs - the same fact stated twice).
- **Answered: Frostbolt/Cold Infusion not linking** - "Frostbolt" is a real skill, excluded by the
  deliberate single-word mention guard (not revisited here, would need its own decision). "Cold
  Infusion" doesn't exist as its own entry - GGPK only has a generic "Elemental Infusions" mechanic,
  Fire/Cold/Lightning are unnamed flavors of it (same shape as the Mageblood Legacy case from the
  GGPK-audit doc).
- **Version bumped twice more** (`2026-08-24` → `2026-08-25`) chasing the same browser-HTTP-cache
  staleness from round 1 - repeated resyncs into the same version URL during iteration kept serving
  stale data. Confirmed via direct file/fresh-fetch checks each time that the underlying fix was
  correct before concluding it was a caching artifact, not a real bug. Considered forcing
  `cache: 'no-store'` on the index fetch to sidestep this permanently, and deliberately did *not* -
  that fetch's HTTP caching is a documented, intentional optimization (`fetchIndex.ts`'s own comment:
  avoids re-parsing a large JSON file on every navigation), and weakening it for testing convenience
  would trade away a real production benefit. Re-bumping the version is the correct cost to pay
  instead, same as production always does for a real data change.

## Deliberately deferred to the `/design` reformatting pass (not decided here)

**Effects have zero sub-categorization.** All 1,225 entries share one flat "Effect" category -
ailments, buffs, debuffs, charms, auras, and internal state markers are all indistinguishable while
browsing. This is exactly the "should this be an effect, ailment, or mod?" clarity problem Jaycee
named directly. No GGPK data distinguishes these (confirmed during the earlier source audit -
`BuffDefinitions` carries no classification column), so any taxonomy here is a hand-curated design
decision, not a quick mechanical fix like the category-humanization work above. This is the single
biggest input for the upcoming `/design` pass on wiki clarity/categorization.
