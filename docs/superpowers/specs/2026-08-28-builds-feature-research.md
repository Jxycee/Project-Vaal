# Builds feature — `.build` export research & competitor survey

**Status:** Research and competitor survey complete (2026-08-28). Phased implementation plan drafted in §8; §9 lists decisions needing sign-off before Phase 1 starts. No code written yet — this doc gates the implementation plan.

**Feeds into:** `docs/superpowers/plans/poe2-console-hub-plan7_12_2026.md` §7 (route structure), §8.1 (build save/share flow), §11 (RLS), §12 (decisions log) — this doc extends that plan's `/builds` section rather than replacing it.

---

## 1. What we're trying to do

Two related but distinct deliverables on a build page:

1. **A `.build` file download** — GGG's own in-game Build Planner format. Lets a player get Project Vaal's passive/gem/gear plan showing as a guided line on their actual in-game passive tree.
2. **A Project Vaal build link** (`project-vaal.xyz/builds/<shareToken>`) — our own hosted, read-only view of the build on our site. Already scoped in the console-hub plan (§8.1); **not** the same artifact as the `.build` file, doesn't touch the game at all, just a shareable page.

The open question this session started with: **does (1) even work for console players**, since Project Vaal's whole audience is PS5/Xbox players who can't run desktop tools or touch a PC filesystem.

---

## 2. `.build` file format — confirmed schema

Verified against a real GGG-authored sample file (not secondhand paraphrase) by cloning `poe2-tools/poe2-build-planner` (github.com/poe2-tools/poe2-build-planner — MIT, open source, lossless `.build` parser/serializer) and reading `src/buildfile/types.ts`, `parse.ts`, `serialize.ts`, plus `Builds/sample.build` (a GGG-authored "Titan Warrior" build) and `Builds/Fubgun Ice Shot - Campaign.build`.

Plain UTF-8 JSON, `.build` extension, tolerant parser (unknown keys ignored, not rejected):

```ts
interface Build {
  name: string;                // required
  author?: string;
  description?: string;
  ascendancy?: string;         // GGG ascendancy id, e.g. "Warrior1", "Ranger1"
  passives: Passive[];
  skills: SkillSetup[];
  inventory_slots: Item[];     // legacy alias "items" also accepted by parsers
}
interface Passive {
  id: string;                   // bare string shorthand for {id} also valid
  weapon_set?: 1 | 2;           // omitted = both/global
  level_interval?: [number, number];
  additional_text?: string;
}
interface SkillSetup {
  id: string;                   // "Metadata/Items/Gems/SkillGemEarthquake"
  level_interval?: [number, number];
  support_skills?: SupportGem[];  // same shape, nested
  additional_text?: string;
}
interface Item {
  inventory_id: string;         // "Weapon1", "BodyArmour1", "Boots1", "Helm1",
                                 // "Gloves1", "Belt1", "Ring1", "Ring2", "Amulet1"...
  unique_name?: string;
  additional_text?: string;     // freetext mod plan for non-uniques (no structured mod list)
  level_interval?: [number, number];
}
```

No signature, no checksum, no compression — trivial to generate server- or client-side.

### Mapping from Vaal's existing `builds` row → `.build`

