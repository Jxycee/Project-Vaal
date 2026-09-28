# Build Profile Redesign — Handoff for the Local (UI) Session

**Date:** 2026-09-27
**From:** cloud session (no UI access: no Supabase credentials, no `node_modules`). Everything below comes from reading `main` @ `6424a481` and from running the editor's and importer's own code headlessly against a real character.
**Status:** Report only. **No code was written for this.** Nothing here is decided. Walk the running app with the user before trusting any of it.

---

## 0. The ask, in the user's words

> "Our build system feels like a clusterfuck. It should almost be like a true character profile (close to a profile on social media, but it has the tabs for the build such as checkpoints, tree, etc.)"
>
> "As a core system, it works and gets the job done. But it is not pretty. I am not sure if this is purely a UI design thing bothering me, or how the flow of making a build works."
>
> "I love how Mobalytics is set up for builds, but I absolutely hate having to scroll for 30 seconds to get to what I need. Mobalytics would also be much better organized with the tab system we are using. I am not looking for an exact clone, but something close and familiar for users who have made builds online before. Currently we have a familiar system but very unfamiliar UI and build workflow."

**Your job:**
1. See the UI yourself, with the user.
2. Confirm or correct the diagnosis in §2.
3. Agree the target in §3 with the user.
4. Only then design and plan.

The cloud session's short answer to "is it UI or flow?" is **both, and the flow is the root.** The build has no home screen of its own.

---

## 1. What exists today (verified in code)

### One build, four surfaces

| Surface | Route | What it does there | File |
|---|---|---|---|
| Dashboard | `/dashboard` | "Build Planner" card and "Recent builds", both opening `/tree?build=` | `src/app/(dashboard)/dashboard/page.tsx` |
| Library | `/builds` (and `?tab=public`) | your list (rename, delete, **visibility**, **tags**, **copy link**), **Import from PoB**, public finder | `src/app/(dashboard)/builds/page.tsx`, `components/builds/MyBuildsList.tsx`, `ImportSheet.tsx`, `BuildFinder.tsx` |
| Editor | `/tree?build=&checkpoint=` | everything else (below) | `components/tree/TreeBuildSession.tsx` |
| Read-only page | `/builds/[shareToken]` | the build as others (and the owner) see it | `components/builds/SharedBuildView.tsx` |

The top-level nav item is **"Tree"** (`components/layout/shell-chrome.tsx:18`), not "Builds". The product's mental model is "a tree editor with extras", not "a build that has a tree".

### The editor is a tree canvas with overlays

`TreeBuildSession.tsx:452-622`: a full-screen `PassiveTree` canvas with these on top:
- **top-left** `TreeControls`: collapsible class and ascendancy pickers, and weapon-set paint mode
- **top-right** `BuildSavePanel`: collapsed to a chip; expands to name / level / league / notes / Save
- **a chip row:** `Gear`, `Jewels`, `Gems`, `Stats` and `Checkpoints n`. Each opens a **full-screen modal sheet** (`components/build/*Sheet.tsx`), one at a time
- **bottom** `NodeInfoPanel`

Stats and Checkpoints are explicitly marked `TEST-GRADE … pending the UI session` in the code (`TreeBuildSession.tsx:497-505`, `SharedBuildView.tsx:128`).

### Where a build's parts live

| Part | Where the user sets it |
|---|---|
| Class, ascendancy | tree overlay (`TreeControls`) |
| Name, level, league, notes | editor save chip (`BuildSavePanel`) |
| Visibility, tags, share link, delete | **the library list**, not the build |
| Checkpoints (add, rename, reorder, delete) | a sheet in the editor; on the shared page, a row of plain links |
| Gear, jewels, gems | three separate sheets |
| Stats | a sheet (editor); a section behind a tap (shared page) |
| Import | the library page, not "new build" |

### The read-only page is one long scroll

`SharedBuildView.tsx`, deliberately in pobb.in's order:
1. header (name, ascendancy · level · league, main skill / author / views / updated, and an **Edit** button for the owner)
2. checkpoint links
3. tags, notes
4. gems, gear (flat list), jewels, stats
5. the passive tree **at the bottom**

It renders with its own read-only components (`ReadOnlyGearList`, `ReadOnlyGemList`, `SharedStatsPanel`, `SharedTreePanel`). That's a second UI for the same data, which looks different from the editor's.

