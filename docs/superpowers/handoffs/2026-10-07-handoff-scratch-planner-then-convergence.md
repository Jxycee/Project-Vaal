# Handoff, 2026-10-07: scratch-planner timeout first, then more competitor convergence

Start here. Read this, then `docs/superpowers/CURRENT-STATE.md` and the memory index. The user is not a developer by trade and works mostly in this desktop app; they run `/reload-plugins` themselves. Respond terse (caveman mode is on per AGENTS.md). Claude Max is active now, so subagents are affordable (Opus orchestrates only; Sonnet/Haiku implement, per memory).

## State of main (everything below is live, last push 4d738487d3)

| Shipped | Notes |
| --- | --- |
| Stat-accuracy engine | momentsZX oracle matches 9 of 12 in-game stats; ES/evasion within 4% (amulet catalyst unmodelled); lightning res 75 vs 77 unexplained |
| Slim tree load | `public/data/tree/0.5.2/lite.json` (43 KB gz) for Overview/Gear/Skills/Stats; the 541 KB `data.json` only loads on the Tree tab. Regenerate with `npm run sync:tree-lite` after any tree re-vendor (a data test pins it) |
| PoB2 export | Build settings > Export. `src/lib/pob/export/`, server action `src/app/(dashboard)/builds/exportActions.ts`, `npm run sync:pob-gem-ids`. Round trip tested on the fixture and momentsZX. **PoB2 itself has never opened one: ask the user to paste `docs/superpowers/handoffs/2026-10-06-momentsZX-EXPORTED-pob2-code.txt` into PoB2 (Import/Export > Import from code).** Known losses: gems PoB2 lacks (Hypothermia) are left out; export is owner-only; gear/gems come from the viewed checkpoint |
| Landing page | Gilded frame (C5), no vertical scroll from `md` up (6 sizes tested), `e2e/landing.spec.ts` |
| Emblem LCP | `loading="eager"` on the shell emblem; removed the repeated Next warning from test logs |
| Reader item cards | Tap a slot: full card (tier tags P/S 1=best from `mod-tiers.json`, roll bars, rune box, requirements). Desktop hover card. Unique header gets a quiet WebGPU haze. `npm run sync:mod-tiers` regenerates the tier table after `sync:wiki`. Code: `src/lib/build/itemCard.ts`, `src/components/build/ItemCard.tsx`, `item-header-shader.tsx` |

## Task 1: the scratch-planner e2e timeout (do this first)