| `.build` field | Vaal source | Status |
|---|---|---|
| `passives[].id` (string, e.g. `"AscendancyWarrior3Small1"`) | `passive_state.set1`/`set2` store the **numeric** `skill` id | **Free lookup, already solved.** Checked `public/data/tree/0.5.2/data.json` (already vendored) — every node object carries *both* `"skill": 5386` (numeric, what we store) and `"id": "AscendancyWarrior3Small1"` (string, what `.build` wants). No new data source needed. |
| `passives[].weapon_set` | which of `set1`/`set2` the node is in | Node in both → omit (global). Direct. |
| `ascendancy` | Vaal's `class`/`ascendancy` column | Needs a small static lookup table, Vaal ascendancy name → GGG id (`Warrior1/2/3`, `Ranger1/2`, etc.). One-time, cheap. |
| `skills[].id` | `gem_state.slots[].skill.id` | **Gap.** `.build` wants the full `Metadata/Items/Gems/SkillGem...` path. Checked `public/data/wiki/*/skills/*.json` (our vendored gem data) — has slug/name/icon, **no GGG Metadata path**. Need to source this separately (poe2-toolkit extraction, or GGG patch data) before gem export can work. |
| `inventory_slots[].unique_name` / `.additional_text` | `gear_state.<slot>.name` / `.mods` | Lossy by design — `.build` has no structured mod-list field, only free text. Fine for uniques (`unique_name`), rares degrade to a text blurb (same lossiness every third-party tool accepts). **Vocabulary correction (§6.1):** `chesler410/poe2-build-forge` derived the real `inventory_id` vocabulary from GGG-accepted fixtures, not docs — `Weapon1`/`Weapon2` (two-handed = `Weapon1` alone; a shield/quiver/focus also just uses `Weapon2`, **there is no separate `Offhand` key**), `Helm1`/`BodyArmour1`/`Gloves1`/`Boots1` (suffixed but singular), only rings actually increment (`Ring1`/`Ring2`). Our `gear_state` shape (console-hub-plan §6) currently has distinct `offhand1`/`offhand2` keys — **needs a translation step at export time, not a schema change**: fold `offhand*` into `Weapon2` when serializing to `.build`. |

---

## 3. Console viability — CONFIRMED, was the blocking question

Two distinct delivery mechanisms exist. Do not conflate them:

### 3a. Local file-drop — **PC-only, ruled out**

