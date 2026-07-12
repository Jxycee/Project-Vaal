# Session Handoff — 2026-07-12

**Read this first if you're picking this project up cold.** It's a bridge document — what happened this session, what's still in-flight, and exactly what to check before doing anything else. The plan doc (`docs/superpowers/plans/poe2-console-hub-plan7_12_2026.md` — **note the filename changed**, was `..._7_11_2026.md`) is still the authoritative source for product/technical decisions; this doc is process and continuity, not a second copy of it.

-----

## Do this first — verify state before starting new work

I (the previous session) cannot run shell commands on this machine — everything below was applied via file edits, verified individually, but **never run end-to-end by me as a whole**. Before trusting any of it:

```powershell
cd C:\Dev\project-vaal
git status
npm run type-check && npm run lint && npm test && npm run build
```

As of the end of the previous session, Jaycee had confirmed all of this passing and the tree's class-switch/allocation behavior looked correct after the last fix — but **confirm current git status first**. Several rounds of fixes landed in one sitting (PWA implementation, then a chain of bugs found via real testing, then a cross-page performance pass, then a tree bug from an earlier fix, then this doc update), and it's worth double-checking nothing was left half-committed. If `git log` doesn't show commits matching the work below, that work may still be sitting as uncommitted changes.

**Branch:** this was all done on `feat/pwa-serwist` (created mid-session for the PWA work, then reused for everything after since it was mostly one continuous sitting). Confirm whether it's been merged to `main` yet.

-----

## What happened this session, briefly

1. **Codebase health pass** (before any feature work) — found and fixed: a price-sync cron bug (firing hourly at `:17` instead of the documented twice-hourly `:00/:30`), a `proxy.ts` matcher gap that made every tree-asset fetch pay for an unneeded Supabase auth round-trip, a stale hardcoded app version duplicated into a User-Agent string, a stale `passive_state` default in `supabase/schema.sql`, a from-scratch README (was 100% unedited boilerplate), two dead/duplicate files flagged for manual deletion (`src/app/(dashboard)/actions.ts` and root-level `lib/utils.ts` — **check whether these were actually deleted**, since I don't have a delete tool and could only ask Jaycee to run the `Remove-Item` commands), a version bump (`0.1.0` → `0.2.0`), and CI now runs `npm test` (previously had zero test files despite the infra existing).

2. **PWA support via Serwist** — full design + implementation. `@ducanh2912/next-pwa` (was installed, unused) removed; `@serwist/next` + `serwist` added. Scope is deliberately **installable-only**: manifest + icons + a minimal precache-only service worker — no offline caching of tree/prices data, no push notifications. Full design rationale: `docs/superpowers/specs/2026-07-12-pwa-serwist-design.md`. Implementation plan: `docs/superpowers/plans/2026-07-12-pwa-serwist.md`.
   - Real bugs hit and fixed along the way, in order: (a) `tsconfig.json` needed `"webworker"` added to `lib` for the service worker's types; (b) `next.config.ts` needed an explicit empty `turbopack: {}` — Serwist's `webpack` config key made `next dev` hard-error on startup once the build switched to `next build --webpack`; (c) ESLint was linting Serwist's generated `public/sw.js` as if it were hand-written source (fixed by excluding `public/**`); (d) `public/sw.js` wasn't in `.gitignore` (fixed, though it turned out to not be tracked yet anyway).

3. **Cross-page performance pass** — triggered by Lighthouse showing a 75 performance score and a 10.3s LCP on the landing page, caused by a 1024×1024, 1.39MB `vaal-emblem.png` served via a bare `<img>` tag. Converted to `next/image` (this specific fix, on the landing page, was **already done before I could get to it** — turned out to be pre-existing when I checked, worth asking Jaycee who/what did it, I never got a clear answer). Then found the *same* image loading unoptimized on **every other page** (`/prices`, `/dashboard`, `/tree`) via the shared `ShellChrome`'s `Brand` component (sidebar + mobile header logo) — fixed that at the source, which covers all three pages at once. Also converted the dashboard's divider image and the prices page's empty-state illustration. Left the prices page's per-row currency icons (remote, from `web.poecdn.com`) as plain `<img>` deliberately — Lighthouse never flagged them, they're already small + lazy-loaded, and converting many small frequently-changing remote icons to `next/image` trades a non-problem for a new one.

4. **Passive tree bug — found, broken, then properly fixed.** Investigating `/tree`'s own TBT led to finding `PassiveTree.tsx` called `buildScene()` twice on every mount/class-switch (once for real, once just to read `.mainBounds`). First fix attempt used `classBounds(scene, classId)` to scope this per-class — **this broke class selection for Witch/Sorceress and Ranger/Huntress specifically**, confirmed and reported by Jaycee via real usage. Root-caused precisely (see plan doc §8.5's new note): every class in this tree shares a start node with exactly one other class, and those two pairs are the only ones where *both* classes are real/selectable rather than one being a filtered-out legacy slot. Corrected fix: just read `scene.mainBounds` directly (no `classBounds` needed at all — `mainBounds` was never class-scoped to begin with). **This correction was Jaycee-verified working** before the session ended.