- **Symptom:** `e2e/scratch-planner.spec.ts:116` ("first save creates the build and lands on its page with tree, gear, gems and meta") failed in the **first full run of both full-suite runs today** (2026-10-06 and 2026-10-07), `TimeoutError: page.waitForURL` at `e2e/helpers.ts:268` (`saveBuild`, 120 s wait for `/builds/<token>`). It passed 7/7 when the file was rerun alone, and in the most recent full runs it passed. Not caused by anything changed this session as far as we know, but **nobody has measured why.**
- **Do not just raise the timeout.** Find out what the page is doing during the wait:
  1. Run the file alone with a trace: `npx playwright test e2e/scratch-planner.spec.ts --project=mobile --trace on`, then inspect the save request, the redirect and the network panel.
  2. Check whether it is the dev server cold-compiling `/builds/[shareToken]` (the helper's own comment says "seen at 30s+"). If so, the fix is to warm that route in a global setup, not a longer wait.
  3. Check the save action itself (`BuildSession` `save()` for the scratch path, the POST and `router.replace`) for a hang: a draft/lock, a failed RPC that returns without redirecting, or the redirect racing the draft write.
  4. Run the whole suite once at the end and confirm the failure is gone; if it still appears only on first run, it is cold start.
- **Known unrelated noise:** Playwright's headless Chromium reports `navigator.gpu` but has no usable adapter, so the unique-card shader never mounts in tests (`e2e/item-card-shader.spec.ts` accepts both outcomes and records which ran).

## Task 2: more competitor convergence

Source of truth: `docs/superpowers/specs/2026-09-23-competitor-build-flow-gaps.md` (ranked gaps) and `docs/superpowers/specs/2026-09-20-competitor-build-planner-recon.md` (stale in places: Mobalytics now has an in-house planner). Done so far: gaps 1-6 in some form (stat sheet, validation, item affixes, gem level/quality, checkpoints, PoB import/export), plus reader item cards. Candidates, in rough order of value to a reader:

1. **Gem tooltips on the Skills tab**, same treatment as item cards: support list with what each support does, level/quality, and the skill's own description. Mobalytics shows gem hovers; ours show a name only. Reuse `ItemCardView` styling and the wiki skill files (`public/data/wiki/<v>/skills/*.json`).
2. **Passive tree node tooltips for readers** (keystone/notable text on tap in read mode), if not already adequate (`NodeTooltip.tsx` exists; check it on a phone).
3. **The remaining gap-doc items**: guidance/editorial layer (#7: per-checkpoint notes, "how it plays" text), config that affects numbers (#8). Ask the user which they care about.
4. **Stat-accuracy leftovers**: amulet catalyst boost (ES 1295 vs 1348, evasion 4637 vs 4752), lightning res 75 vs 77 on the momentsZX oracle (`src/lib/build/stats/__tests__/momentsZX.oracle.test.ts`; `it.fails` entries flip to `it` as fixes land; never loosen an expectation).
5. **Export parity**: let readers export (pobb.in and poe.ninja allow it); gem ids PoB2 lacks.

Process the user wants: **mock designs in the Design canvas and get their confirmation before writing code or committing designs.** Keep effects subtle: attention stays on the stats. Dark, near-black, gold hairlines; no neon or pastel (the shader spike was rejected for being "circus like" and off brand). iPhones can run WebGPU, so mobile shaders are allowed.

## Working rules and traps (all learned this session)

- **Pushes to `main` deploy to Vercel production; a feature branch push makes a preview.** Never push docs-only commits (memory: no-docs-only-pushes). This handoff is committed on `main` locally and must ride along with the next code push, not be pushed alone.
- **Merge locally, no PRs** (memory). Merge with `--no-ff`, push, delete the local branch.
- **Backslash trap:** the Bash tool collapses backslashes. Anything containing one (regexes, `\n`, Windows paths) goes through the Write/Edit tools, never a heredoc, `node -e` or `sed`. It bit six times in one day.
- **Tests burn the usage budget.** Narrow quiet runs while iterating (`--reporter=dot`, one spec), one full suite per slice (about 50 minutes, ~160 tests), and only the controller runs it. AGENTS.md: no unit tests written after code; failure modes first; prefer e2e; leave a verifiable artifact (JSON or screenshot in the test output dir).
- **`npm install` reverts the patches** on `@poe2-toolkit`: run `npx patch-package` after any install.
- **A running dev server (including the in-app preview) holds Next's lock** and makes `npx playwright test` fail to start: stop the preview first.
- **Windows nft paths** use backslashes; match with `includes()`. After a production build, the build-page route traces 11,381 `public/data` files (the export action needs them: `next.config.ts` `outputFileTracingIncludes` `/builds/*`).
- **The test account** is a real Supabase login in memory (`test-account-credentials.md`); `e2e/auth.setup.ts` uses it. E2E rows are named `E2E-...` and deleted in `afterAll`. The demo build "LA Deadeye (momentsZX reference)" (token `KXgKsUvxM8VrxDVl3d3O5`) is deliberately not E2E-prefixed.
- **GGG art:** only real in-game content (tree sprites, wiki icons, prices icons) may use GGG art. Everything decorative is original (see AGENTS.md "GGG art use").

## Open items that are not tasks yet

- The user has not yet seen the unique-card shader on a real GPU (the Vercel preview for `feat/item-tooltips` still exists on the remote branch). If they report it is too strong, the values are in `src/components/build/item-header-shader.tsx`.
- The user's Claude Code mods live in `~/.claude/skills/` (not the repo): `message-timestamps`, `wizard-spinner` (desktop wizard drawn as an SVG above the prompt), `e2e-progress` (live Playwright bar; fixed 2026-10-07 so it no longer disappears when the harness moves a run to the background, plus a reporter heartbeat). Originals are in `~/.claude/mod-backups/`. They are tooling, not project code.
- `feat/shader-hero-embers` (local worktree at `C:/Dev/project-vaal-wt/shader-spike`) holds a rejected landing-shader variant; safe to delete the worktree and branch. `origin/feat/shader-hero-spike` is the cloud session's original spike, also rejected.
- Vercel team `wxzard-jxycee-projects`, project `project-vaal` (`prj_oWZig05A6ebCR2MZ9mEZdaAlrEx7`).