`.build` files placed in `Documents\My Games\Path of Exile 2\BuildPlanner\` are picked up by the in-game Build Planner (press **P** → Build Planner button → pick file → guided blue line on the tree). This was the *only* mechanism at Build Planner's 0.5.0 launch ("Return of the Ancients", ~May 2026) and requires local PC filesystem access. Console players hit this wall immediately — there's a live PoE forum thread, *"Early Access Feedback – Console – How are we supposed to be using the build planner feature on ps5"*, from players asking exactly this. **Confirmed dead end for our audience if it were the only option.**

### 3b. Website upload/subscribe — **cross-platform, including console**

GGG shipped a fix for exactly this gap, ~patch 0.5.3+: `pathofexile2.com` → **My Account → Builds → Upload Build**. A `.build` JSON file uploaded through the browser (any device — doesn't need to be the console itself) syncs into the in-game Build Planner on **PC and console alike**, because it's tied to the account, not a filesystem. There's also a parallel "Subscribe" flow where a build-guide site's own page has a Subscribe button.

Primary-ish source — GGG's official X/Twitter account:

> "You no longer need to download build files! We've implemented a new feature that allows you to subscribe to build guides on the website and receive all updates automatically in the game on **both PC and Consoles**."

Corroborated independently across several guide sites (all separately describing the same `pathofexile2.com/my-account/builds/upload` page, same "since 0.5.3" detail, same "both PC and Consoles" phrasing) — consistent enough across independent sources to trust, but **not independently eyeballed by us**: `pathofexile2.com` and `pathofexile.com` are both blocked by this sandbox's network egress policy, so we could not load the actual upload page or GGG's developer docs ourselves. **Action item: a human should open `pathofexile2.com/my-account/builds/upload` once before we ship, to confirm the real UI and any file-size/validation limits** (one source noted "uploading a file does not repair it — an outdated or malformed file may still fail," implying real server-side validation).

### 3c. What this means for the feature

`.build` generation is still worth building. What changes is the **instruction copy**, not the mechanism:

- ❌ ~~"Download this file and drop it in your PC's BuildPlanner folder"~~ — unusable copy for a console player, would actively mislead our own audience.
- ✅ "Download this `.build` file, then upload it at `pathofexile2.com` → **My Account → Builds → Upload Build**. It'll sync to your PS5/Xbox automatically." Works identically whether the player is on PC or console, since upload just needs *a* browser, not the game's own platform.

**Not building against:** the one-click "Subscribe" flow (no download step at all, pushed directly from a third-party site) requires a GGG "account-linked API." Checked a comprehensive community-maintained PoE OAuth client library (`moepmoep12/poe-api-ts` — documents every endpoint GGG's public OAuth API exposes: characters, stashes, leagues, ladders, trade, accounts, guild, pvpmatches). **No builds/guides endpoint exists in the public API.** That Subscribe button looks like a GGG-side partner integration (the kind Mobalytics/Maxroll likely have via direct arrangement), not something open to arbitrary third-party developers today. Treat as a future stretch goal to raise with GGG directly, not a v1 dependency — v1 ships on the manual-upload flow (3b), which needs zero GGG partnership.

---

## 4. Project Vaal build link vs. `.build` file — two separate artifacts

Don't conflate these in the UI or in our own heads:

| | `.build` file | Project Vaal build link |
|---|---|---|
| What it is | GGG-format JSON, downloaded, then uploaded to `pathofexile2.com` | `project-vaal.xyz/builds/<shareToken>` — our own page |
| What it does | Draws the guide line **in the actual game client** | Shows the build **on our site** — read-only viewer |
| Already scoped? | No — new work (this doc) | Yes — console-hub-plan §7/§8.1 already specs `/builds/[shareToken]` as a read-only shared viewer, `share_token` generated via nanoid on first save, RLS already allows anon SELECT on public rows |
| Editable by | N/A (static export) | Only the owning `user_id` — everyone else gets view-only |

The build page should offer **both**, clearly labeled as different things: "View on Project Vaal" (our link, always available once saved+public) and "Export .build" (GGG file, for in-game use).

---

## 5. New requirement this session: fork / "copy as your own"

Not yet in the existing plan doc or schema. Requirement: a build's owner always gets an Edit button; anyone else viewing via the share link gets View + a **"Copy to My Builds"** action that clones the build's `passive_state`/`gear_state`/`gem_state` into a brand-new row owned by the copier — independent from that point on, not a live fork.

Open schema/design questions (to resolve once competitor research on permission-model UX comes back):
- Does the new row need a provenance pointer back to the source build (e.g. a nullable `forked_from` column), for a "based on: <original>" credit line? Not in current schema.
- Does copying require auth (yes, per existing "no anonymous saves" rule — §12 of the console-hub plan) — so the flow is: view (works anon on public builds) → click Copy → if not logged in, redirect through `/login?redirect=...` same as the existing Save flow.
- Does the copy default to private (`is_public = false`) regardless of the source's visibility, or inherit it? Leaning private-by-default (safer, matches "user should have to opt in to publishing," consistent with new builds always starting private until first explicit share) — to be confirmed against competitor-pattern findings.
- `view_count` should NOT carry over to the copy — it's a fresh row, fresh counter.

---

## 6. Competitor survey

Two background research agents dispatched 2026-08-28, both complete: **§6.1** (in-game/tool ecosystem) and **§6.2** (discovery/sharing/permission UX) below.

### 6.1 In-game/tool ecosystem

Full agent report archived at `/tmp/claude-0/-home-user-Project-Vaal/8e53c7b9-243d-533e-aff3-eac726cdc5ea/scratchpad/research-ingame-tools.md` for this session's lifetime.

| Tool | Tree editor | Gems/gear | Per-level state | Discovery | `.build` I/O | Sharing | Mobile |
|---|---|---|---|---|---|---|---|
| poe2buildplanner.com | No | No | No | Class/ascendancy catalogue | Export only (PoB→`.build`, client-side) | File download, credits source PoB | Fine (static list) |
| Mobalytics PoE2 Planner | Yes | Yes | **Build Tracker** — account-linked step-by-step | Creator + community, tier list | Export + subscribe flow | Permanent URL, anon | Decent, ad-heavy, tracker behind a trial |
| Maxroll PoE2Planner | Yes + respec recorder | Yes + progression steps | Progression/respec steps | Maxroll + community, ratings | Character import from game + `.build` export | Permanent URL, anon | Usable, ad-heavy |
| natwarth/poe2-skilltree | Yes (0.4→0.5 diff highlight) | Wizard steps | No | No | Import + export | File download only | **Best touch handling of the set** |
| poe2-tools/poe2-build-planner | Yes, ~5,100 nodes, shortest-path auto-alloc | Yes | **Per-level "build profiles"** — first-class range snapshots | No | Lossless round-trip, unknown-field passthrough | File download only | Poor — hover/right-click |
| chesler410/poe2-build-forge | No (converter/editor) | Labels only | Per-entry `level_interval` editing | No | **Best `.build` fidelity** — JSON Schema + Ajv, fixtures over docs | URL-hash share, no backend, PWA offline | Explicitly responsive |
| GepetoinTraining/poe2-graph, Gsolisen/poe2-theorycraft | Graph ops / search-only | Yes / uniques search | Goal DAG / no | Guide catalog / local DB | Read+write `.build` / export | Local/Electron / localhost only | N/A — desktop-native, off-audience |

**The pattern that matters most:** every serious tool treats **following a build while leveling** (Mobalytics' Build Tracker, Maxroll's progression/respec steps, `poe2-build-planner`'s per-level profiles, `.build`'s own `level_interval` field on nearly every entry) as core, not an afterthought — a build with no level ranges is a screenshot, one with them is a guide. And **nobody has solved mobile**: every planner assumes hover, right-click, and a desktop viewport, except natwarth's canvas — pointer events, pinch-zoom, and a clean **two-tap allocation model** (tap = select + preview path, tap again = commit) — which is the one genuine touch interaction pattern worth copying outright.

`poe2-build-forge`'s ground-truth-over-docs methodology (validating the schema against real GGG-accepted files rather than the dev docs) is also where the §2 inventory-slot vocabulary correction above came from — worth trusting over anything self-reported by GGG's own docs page, which we've been unable to load directly in this sandbox anyway.

### 6.2 Discovery, sharing & permission UX

Same network caveat as everywhere else in this doc: gaming domains are egress-blocked in this sandbox, so this is WebSearch-indexed synthesis, not first-hand page inspection. Full agent report archived at `/tmp/claude-0/-home-user-Project-Vaal/8e53c7b9-243d-533e-aff3-eac726cdc5ea/scratchpad/research-sharing-ux.md` for this session's lifetime.

**What competitors actually do:**

- **poe.ninja** — not user builds at all, snapshots live ladder characters from GGG's public API. Discovery is faceted drill-down (class/ascendancy/skill/uniques/keystones), each facet showing **% of characters using it**, with an exclude toggle once applied. Plus a tree **heatmap** (% of characters per node). Strongest discovery-UX lessons of the set, trivial permission model (all public, nothing editable).
- **Maxroll (PoE2)** — two separate systems: editorial guides/tier-lists (class/ascendancy/meta facets, editor-ranked), and a planner with **"Maxroll Builds" vs. "Community Builds"** tabs. Their D4 planner's documented flow is literally "clone it to your account to modify" — owner-edits/others-clone, entry point on the guide page itself.
- **Mobalytics (PoE2)** — closest structural analogue to our plan: `/community-builds` (raw feed) separate from `/creator-builds` (vetted) separate from an editor planner. Feed filters **Class/Ascendancy/Build Type**, sorts **Trending/Top/New** with a time window. Browsing is anonymous; publishing needs an account. No confirmed clone/fork button — an opening for differentiation.
- **GGG's own pathofexile2.com Build Planner** — the most instructive model, and the one our audience already knows. **My Account → Builds** literally segments two lists: **guides you uploaded** vs. **guides you subscribed to**. Subscribing is a live link (auto-updates when creator revises, but is read-only — you cannot fork a subscription, only re-author your own file). GGG explicitly does not curate/rank/endorse uploaded builds.
- **PoB / pobb.in** — opaque paste-code, no owner concept at all. "Editing" = import, change, re-export a new code. Also why console players are stranded there — PoB is Windows desktop, which is exactly the gap Project Vaal exists to fill.
- **Cross-domain fork precedent (CodePen, Gists, Figma Duplicate, Google Docs "Make a copy")** converge on three signals: read-only chrome so viewers never think they're editing, one obvious duplicate affordance, attribution back to source. UX-writing consensus favors **"Duplicate"/"Save a copy"** over "Fork" for general audiences — our **"Copy to my builds"** beats both since it names the destination.

**Build finder facets, priority order** (all URL-serializable — shareable + SSR-cacheable): Class → Ascendancy (dependent select, highest value everywhere) → **main skill** (gap — see schema note below) → `game_version` (default-pinned to current patch; stale-build noise is the top EA complaint) → tags (seed a controlled vocabulary — `league-start`/`budget`/`boss-killer`/`mapper`/`hardcore`/`ssf`/`endgame`/`leveling` — while keeping the column freeform) → level range. Sort: Trending/Popular/Newest/Most-copied, Trending as a decayed score (views + weighted bookmarks/copies over build age), not raw `view_count`. Mobile: filters in a bottom sheet with an active-count pill, cursor pagination not page numbers.

**Shared-build viewer:** make read-only state loud — sticky header with author + explicit read-only badge, a genuinely different denser read layout rather than disabled-looking editor controls, primary CTA **"Copy to my builds"** with Bookmark/Share secondary. Owner viewing their own link sees **Edit** instead. Show `view_count`, `game_version` (warning chip if stale), last-updated.

**Fork/copy flow — this resolves the open questions from §5:**
- Logged out → show the button anyway; route through sign-in with a `next` param and complete the copy automatically post-auth (losing intent at the auth wall is the top drop-off point everywhere this was studied).
- Deep-copy `passive_state`/`gear_state`/`gem_state`/`class`/`ascendancy`/`level`/`league`/`game_version`/`description`/`notes` + `build_tags` rows. **Do not** copy `share_token`, `view_count`, `is_public`, or `character_id` (that last one points at the *original author's* character — copying it would misattribute).
- Name defaults to `"<original> (copy)"`.
- **Copy defaults to private** (`is_public = false`, `share_token = NULL`) regardless of source visibility — every precedent that defaults public to a spam problem in the finder. Confirms the leaning noted in §5.
- Execute server-side in one transaction (RLS reads the source under the viewer's own SELECT policy, writes `user_id = auth.uid()`) — never accept client-POSTed state as an unvalidated create payload.

**Schema gaps identified, ranked by value:**
1. **`forked_from uuid REFERENCES builds ON DELETE SET NULL`** + denormalized `forked_from_name`/`forked_from_user` (provenance must survive the source being deleted/unpublished) — render "Forked from *Name* by *Author*", linked only while source stays public.
2. **`copy_count int`** — better quality signal than views; also gives "Most copied" sort for free.
3. **`main_skill text`** (derived from `gem_state.slots[0].skill` at save time) — needed for the single most-used filter across every competitor; without it the finder is markedly weaker.
4. **`published_at`** — `created_at` is wrong for "Newest" once drafts/private builds exist.
5. **`trending_score numeric`**, periodic recompute (a live expression won't index).
6. **Ratings/likes: skip for v1.** `build_bookmarks` already gives a per-user positive signal with no moderation surface; `copy_count` is a stronger intent signal than a like. A public like system needs abuse/brigade/report handling — bigger lift than the discovery gain justifies now.

**Blocker to settle before building the viewer route** (not just a nice-to-have): the existing RLS SELECT policy is `is_public = true` — a `share_token` alone currently grants **no read access** on a non-public build. If "unlisted, link-only" is meant to be a real third visibility state (which is what most people mean by "share link," and matches the console-hub plan's "Copy Link (unsaved)" ephemeral-share framing), the table needs either a `visibility` enum (`private`/`unlisted`/`public`) with a token-aware policy, or a `SECURITY DEFINER` function that checks the token server-side. This changes the `/builds/[shareToken]` data-fetch path, not just a column addition — needs a decision before that route gets built.

Sources: [poe.ninja builds launch](https://poe.ninja/posts/launching-builds), [Maxroll PoE2 planner community builds](https://maxroll.gg/poe2/news/maxroll-and-community-builds-added-to-the-poe2planner), [Maxroll D4 planner](https://maxroll.gg/d4/planner), [Mobalytics community builds](https://mobalytics.gg/poe-2/community-builds), [GGG developer docs](https://www.pathofexile.com/developer/docs/game), [PCGamesN on build subscriptions](https://www.pcgamesn.com/path-of-exile-2/build-import-subscriptions), [MMOJUGG build planner guide](https://www.mmojugg.com/news/seamlessly-import-export-build-files-ultimate-poe2-build-planner-guide.html), [pobb.in](https://pobb.in/), [CodePen forking docs](https://blog.codepen.io/docs/pens/forking/), [CodePen forking clarity](https://blog.codepen.io/2014/05/05/forking-clarity/), [NN/g UI copy](https://www.nngroup.com/articles/ui-copy/), [copy vs duplicate in UX writing](https://uxwritinghub.com/copy-vs-duplicate-ux-writing/)

Sources (§6.1): [poe2buildplanner.com](https://poe2buildplanner.com/), [Mobalytics PoE2 Planner](https://mobalytics.gg/poe-2/planner/builds), [Mobalytics Build Tracker](https://mobalytics.gg/lol/glp/poe2-build-tracker), [Maxroll PoE2 Planner](https://maxroll.gg/poe2/planner), [Maxroll planner news](https://maxroll.gg/poe2/news/maxroll-and-community-builds-added-to-the-poe2planner), [Maxroll in-game Build Planner guide](https://maxroll.gg/poe2/getting-started/how-to-use-the-in-game-build-planner), [natwarth/poe2-skilltree](https://github.com/natwarth/poe2-skilltree), [chesler410/poe2-build-forge](https://github.com/chesler410/poe2-build-forge), [GepetoinTraining/poe2-graph](https://github.com/GepetoinTraining/poe2-graph), [Gsolisen/poe2-theorycraft](https://github.com/Gsolisen/poe2-theorycraft), [MMOJUGG subscribe/upload guide](https://www.mmojugg.com/news/seamlessly-import-export-build-files-ultimate-poe2-build-planner-guide.html)

---

## 7. Synthesis — Project Vaal's identity for this feature

Positioning that falls out of the research, not assumed going in: **the build tool you use on your phone while playing on the couch — following beats authoring.** Every competitor treats the tree/gem/gear editor as table stakes and differentiates on what happens *after* — stepping through a build while leveling. Every competitor also fails mobile touch interaction outright except one small OSS tool. Both are openings, not just gaps: our audience (console, phone-adjacent, no desktop) makes "authoring-first, desktop-shaped" tools actively unusable for the people we're building for, so being follow-first and touch-first isn't a stylistic choice, it's the only version of this feature that actually serves Project Vaal's stated audience.

Concretely, under the existing project rules (§15 original-art, no-DPS, mobile-first, account-required-except-/prices):

- **Reuse, don't fork, the tree renderer.** `src/components/tree/PassiveTree.tsx` (from the `/tree` milestone) is already the touch-correct, on-brand renderer. `/builds` should consume it, not build a second one — matches the original passive-tree plan's own intent ("Renderer + overlay stay reusable for `/builds/new`", console-hub-plan §Architecture).
- **"Safe stats only, no DPS" reads as principled here too**, matching `poe2-graph`'s explicit "PoB owns simulation, we own planning" handoff posture — frame it that way in copy, not as a limitation.
- **Original chrome stays original**: bottom sheets, the follow-mode stepper, tab bar, empty states, share cards — all ours. Nobody in the survey has a real touch-first visual language to accidentally borrow from, which is a genuine chance to look like nothing else in this space rather than another gold-parchment PoE skin.
- **Console is the moat, not an afterthought.** Every competitor treats the `.build`-to-console path (§3) as a bare file download at best. Making that 3-step "download → upload at pathofexile2.com → syncs to your PS5/Xbox" flow genuinely easy on a phone (copy-to-clipboard instructions, no jargon) is a real differentiator, not busywork.

## 8. Phased implementation plan

Scope this in two passes rather than one large cut — the research surfaced real complexity (per-level state, `.build` export, fork semantics) that would make a single "ship /builds" milestone too large to review well, in keeping with this project's own stated build discipline (see the passive-tree milestone's staged/discovery-gated structure).

### Phase 1 — Save, share, view, fork (extends console-hub-plan §7/§8.1 as written, no new mechanism)

Builds on what's already scoped: `/builds` finder, `/builds/new`, `/builds/[shareToken]` viewer, `(dashboard)/builds/[buildId]` editor, `POST/GET/PATCH/DELETE /api/builds`. What Phase 1 adds on top, informed by §6:

- **Fork/copy flow** (§5, resolved by §6.2): "Copy to my builds" button on the viewer for non-owners, deep-copies `passive_state`/`gear_state`/`gem_state`/`class`/`ascendancy`/`level`/`league`/`game_version`/`description`/`notes`/`build_tags`, excludes `share_token`/`view_count`/`is_public`/`character_id`, defaults private, server-side transaction under RLS, redirects through login if needed and completes post-auth.
- **Build finder facets**: Class → Ascendancy → main skill → `game_version` (pinned to current patch by default) → tags (seeded vocabulary, freeform column) → level range. Sort: Trending (decayed score) / Popular / Newest / Most-copied.
- **Viewer chrome**: explicit read-only badge + "Viewing `<author>`'s build", sticky Copy/Bookmark/Share CTAs for non-owners, Edit for the owner, `game_version` staleness warning chip.

### Phase 2 — `.build` export + console delivery flow

- Server-side (or client-side, TBD in implementation) serializer: `builds` row → `.build` JSON, using the corrected inventory-id vocabulary (§2) and the numeric→string passive-id lookup already free from vendored tree data.
- Gated on closing the gem-id gap (§2) — need `Metadata/Items/Gems/...` paths sourced before gem setups can round-trip; passives-only export could ship first if gems lag.
- "Get this on your console" flow: download `.build` → guided instructions for `pathofexile2.com` → My Account → Builds → Upload Build, written for a phone screen (copy-to-clipboard filename, no PC-centric language). **Do not ship this copy until a human has actually opened that upload page once** (§3b's outstanding verification item) — wrong instructions here actively harm the exact audience this project serves.

### Phase 3 — Follow mode (stretch, informed by §6.1 but not blocking Phase 1/2)

Per-level stepper view (level slider or Next/Prev) over `level_interval`-tagged passives/gems, in the spirit of `poe2-build-planner`'s "build profiles" and Maxroll's progression steps — but only after Phase 1/2 ship and are validated, since it implies real schema work (per-level snapshots don't fit today's flat `passive_state`/`gear_state`/`gem_state` shape) that shouldn't be speculatively pre-built.

## 9. Open decisions — needs a call before Phase 1 starts

| Decision | Options | Recommendation |
|---|---|---|
| Unlisted/link-only visibility | Add `visibility` enum + token-aware RLS policy, **or** treat "share" as always-public | Add the enum — matches what users actually mean by "share link," and the console-hub plan's own "Copy Link (unsaved)" framing already implies link-only semantics for ephemeral shares; a saved build's permanent link should behave the same way |
| `forked_from` provenance | Add nullable FK + denormalized name/author, or skip provenance entirely | Add it — cheap, matches every fork-pattern precedent in §6.2, and "based on `<build>`" is expected, not optional, once forking exists |
| `main_skill` column | Derive at save time from `gem_state.slots[0]`, or skip and filter client-side | Derive and store — the single highest-value finder filter across every competitor; client-side filtering doesn't scale past a trivial build count |
| Gem `Metadata/Items/Gems/...` id source | Block Phase 2 on sourcing it, or ship passives-only `.build` export first | Ship passives-only first (still console-usable — a tree-only guide line is real value), backfill gem export once the id source is solved |
| Ratings/likes on builds | Build now alongside bookmarks, or defer | Defer — `build_bookmarks` + new `copy_count` already give ranking signal without a moderation/abuse surface |

---

*Research phase complete pending the two open verification items: (1) a human opening `pathofexile2.com/my-account/builds/upload` once to confirm the real UI (§3b), (2) the §9 decisions table getting a sign-off before Phase 1 implementation starts.*