5. **A real, unresolved tree performance issue was found and documented, not fixed.** While chasing TBT on `/tree`, traced `@poe2-toolkit/tree-react`'s `TreeView.js` source directly and found it fully destroys and rebuilds the *entire* scene graph (1500+ nodes) on every relevant prop change, and — separately — its own internal image-loading effect triggers that same full rebuild *again* on each individual centre-art image's `onload`. This is almost certainly the dominant contributor to the repeated long tasks Lighthouse showed spread across ~4–11 seconds after load. It's real, it's understood, and it's **not fixed** — it needs a `patch-package` patch to `tree-react` making `rebuild()` incremental, which is a substantial rewrite of third-party scene-graph lifecycle code, not a quick fix. See the new §13 item in the plan doc for the full trace.

-----

## Passive tree checklist — what's left

Everything below already lives in plan doc §13 with full context; this is just the tree-specific subset pulled out since that's what was asked for.

- [ ] **Schema reconciliation** (blocks the next two items): `passive_state` shape `{set1, set2, ascendancyNodes}` (locked, §6) vs. `@poe2-toolkit`'s runtime shape `{allocated, weaponSets}`. This is a real design decision, not a wiring task — needs to happen before either of the next two.
- [ ] **localStorage working-state persistence** (no account/build needed) — blocked on the above.
- [ ] **Save-to-Build** (§8.6) — blocked on the above.
- [ ] **Point-budget / stat panel UI** (§5, §8.5) — allocation itself works; there's no point-counting, no main/ascendancy pool display, no level control, no "remaining" figure yet.
- [ ] **Mobile tooltip UX** — `NodeInfoPanel` only updates on tap, and a tap already allocates/deallocates, so there's no way to preview a node on a phone without committing. Needs a distinct preview gesture.
- [ ] **Credit label position** — small, contained fix. "Tree rendering via @poe2-toolkit — thanks, rajtik76" sits too far right; move it left in `PassiveTree.tsx`'s `creditLabels` memo (`centre.x + ring.frameRadius + 150` — reduce the offset). Good candidate for a quick win if you want one.
- [ ] **Abyssal Lich ascendancy** — missing from the picker. Root-caused already (§13): it reuses Lich's exact graph via an `overridePairs` table `@poe2-toolkit`'s ascendancy filter doesn't recognize as a valid shape. Needs a `tree-core` patch (recognize the shape, thread `overridePairs` into `AscendancyDef`) plus a `tree-react` render-layer patch (apply the override to what's actually drawn, not just displayed text).
- [ ] **`tree-react` full-rebuild performance issue** (new this session, see item 5 above) — needs its own scoped session; don't attempt as a quick fix.

None of these are blocked on each other except where noted (schema → persistence → Save-to-Build). The credit label is genuinely a 5-minute fix if you want low-hanging fruit; the rest are real scoped efforts.

-----

## Non-tree loose ends (mentioned for completeness — not this session's focus)

- GitHub repo housekeeping pass (description/README/topics — scope still TBD)
- Branded auth emails (needs Supabase Pro/SMTP + domain verification)
- Token encryption strategy (pg_crypto vs. Supabase Vault)
- poe2db.tw scraping legality/rate-limit strategy
- GGG API OAuth scope confirmation
- Light-mode toggle (low priority, deferred)
- PWA follow-ups if/when offline caching or push notifications are ever wanted (deliberately out of scope this session — see the design spec)

-----

## Lessons worth carrying forward

- **`classBounds` vs `mainBounds` mix-up:** if touching `PassiveTree.tsx`'s camera-framing logic again, remember `mainBounds` is *whole-tree*, not class-scoped — the shared-start-node pairing (every class pairs with exactly one other) makes any per-class geometry function in this tree risk breaking for whichever pair has two real/selectable classes.
- **Testing against the wrong server:** mid-session, a Lighthouse-adjacent check nearly went sideways because of stale browser cache from earlier dev-mode testing making a `npm start` (production) test look like it was still hitting `npm run dev`. A hard cache-bypassed reload (`fetch(url, {cache:'reload'})` + checking response headers) resolved it cleanly. Worth remembering if performance numbers ever look inconsistent with what should be running.
- **Third-party library investigation paid off twice this session** — reading `tree-core`'s actual `.d.ts` files (not just assuming) caught the `classBounds` root cause precisely, and reading `tree-react`'s actual non-minified source (not just assuming) found the real scene-rebuild issue. Worth doing this again before patching either library further.

-----

## Pointers

- Plan doc (current): `docs/superpowers/plans/poe2-console-hub-plan7_12_2026.md`
- PWA design spec: `docs/superpowers/specs/2026-07-12-pwa-serwist-design.md`
- PWA implementation plan: `docs/superpowers/plans/2026-07-12-pwa-serwist.md`
- This handoff: `docs/superpowers/handoffs/2026-07-12-session-handoff.md`

**Also:** the plan doc's new dated filename needs to be uploaded to the Claude Project's file section to replace the old `..._7_11_2026.md` copy, so future chat sessions actually see the updated content — that's a manual step on Jaycee's side, not something automatically synced.
