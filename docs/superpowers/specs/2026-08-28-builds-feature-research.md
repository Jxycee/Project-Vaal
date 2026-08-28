# Builds feature — `.build` export research & competitor survey

**Status:** Research complete for `.build` format + console viability. Competitor survey in progress (two background agents dispatched 2026-08-28; findings to be folded in below once they report). No code written yet — this doc gates the implementation plan.

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
| `inventory_slots[].unique_name` / `.additional_text` | `gear_state.<slot>.name` / `.mods` | Lossy by design — `.build` has no structured mod-list field, only free text. Fine for uniques (`unique_name`), rares degrade to a text blurb (same lossiness every third-party tool accepts). |

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

## 6. Competitor survey — in progress

Two background research agents dispatched (2026-08-28) to survey:
- **Agent A** — in-game/tool ecosystem: poe2buildplanner.com, Mobalytics PoE2 Planner, Maxroll PoE2 Planner, natwarth's PoE2 Skill Tree Planner, `poe2-tools/poe2-build-planner`, and adjacent open-source `.build` tools — feature sets, `.build` I/O quality, sharing model, mobile-friendliness.
- **Agent B** — discovery/sharing/permission UX: poe.ninja's build explorer, Maxroll's guide hub, Mobalytics build hub, GGG's own subscribe/upload UX, and cross-domain precedent (GitHub-gist-style fork/copy patterns) specifically for the owner-edits/others-view-or-fork permission model and for build-finder discovery UX (filters, tags, sorting).

Findings to be appended below as **§6.1 / §6.2** once both report back, followed by a synthesized recommendation and route/schema plan for `/builds`.

*(placeholder — do not treat this doc as final until this section is filled in)*