---

## 2. Diagnosis: why it feels like a clusterfuck

Ordered by how much each drives the feeling. Confirm each one in the running app.

1. **The build has no home. The tree is the home.** Opening a build drops you on a canvas, and every other part is an overlay you summon and dismiss. Build sites (PoB's tabs, poeplanner's Equipment / Skills / Tree / Stats / Notes tabs, Mobalytics' build page) make the **build** the page, with the tree as one part of it.
2. **Identity is scattered across three screens.** Name and notes are in the editor, visibility and tags on the list page, the view on a third route. A "profile" needs one place that is the build.
3. **Viewing and editing are different pages with different components.** The owner bounces between `/builds/[token]` and `/tree?build=`. Anything learned on one looks different on the other.
4. **Modal sheets hide context.** You can't see stats while changing gear, or gear while choosing gems. Nothing persistent tells you what you're editing (class, level, checkpoint, Life/ES/res).
5. **Checkpoints are an afterthought in the UI but the axis of the data.** Every tree, gear set and gem set belongs to a checkpoint (`build_checkpoints`), yet the switcher is a test-grade sheet and a link row. On a profile, they should be a first-class selector that re-scopes every tab: pobb.in's "Loadout" dropdown, Mobalytics' variants.
6. **No real "new build" flow.** "New" drops you on a blank tree and you find the class picker in an overlay. Import lives on a different page.
7. **Gear is a flat 17-slot list.** A paper-doll layout was already researched and not built: `specs/2026-09-23-paper-doll-layout-research.md`, which includes a proposed 8×8 grid.
8. **The read-only page is the "30-second scroll".** Every section stacks, with the tree last.

**Friction a real user hits** while building a real character (the cloud session rebuilt one by hand today; see Appendix A):
- Tooltip lines that are sums of two mods have to be split in your head.
- Affix inputs are in raw roll units: crit "+4.96%" must be typed as `496`, and "24% reduced" as `-24`.
- Jewels can't be crafted at all.
- A Voices jewel's two sockets can't be used.
- There's no "active weapon set".
- False warnings: "9 of 8 ascendancy points" and "Over budget by 1".

---

## 3. Target: the build as a character profile

A proposal to react to, not a spec.

### 3.1 One page per build, with tabs, for owner and reader alike

- One route per build, with the same page for everyone: readers see read mode, the owner gets an **Edit** toggle.
  - This retires the split between `/tree?build=` and `/builds/[token]` for normal use.
  - `/tree` can stay as the scratch / quick-plan entry.
- **Tabs, deep-linkable:** `?tab=` and `?checkpoint=`, so back/forward and shared links land on the right tab and stage.
- **Suggested tabs:**

| Tab | Holds | Replaces |
|---|---|---|
| **Overview** | the "Mobalytics page" in one screen: summary / notes excerpt, main-skill link group, key items, core stats, tags | the long scroll |
| **Tree** | the canvas (lazy: the 5.1 MB export loads only here), class/asc, weapon-set paint, node panel | today's editor home |
| **Gear** | paper doll (per the research spec) + item editor; jewels as a sub-section | Gear sheet + Jewels sheet |
| **Skills** | gem link groups as visual rows (main skill first), Spirit summary | Gems sheet |
| **Stats** | the full defence sheet, both weapon sets; later offence | Stats sheet / section |
| **Notes** | full notes (later: priorities, rotation, FAQ, which are competitor gaps in `specs/2026-09-23-competitor-build-flow-gaps.md`) | notes field in the save chip |

- **Checkpoints are not a tab.** They're a **switcher in the header** ("Lvl 31 · Act 2 ▾") that re-scopes every tab. Managing them (add, rename, reorder) lives behind that switcher.

### 3.2 A profile header, like a social profile

Keep it compact. It should collapse to a slim sticky bar on scroll, with the tabs pinned under it.

- **Identity:** name, author, class · ascendancy · level, league, main skill (gem icon), visibility badge, tags.
- **At-a-glance stats:** Life, ES, Mana, the 4 resistances, Spirit (reserved/total). Later DPS.
- **Actions:** Edit, Copy link, Visibility / tags / delete (a settings menu, **moved here from the library list**), later Export and Like / Bookmark (the `build_bookmarks` table already exists; see CURRENT-STATE).
- **The checkpoint switcher.**
- **Art caveat:** a portrait / hero image needs an art decision. `AGENTS.md`'s GGG-art exceptions are the tree, wiki icons and price icons only, **"do not extend any of them to any other feature."** An ascendancy portrait from GGG art would be a new exception, which is the user's call. Otherwise it's original art, or none. The wiki gem and item icons are already used in build UI, so they're fine.

### 3.3 Rough layouts

Desktop: tabs under a sticky header, with an optional right rail of stats while editing.

```
┌───────────────────────────────────────────────────────────────┐
│ [icon] LA Deadeye — endgame        Deadeye · 98 · Forbidden R.│
│  by jxycee · Public · #bow #lightning     [Lvl 98 Endgame ▾]  │
│  Life 1458  ES 1348  Res 68/61/77/42  Spirit 211/211  [Edit]  │
├───────────────────────────────────────────────────────────────┤
│ Overview | Tree | Gear | Skills | Stats | Notes               │
├─────────────────────────────────────────────┬─────────────────┤
│  (active tab content, one screen)           │ Stats rail      │
│                                             │ (edit mode)     │
└─────────────────────────────────────────────┴─────────────────┘
```

Mobile (375 px): the header collapses to one line; the tabs become a horizontally scrollable top strip or a bottom bar. Watch the no-horizontal-page-scroll rule. Stats become a pull-up peek.

```
┌───────────────────────┐
│ LA Deadeye  98 ▾ [✎]  │
│ Life 1458 · ES 1348   │
├───────────────────────┤
│ Overview Tree Gear …  │
├───────────────────────┤
│   tab content         │
│                       │
└───────────────────────┘
```

### 3.4 Creation flow

- **"New build" is a small step:** choose class → ascendancy → name, **or** "Import from PoB / link". Both land on the new build's **Overview in edit mode**.
- Each empty tab shows a clear call to action ("Pick your main skill", "Add gear"), rather than a blank canvas.
- **Library (`/builds`):** profile-style cards (ascendancy, main skill, level, key stats, tags, updated). Management actions move into each build's settings menu.
- **Nav:** "Tree" → "Builds". The tree becomes a tab.

### 3.5 Mobalytics: borrow the familiarity, not the scroll or the look

- **Borrow:**
  - a build page that reads like a profile or guide
  - a hero header with class/ascendancy and tags
  - named variants / stages
  - gem link groups as visual rows
  - paper-doll gear
  - clear section headings
- **Avoid:**
  - the long article scroll (tabs replace it)
  - ads
  - a table-of-contents as the main navigation
  - copying their **styling** (colours, slot frames, badges); the paper-doll research already rules this out
- **Verify live with the user first.** The repo's recon (`specs/2026-09-20-competitor-build-planner-recon.md`, 2026-09-20) found no in-house PoE2 planner on Mobalytics, just articles with a PoB code box. That may be stale, and mobalytics.gg answered 403 to the cloud session. Look at the exact pages the user likes and write down *which parts* they mean.

---

## 4. Constraints, so this doesn't break what works

From `docs/superpowers/CURRENT-STATE.md`. Read it first.

**Visibility**
- The words are **inverted** from the usual web meaning: `public` / `private` (link) / `unlisted` (owner only). Don't "fix" them.
- The reader path must keep going through the share-token RPCs only.

**Editor state**
- **The keyed remount is load-bearing.** `TreeBuildSession` is keyed by build **and** checkpoint, and that's what prevents the old stale-state data loss. Whatever hosts the Tree/Gear/Skills tabs in edit mode must keep one build- and checkpoint-scoped session, **with tab switches inside it, not across it**. Otherwise unsaved edits die on a tab change.
- Checkpoint switching is a server navigation today. Drafts are keyed per checkpoint (`vaal:tree-draft:<buildId>`).
- Only the Tree tab should pay for the 5.1 MB tree export. Stats need it too, so plan the loading order.

**Access**
- All of `/builds` is auth-protected (`PROTECTED_PREFIXES`). A signed-out visitor never sees a build.

**Mobile rules**
- `h-11` / 44 px tap targets.
- No horizontal page scroll (`e2e/mobile-layout.spec.ts`).
- A desktop project exists (`desktop-layout`).

**Tests** (`AGENTS.md`)
- **E2E first**, ending in a repeatable artifact.
- Specs whose selectors and flows will move: `sharing`, `checkpoints`, `pob-import`, `stats`, `validation`, `item-craft`, `build-persistence`, `loadout-persistence`, `draft-and-auth`, `mobile-layout`, `desktop-layout`, `cross-site`.

**Art:** see §3.2.

**Doc drift to fix while there:** CURRENT-STATE says Slices 3–5 are "not yet merged". They are on `main` (merge `15fff5a`) and in production.

---

## 5. Suggested process for the local session

1. **Walk the app with the user, phone width and desktop.** Take a screenshot at each step and note every "where is…?" moment. Go through all three routes:
   1. **From scratch:** New → pick Ranger / Deadeye → allocate → gear → gems → save → set visibility/tags → view the shared page. Use the reference character in Appendix B, so the result can be checked against real numbers.
   2. **Import:** paste the same character's PoB code (`docs/superpowers/handoffs/2026-09-27-momentsZX-pob2-code.txt`) through /builds → Import, then compare with the hand-built one.
   3. **Reader:** open the shared link as a second account, or signed in on another device.
2. **Confirm §2 with the user.** Which of the eight points do they actually feel? Is the core issue layout, flow, or both?
3. **Look at Mobalytics live together** and name the specific parts they like.
4. **Agree the tab list, the header contents, edit-in-place vs a separate editor, and the nav rename.** See §6.
5. **Design, then plan.** Use the brainstorming / design flow, with wireframes before code. Then a slice plan. A plausible order:
   1. route + header + tab shell with deep links (read mode)
   2. edit mode inside the same page, keeping the keyed session
   3. checkpoint switcher in the header
   4. Gear paper doll
   5. Skills rows
   6. Overview
   7. library cards + nav rename + new-build step
6. The stat/editor bugs in Appendix A are **separate work**. Fix them in their own slices, not inside the redesign.

---

## 6. Open questions for the user

- **Does the owner edit in place** (one page, Edit toggle), or does "Edit" open a dedicated editor that looks like the profile?
- **Which tab is first** for a reader: Overview (guide-like) or Gear/Tree (planner-like)? For the owner?
- **Header art:** an ascendancy portrait (a new GGG-art exception, the user's call), original art, or none?
- **Overview contents:** notes only, or structured fields too (summary, pros/cons, stat priorities, rotation)?
- **Social layer now or later:** likes, bookmarks, view counts, follow author, comments?
- **Mobile tabs:** top strip or bottom bar?
- **Does `/tree` stay** as a scratch planner for trying things without a saved build?

---

## Appendix A — Bugs and limits found today (separate from the redesign)

A real character was rebuilt two ways and compared with the game:
1. **By hand**, through the editor's own code paths: pickers, mod picker, clamps, write gate.
2. **Through the importer.**

Vaal's defence math is **correct**. With the missing inputs added back, all 13 stats match the character exactly, for both builds. The gaps are inputs:

| Finding | Effect on this character | Where |
|---|---|---|
| Mod picker and importer only offer `domain === 'Item'` mods. Desecrated (`Unveiled`), essence-only and rune-unlocked (Marksman) mods are in our data but unreachable. | Cold/Chaos res −33 each; amulet 36% global defences (ES −196, Evasion −637); 5 offence lines | `src/lib/wiki/modCatalogue.ts:146`, `src/lib/pob/catalogue.ts:271` |
| Rune effects are not counted | ES −77, Evasion −279 | stats engine |
| Quest choice rewards can't be chosen (and PoB's `quest…` config isn't read on import) | ES −81, Evasion −266, Str −5, Int −5 | `stats/campaign.ts`, `pob/parse.ts` |
| `base_dexterity_and_intelligence` is missing, and unknown stats are dropped **silently**. Also missing: `base_all_attributes`, `maximum_life_mana_and_energy_shield_+%`, `oracle_maximum_life/mana_+%_final`, `titan_maximum_life_+%_final`, `maximum_energy_shield_from_body_armour_+%`, `energy_shield_from_helmet_+%` | Dex −10, Int −10 (Oracle and Titan builds affected too) | `stats/statTable.ts`, `stats/collect.ts:127-131` |
| Summed tooltip lines (pure + hybrid) can't be matched by the importer and give no hint in the editor | importer: helmet ES/Evasion lost; hand-built: fine if split by hand | importer; item editor UX |
| Affix inputs are in roll units, not tooltip units | usability | `ItemEditorSheet.tsx` `RangeInputs` |
| Item and gem quality capped at 20 (real items: 21, 22, 23); the importer reports the clamp for gems only | ES −5, Evasion −24 | `craft.ts` `MAX_ITEM_QUALITY`, `gemState.ts` |
| Some values sit above our top tier (amulet 53% ES, ring 21–28 phys). The open wiki refresh PR #10 is the same patch, so it doesn't change this. Unexplained. | ES −16 | data |
| No jewel craft editor; item-granted sockets (Voices) unusable | 5 rare jewels' mods, 2 jewels unplaceable | `JewelsSheet.tsx` |
| No enchantments / anoints; no "active weapon set"; a Meta gem (Mirage Deadeye) can't hold its skill | max res +2; anointed Kite Runner / Overwhelming Strike | editor model |
| False "9 of 8 ascendancy points": nodes are counted, and a choice notable is stored as parent + option | warning on a legal build | `validate/index.ts:47` |
| "Over budget by 1": 122 passives vs 121 at level 98. `QUEST_PASSIVE_POINTS = 24` may be one short for 0.5 | warning on a legal build | `passiveBudget.ts` |
| Reserved Spirit 210 vs the character's ≥211 | not root-caused | `validate/reservation.ts` |

---

## Appendix B — Reference character for the walkthrough

- **poe.ninja:** Forbidden Rites, account `Xyz562-0313`, character **`momentsZX`**. The #1 listed Lightning Arrow Deadeye, level 98, updated 2026-09-22.
  - Live data: `https://poe.ninja/poe2/api/builds/<snapshot-version>/character?account=Xyz562-0313&name=momentsZX&overview=forbidden-rites`. Get the version from `/poe2/api/data/index-state`.
  - It changes as the player plays. The PoB code saved next to this file is the 2026-09-27 snapshot.
- **Class / tree:** Ranger → Deadeye. 122 passives; 39 "+5 any attribute" nodes set to **0 Str / 19 Dex / 20 Int**. Ascendancy: Gathering Winds, Skill Speed, Mirage Deadeye, Endless Munitions, Projectile Damage, Point Blank (choice), Projectile Speed ×2.
- **Weapons:** weapon set 1 = Nettle Talisman (magic). **Set 2 = Obliterator Bow (rare) + Cadiro's Gambit (Primed Quiver)**, which is the one the character uses.
- **Armour:** Grinning Mask, Falconer's Jacket, Runeforged Secured Wraps, Wanderer Shoes (all rare, evasion/ES).
- **Jewellery:** Gold Amulet (rare), Amethyst Ring (rare), Gold Ring (rare), Headhunter (Heavy Belt).
- **Flasks and charms:** Ultimate Life Flask (magic), Lavianga's Spirits, Rite of Passage, Thawing Charm (magic), The Fall of the Axe.
- **Jewels:** 4 rare Emeralds, a rare Time-Lost Emerald, Heart of the Well, Voices. Two of the Emeralds sit in Voices' Sinister sockets.
- **Skill groups:**
  - Lightning Arrow (main)
  - Mirage Deadeye (+ Lightning Arrow)
  - Tornado Shot
  - Herald of Thunder
  - Lightning Rod
  - Mana Remnants
  - Rhoa Mount
  - Pounce
  - Ghost Dance

## Appendix C — Numbers the UI should show

| | In game (PoB2) | Vaal hand-built | Vaal imported |
|---|---|---|---|
| Str / Dex / Int | 59 / 190 / 142 | 54 / 180 / 127 | 54 / 180 / 127 |
| Life / Mana | 1458 / 1012 | 1448 / 981 | 1448 / 981 |
| Energy Shield | 1348 | 945 | 520 |
| Evasion | 4752 | 3469 | 2687 |
| Fire / Cold / Lightning / Chaos | 68 / 61 / 77 / 42 | 68 / 28 / 75 / 9 | 68 / 28 / 75 / 9 |
| Spirit | 211 | 211 (210 reserved) | 211 (210 reserved) |

If the live Stats sheet shows different numbers for the same inputs, that's a new finding: the cloud numbers came from the same engine code, run headlessly.
