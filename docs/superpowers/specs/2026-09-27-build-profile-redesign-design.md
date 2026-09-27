# Build Profile Redesign — Design

**Date:** 2026-09-27
**Status:** Decided by the user 2026-09-27 ("i agree with them all"), after reviewing the walkthrough, findings and wireframes on the progress dashboard (https://claude.ai/artifact/XFueArrGJVFUnFTEatE5WW, private to the user).
**Input:** `handoffs/2026-09-27-build-profile-redesign-handoff.md` (the cloud session's report). Read this spec first; the handoff is the record of what was believed before the walkthrough, and §"Corrections to the handoff" below lists what it got wrong.
**Scope:** Layout and flow only. Visual identity (graphics, theme, flair) is a later pass. The engine and editor bugs in the handoff's Appendix A are separate work.

---

## 1. The goal, in the user's words

> "It should almost be like a true character profile (close to a profile on social media, but it has the tabs for the build such as checkpoints, tree, etc.)"
>
> "I love how Mobalytics is set up for builds, but I absolutely hate having to scroll for 30 seconds to get to what I need."

And for this pass: "make our build maker feel more familiar, flow better, and look better visually (good looking layout first, actual designing of graphics/theme/identity will come after we have a happy point)."

**Success looks like:**
- A build has one page. Owner and reader see the same layout; the owner can edit on it.
- Anything a reader wants is at most one tap (a tab) plus one screen of scroll away on a 375px phone.
- A new or imported build lands on that page, not on a bare tree canvas.

---

## 2. What the walkthrough measured (2026-09-27, local, test account)

The reference character (momentsZX, Lightning Arrow Deadeye, level 98) was imported through Import from PoB and walked on a phone (375 × 812) and on desktop (1440 × 900). Screenshots and numbers are on the dashboard.

| Measure | Value |
|---|---|
| Shared build page length, phone | 3,971px = 4.9 screens; the tree section starts at 3,803px |
| Shared build page length, desktop | 3,111px = 3.5 screens |
| Gems sheet length, phone | 4,242px = 5.2 screens |
| Import report before the Import button, phone | 3,598px = 4.4 screens |
| Chip rows over the tree canvas, phone, imported build | four rows, about 40% of the canvas |
| Position of the main skill in every gem list | 6th (it is flagged Main but not sorted first) |

Stats for the imported build match the handoff's Appendix C "Vaal imported" column exactly (Life 1448, Mana 981, ES 520, Evasion 2687, res 68/28/75/9, Spirit 211 with 210 reserved). **No new engine finding.**

All eight points of the handoff's §2 diagnosis were confirmed.

### Corrections to the handoff

- **The nav has both "Tree" and "Builds"** (`src/components/layout/shell-chrome.tsx:15-22`). The handoff says the nav item is "Tree", not "Builds". The decision is to *remove* Tree, not rename it.
- **Mobalytics has an in-house PoE2 planner** at `mobalytics.gg/poe-2/planner/builds`. Its editor is the build page itself with each section editable in place. `specs/2026-09-20-competitor-build-planner-recon.md` ("no in-house planner") is stale.

### Additional findings (not in the handoff)

- Import lands on the tree canvas (`ImportSheet.tsx:70`), not on the build.
- The import preview is a developer-style report; the name field and Import button come after all of it, and the sheet title still says "(test UI)".
- Library cards are mostly settings (visibility dropdown, share link, Copy, tags). No main skill, no stats, no icon; names truncate at about 18 characters at 375px.
- The author reads "Anonymous" whenever `display_name` is null, which has no write path in the app (see `builds/[shareToken]/page.tsx` comment).
- Two gear warnings on the real character look wrong: "Wanderer Shoes has 4 suffixes; a rare item can have 3" and "Amethyst Ring has two mods from the ItemFoundRarityIncrease group". **Unverified.** Probably the same desecrated/essence-mod gap as Appendix A. Out of scope here; add to that work.

---

## 3. Decisions (all approved 2026-09-27)

| # | Question | Decision |
|---|---|---|
| 1 | Structure | **One build page with tabs** (option A). Rejected: tabs as separate routes (B: every tab switch is a server navigation, and the layout must stay mounted exactly right or unsaved edits die); restyle only (C: the build still has no home). |
| 2 | Edit model | **Edit in place.** An Edit toggle on the same page, same components. |
| 3 | URL | **`/builds/[shareToken]` for everyone.** The owner is recognised on the server and gets Edit, including on `unlisted` builds. `/tree?build=…` redirects to the build page's Tree tab. `/tree` with no build stays as the scratch planner. |
| 4 | Tabs | **Overview · Gear · Skills · Tree · Stats.** Jewels live in Gear; notes live in Overview. |
| 5 | First tab | **Overview for everyone.** New and imported builds open on Overview in edit mode. |
| 6 | Checkpoints | **One switcher in the header** ("Lvl 98 · Endgame ▾") that re-scopes every tab. Add, rename, reorder and delete live in its menu. Not a tab. |
| 7 | Phone tabs | **A sticky strip at the top**, under a header that collapses to one line on scroll. The site nav keeps the bottom. |
| 8 | Nav | **Remove "Tree".** "Builds" is the way in; the scratch planner becomes a "Quick plan" button on `/builds`. |
| 9 | Paper doll on a phone | **Six columns** for weapons and armour, with rings, amulet, belt, flasks and charms in one row underneath, so every slot clears 44px. Desktop uses the in-game 8×8 arrangement from `specs/2026-09-23-paper-doll-layout-research.md`. |
| 10 | Header art | **None for now.** Main skill gem icon (already permitted wiki art) plus class and ascendancy as text. A GGG ascendancy portrait would need a new `AGENTS.md` art exception; revisit in the identity pass. |
| 11 | Social | **Later.** Keep author and view count; leave room in the header actions for bookmark/like (`build_bookmarks` table exists, no migration needed). |
| 12 | Scope | **This one spec, built in seven slices** (§10). Appendix A bugs and the two new warnings stay separate. |

---

## 4. Routes and URL state

| URL | What it is |
|---|---|
| `/builds` | Library: Mine / Public tabs, "+ New build", "Import", "Quick plan". |
| `/builds/[shareToken]` | **The build page.** Owner and readers. |
| `/builds/[shareToken]?tab=gear&checkpoint=<uuid>&edit=1` | Deep link: tab, checkpoint, edit mode (owner only). |
| `/tree` | Scratch planner: the same build page shell in edit mode with no saved row (§7.3). |
| `/tree?build=<uuid>[&checkpoint=]` | **Redirect** (server) to `/builds/<token>?tab=tree&checkpoint=…&edit=1` for the owner; the existing "could not be found" treatment otherwise. Kept so old links, bookmarks and the dashboard's recent-builds links keep working. |

**Query parameters:**
- `tab` — `overview` (default) · `gear` · `skills` · `tree` · `stats`. Unknown values fall back to `overview`.
- `checkpoint` — as today: unknown or absent falls back to the first by position, and the server then rewrites the URL to name it (the `/tree` page's existing rule, `tree/page.tsx:88-98`, moves here).
- `edit=1` — edit mode. Ignored (stripped) for non-owners.

**Tab and edit-mode changes are client-only.** They update the URL with `window.history.pushState` (tabs, so Back returns to the previous tab) or `replaceState` (edit toggle), which Next 16.2.9 syncs into `useSearchParams` without a server request (`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` §"Native History API"). They must never go through `router.push`/`<Link>`: that re-runs the Server Component, which re-fetches the build and, for a public build viewed by a non-owner, **increments the view count on every tab tap**.

**Checkpoint changes stay server navigations** (as today): they remount the session with fresh rows. See §6.4.

---

## 5. Page anatomy

### 5.1 Header

Full height at the top of the page; collapses to one sticky line after the user scrolls past it. The tab strip is pinned directly under it.

**Full:**
- **Name** (edit mode: editable inline).
- **Class · Ascendancy · Level · League** (edit mode: level and league editable; class and ascendancy are changed on the Tree tab, where they already live, and shown read-only here).
- **Author** ("You" for the owner; the display name, else "Anonymous", for readers). **Visibility badge** (owner only). **Tags** (chips).
- **Main skill:** gem icon + name.
- **Checkpoint switcher** chip: "Lvl 98 · Endgame ▾".
- **At-a-glance stats:** Life · ES · Mana · four resistances · Spirit (reserved/total). Shows a skeleton until the stats are computed (§6.5). Uses the weapon set the main skill is tagged for (its loadout's first `sets` entry), else Set I, and says which ("Set II").
- **Actions:** Edit / Done (owner), Copy link (when the link is live, i.e. visibility ≠ `unlisted`), ⋯ settings menu (owner): Visibility, Tags, Rename, Delete. Readers: Copy link only.

**Collapsed (sticky):** name · checkpoint chip · Edit/Done (owner) or Copy link.

The settings menu reuses the existing Server Functions unchanged: `setBuildVisibility`, `addBuildTag`, `removeBuildTag`, `renameBuild`, `deleteBuild` (`builds/actions.ts`). Delete confirms inline (no `window.confirm`) and navigates to `/builds`. The visibility control keeps today's explanatory copy ("Switching to Unlisted disables this link immediately.") and the vocabulary exactly as it is — see `CURRENT-STATE.md` "Visibility"; do not "fix" it.

### 5.2 Tabs

Five equal-width tabs at 375px (no horizontal scroll; each ≥ 44px tall). On desktop they sit left-aligned under the header.

| Tab | Read mode | Edit mode (owner) |
|---|---|---|
| **Overview** | Main skill group (icon, supports). Key items: the main skill's weapon set's weapons, plus every unique. Notes (full text). Tags. | Notes become an editor. Empty sections show a call to action ("Pick your main skill" → Skills tab; "Add gear" → Gear tab). |
| **Gear** | Paper doll (§5.4) with a Set I / Set II toggle. Tapping a slot shows the item. Jewels section below the doll: allocated sockets and unsocketed jewels. | Tapping a slot opens the existing item picker/editor (`ItemPickerSheet`, `ItemEditorSheet`). Warnings collapse to one "⚠ n" chip that expands, instead of the banner that pushes the list down today. |
| **Skills** | Compact gem-group rows, **main skill first**, then the rest in stored order. Each row: skill icon + name + level, supports as icons (names on tap/hover). Spirit reserved/total at the top. | Tapping a row opens that group's editor sheet: skill, supports, level, quality, weapon sets, Main. "+ Add skill group". |
| **Tree** | Read-only tree (`PassiveTree readOnly`), filling the space under the tab strip. Node panel on tap. | The editable tree. One slim toolbar replaces the floating chips: class picker, ascendancy picker, weapon-set paint mode, points used/budget. |
| **Stats** | The full defence sheet (today's `StatsSheet` content) with the Set I / Set II toggle and the "Not counted" list. | Same. |

Desktop adds a **stats rail** on the right of every tab except Tree (which wants the width): Life, ES, Evasion, Armour, the four resistances, Spirit, for the displayed weapon set, updating live while editing.

### 5.3 Phone layout rules

- Mobile-first: the unprefixed layout is the complete phone experience; `md:`/`lg:` add the rail and density.
- No horizontal page scroll at 375px (`e2e/mobile-layout.spec.ts`).
- Every button and link ≥ 44px in both dimensions (`measureTapTargets`), including tabs, the checkpoint chip, doll slots and gem rows.
- The Tree tab is full-bleed under the header + tabs, above the bottom nav, with `touch-none` on the canvas only (so the page itself still scrolls on other tabs).

### 5.4 Paper doll

- **Desktop:** the 8×8 grid in `specs/2026-09-23-paper-doll-layout-research.md` §"Proposed grid". Footprints are game convention, not extracted data (as that spec says).
- **Phone:** six columns. Weapon (left, 2×4), helmet (centre top, 2×2), off-hand (right, 2×4), body armour (centre, 2×3), gloves and boots (left/right under the weapons, 2×1). Below the doll, one six-wide row: ring 1, amulet, ring 2, belt, then flasks and charms wrapping onto a second row. Exact cell sizes are set in slice 4 against the 44px floor.
- Slot frames and colours are placeholders for the identity pass. **Do not copy Mobalytics' or GGG's slot art** (`AGENTS.md`).

---

## 6. Edit mode and the session

### 6.1 One session per build + checkpoint

Today `TreeBuildSession` is keyed `${buildId}:${checkpointId}` and owns all build-scoped state (tree, gear, gems, level, drafts, save). **That keyed remount stays load-bearing** (`CURRENT-STATE.md`; handoff §4). The build page renders exactly one session, keyed the same way, and **every tab renders inside it**. Switching tabs changes which child renders; it never remounts the session. Unsaved edits therefore survive tab switches by construction.

The session becomes a provider (context) rather than a component that renders the canvas and overlays. Tabs read and write its state; the header reads it for stats and dirty state.

### 6.2 Tree state must live in the session, not in PassiveTree

Today `PassiveTree` owns class, ascendancy, allocation and attribute choices as its own state, seeded once from `initialState`, and reports up through `onStateChange` (`PassiveTree.tsx:98-148`). `TreeBuildSession` only has `editorState` after PassiveTree has mounted and reported, and **both save and the draft effect return early while it is null** (`TreeBuildSession.tsx:329-333` and `:366`).

With tabs, PassiveTree only mounts on the Tree tab. Left as is, a user who opens a build, edits gear on the Gear tab and presses Save would **save nothing** (and get no draft either). So:

- The session holds the tree state itself, seeded from the saved checkpoint (`fromPassiveState` + class + ascendancy), without needing the tree export.
- PassiveTree is seeded from the session's **current** tree state each time it mounts, and its `onStateChange` writes back into the session.
- Save and drafts read the session's tree state and no longer depend on PassiveTree having mounted.
- `BuildEditorState.classId` needs the tree export to resolve. The session keeps the class by name (what is saved anyway) and resolves the id where the export is loaded. The draft format must stay readable for drafts written before this change (`draft.ts`, `draftCompare.ts`).

**Remounting PassiveTree** on every visit to the Tree tab is correct with the state lifted, but costs a parse of the tree graph each time. Slice 2 measures it. If it is noticeable, keep the Tree tab mounted but hidden after its first visit (hidden with `visibility`/off-screen, not `display: none`, which gives the WebGL canvas a zero size). Correctness must not depend on that choice.

### 6.3 Save, dirty state and drafts

- In edit mode the header shows **Save** (primary) with "Saved 14:02" / "Unsaved changes" status. Save sends the same body `POST /api/builds` gets today (`TreeBuildSession.tsx:372-409`), including the "always send gear_state/gem_state/main_skill/notes" rules documented there.
- Name, level, league and notes move from `BuildSavePanel` into the header (name, level, league) and Overview (notes). `BuildSavePanel` is retired from the build page.
- Drafts stay exactly as today: written per build + checkpoint (`vaal:tree-draft:<buildId>…`), read in a lazy `useState` initialiser, "Unsaved changes from last time — Restore / Discard" shown as a notice under the header.
- **Done** with unsaved changes shows an inline choice: Save · Discard · Keep editing. Discard clears the draft and reseeds from the saved checkpoint.
- The draft protects work across reloads, checkpoint switches and navigation away, as it does now.

### 6.4 Checkpoints

- The switcher lists checkpoints by position ("Lvl 31 · Act 2"). Choosing one navigates to `?checkpoint=<id>` with the current `tab` and `edit` kept. It stays a server navigation and remounts the session (§6.1).
- In edit mode the menu adds: Add checkpoint (copy of the current editor state, unsaved edits included — today's behaviour), Rename, Move up/down, Delete (the database refuses deleting the last one; surface its error). These call the existing `checkpointActions.ts` functions unchanged.
- Switching with unsaved changes: the draft keeps them (as today), and the switcher shows "Unsaved changes on this checkpoint are kept as a draft" before navigating.

### 6.5 The tree export (5.1 MB, 544 KB gzipped)

The stat engine needs it (`useDefenceSheets.ts:45`: node names, attribute flags, class base attributes), and the header shows stats. So:

- **Fetched once per page visit, after first paint**, in an unkeyed component above the session (as `TreeEditor` does today), so checkpoint remounts do not refetch it.
- The header stats, rail and Stats tab show a skeleton until it arrives; the Tree tab shows "Loading passive tree…".
- The Overview, Gear and Skills tabs must render fully without it.
- Validation warnings that only need passive state and gear (`validateCheckpoint`) work without it, as today.

---

## 7. Loading the page (server)

### 7.1 Owner vs reader

`/builds/[shareToken]/page.tsx` today resolves the build only through `get_build_by_share_token`, which filters `visibility IN ('public','private')`, so **an owner cannot open their own `unlisted` build there** (it 404s). New order:

1. Not signed in → `redirect('/login')` (unchanged, defence in depth).
2. Shape-check the token (`SHARE_TOKEN_RE`, unchanged).
3. **Owner path:** `select * from builds where share_token = $1 and user_id = <me>` plus the build's checkpoints by `build_id`. Both go through the owner's own RLS policies. If a row comes back, render owner mode.
4. **Reader path:** otherwise, exactly today's path: `get_build_by_share_token`, author name, tags (public only), `increment_build_view_count` (public only, non-owner only), `get_build_checkpoints_by_share_token`.
5. Neither → `notFound()`. "Unlisted and not yours", "bad token" and "does not exist" stay indistinguishable.

Every build has a share token: both insert paths mint one (`api/builds/route.ts:312`, `importActions.ts:166`), and the live database had 2 builds, 0 without a token, on 2026-09-27. The column is nullable, so the owner path must still handle a null token (the redirect in §4 falls back to "could not be found" for such a build rather than crashing).

**Security invariants that must not move:** readers only ever reach a build through the share-token RPCs; any personal-scope query carries `.eq('user_id', …)`; nothing is readable signed-out; `edit=1` is ignored unless the owner path matched; the view count is never incremented for the owner or for non-public builds.

### 7.2 The `/tree?build=` redirect

`tree/page.tsx` keeps its ownership-checked fetch. When the build is the caller's, it redirects to `/builds/<share_token>?tab=tree&edit=1&checkpoint=<id>`. Otherwise it renders today's "That build could not be found." notice. Callers to update so they link directly: `dashboard/page.tsx:259`, `MyBuildsList.tsx:208`, `ImportSheet.tsx:70`, `SharedBuildView.tsx:97-98`, `CheckpointsSheet.tsx:85,133`.

### 7.3 Scratch planner (`/tree`, "Quick plan")

`/tree` with no `?build=` renders the same page shell in edit mode with no saved row: header shows "Untitled build", tabs work, nothing is written until Save. The first Save creates the row (the existing scratch path in `POST /api/builds`, whose response already includes `share_token`), then `router.replace`s to `/builds/<token>?tab=<current>&edit=1`. The scratch draft (`vaal:tree-draft:scratch`) is cleared once that first save succeeds, as `handleSave` does today. The work is in the new row by then, so the build page opens with no draft. If edits were made while the save was in flight, the draft is kept (today's `latestSession` rule), and it must not be silently lost on the redirect. Slice 7 tests both cases.

---

## 8. Creation, import and the library

### 8.1 New build

"+ New build" on `/builds` opens one sheet:
1. **Class** (grid of the eight classes). Required.
2. **Ascendancy** (the chosen class's ascendancies). Optional.
3. **Name.** Required.
4. **Create build** → `POST /api/builds` with empty passive/gear/gem state, then navigate to `/builds/<token>?tab=overview&edit=1`.

The same sheet offers **"or import from Path of Building"**, which switches it to the import form. `/tree`'s default of Witch (`PassiveTree.tsx:95-103`) no longer matters for new builds, because the class is chosen first.

### 8.2 Import

- The import sheet shows a **one-screen summary** first: class · ascendancy · level, checkpoints found, counts of what was kept and dropped, name field, **Import** button. The full kept/dropped/inferred report goes behind "Show details".
- "(test UI)" leaves the title.
- On success, navigate to `/builds/<token>?tab=overview&edit=1`. `importPobBuild` returns the new build's id today; it must also return its `share_token` (read back from the insert).

### 8.3 Library cards

Each card is one link to the build page:
- Main skill gem icon; name (two lines before truncating); class · ascendancy · level; main skill name.
- Key stats from the build row where stored: none are stored today, so v1 shows **level, league and "updated n ago"** and no Life/ES. (Stats need the tree export per build; not worth it on a list. Revisit if a stats snapshot is ever stored.)
- Visibility badge and tags as chips.
- Rename, visibility, link, tags and delete **leave the card** (they are in the build page's ⋯ menu).

Page actions: "+ New build", "Import", "Quick plan". The Public tab (`BuildFinder`) gets the same card, reader flavour (author instead of visibility).

### 8.4 Nav

Remove the Tree entry from `NAV` (`shell-chrome.tsx:18`). Treat `/tree` as part of Builds for the active highlight. `/tree` stays in `PROTECTED_PREFIXES`.

---

## 9. What is deliberately not in this spec

- Visual identity: colours, frames, typography, flair, header art. Placeholders only.
- Offence/DPS stats.
- Structured guide fields (strengths/weaknesses, priorities, rotation, FAQ). Overview has notes only; this is where they would go later.
- Likes, bookmarks, comments, follow, display-name editing. The "Anonymous" fallback stays.
- Export to PoB.
- Every Appendix A item (mod domains, runes, quest choices, missing stats, quality caps, jewel crafting, Voices sockets, anoints, active weapon set, false ascendancy/budget warnings) and the two new warnings in §2.
- Changing the visibility vocabulary or any RLS/RPC.

---

## 10. Slices

Each slice merges on its own, keeps the full suite green, and ends in a repeatable E2E artifact (`playwright-report/results.json`). Per `AGENTS.md`: E2E is the test mechanism; for each slice the failure modes are written down first (below), then the code.

### Slice 1 — Build page shell, read mode

Route rework (§7.1 owner/reader paths), header (§5.1, no edit), five tabs with `?tab=` via `pushState`, checkpoint switcher (navigation only), tab bodies reusing today's read-only components where they exist (`ReadOnlyGemList` sorted main-first, `ReadOnlyGearList` as a stopgap until slice 4, `SharedTreePanel`, `SharedStatsPanel` content), tree export loaded after paint.

Failure modes to cover:
- Owner opens their own **unlisted** build via its token and gets 404 (today's behaviour) — must render in owner mode.
- A non-owner opens an unlisted build's token — must 404, same as a bad token.
- Tab switching triggers a server request or increments the view count (assert no document/RSC request and an unchanged `view_count` across five tab taps by a second viewer on a public build).
- Back button after two tab switches returns to the previous tab, not the previous page.
- Deep link `?tab=gear&checkpoint=<second>` lands on Gear showing the second checkpoint's items (pair with a first checkpoint that differs, so a wrong default cannot pass).
- Overview, Gear, Skills render with the tree export blocked (route the fetch to fail); Tree and stats show their loading/error states.
- 375px: no horizontal scroll; every tab, chip and link ≥ 44px, with the scan asserting a non-zero count (`measureTapTargets.scanned`).
- Signed-out visitor is redirected to `/login`.

### Slice 2 — Edit in place

Session provider (§6.1), tree state lifted (§6.2), Edit/Done and Save in the header, name/level/league/notes editing, drafts, `/tree?build=` redirect (§7.2), link updates.

Failure modes:
- Edit gear on the Gear tab **without ever opening the Tree tab**, Save, reload: gear persisted **and the tree is unchanged** (the tree must not be saved empty).
- Allocate nodes on Tree, switch to Gear, change an item, back to Tree: allocation still there; Save; reload: both persisted.
- Unsaved edits, reload: restore prompt appears; Restore brings back tree, gear and gems.
- Done with unsaved changes → Discard: page shows the saved state and the draft is gone after a reload.
- `?edit=1` on someone else's (public) build: no edit controls, and `POST /api/builds` for it is still refused (existing ownership rule).
- `/tree?build=<own id>` redirects to the build page's Tree tab in edit mode; `/tree?build=<someone else's id>` shows "could not be found".
- The protected scenarios in `build-persistence.spec.ts` and `loadout-persistence.spec.ts`, moved to the new page, all still pass.

### Slice 3 — Checkpoint switcher management

Add / rename / reorder / delete in the switcher menu (§6.4); `CheckpointsSheet` retired.

Failure modes: the existing `checkpoints.spec.ts` scenarios (add, divergent trees across a full reload, reorder, share-link rendering of two stages, last-checkpoint refusal) moved to the switcher; switching with unsaved changes keeps them as a draft on the checkpoint they belong to and not on the one switched to.

### Slice 4 — Gear paper doll

§5.4 on phone and desktop; jewels section; collapsed warnings chip; slot tap → existing picker/editor.

Failure modes: a 1×1 slot under 44px at 375px; horizontal scroll; an occupied off-hand (two-hander) still tappable as empty; Set I/Set II toggle showing the wrong set's weapons; `item-craft.spec.ts` and `validation.spec.ts` flows broken by the move.

### Slice 5 — Skills rows

Compact rows, main skill first (§5.2), per-group editor sheet.

Failure modes: main skill not first after reordering or after changing which group is Main; the momentsZX import (10 groups) taller than about 1.5 phone screens in read mode; level/quality/sets edits lost on sheet close.

### Slice 6 — Overview

Main skill group, key items, notes (editable), tags, empty-state calls to action.

Failure modes: a build with no gems or gear shows blank boxes instead of calls to action; notes edits not saved with the rest; the Overview of the imported build does not fit in about one phone screen above the notes.

### Slice 7 — Library, nav, new build, import, scratch

Cards (§8.3), New build sheet (§8.1), import summary and landing (§8.2), nav change (§8.4), scratch planner on the shell (§7.3).

Failure modes: New build lands anywhere but the new build's Overview in edit mode with the chosen class/ascendancy; import lands on the tree; the library card's primary link under 44px (the regression `mobile-layout.spec.ts` once missed because the account was empty — seed a build before scanning); `/tree` no longer reachable; scratch Save creating two rows on a double tap.

### E2E specs that will move

`sharing`, `checkpoints`, `pob-import`, `stats`, `validation`, `item-craft`, `build-persistence`, `loadout-persistence`, `draft-and-auth`, `mobile-layout`, `desktop-layout`, `cross-site` (from the handoff; confirmed by grep: all of these except `stats`, `validation` and `item-craft` link `/tree` directly, and those three drive the sheets whose selectors move). Each slice updates the specs its change touches, and keeps the three "passed while broken" guards in `CURRENT-STATE.md` §"Three ways a test here has passed while broken".

---

## 11. Risks

- **Tree state lift (§6.2)** is the riskiest change: it touches the code the six data-loss fix rounds were about. Slice 2 must land the "edit without visiting Tree" scenario before anything else in that slice.
- **Tree remount cost** on phones (§6.2). Measured in slice 2; fallback defined.
- **Two pages during migration.** Until slice 7, `/tree` scratch still renders the old overlay UI. Acceptable; it is off the main path once slice 2 redirects `?build=`.
- **Vercel storage is full** (user, 2026-09-27): merges to `main` may not deploy. Verification is local and E2E.
