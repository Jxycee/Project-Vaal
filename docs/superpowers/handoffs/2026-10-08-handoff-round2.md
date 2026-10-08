# Handoff, 2026-10-08 (end of day): where everything stands, and what to do first tomorrow

Start here, then read `docs/superpowers/CURRENT-STATE.md` and the memory index. Live board: https://claude.ai/artifact/WCCEdBJQ2g7aEpQFSxxBP5 (private; the user edits status and notes there, Claude updates it with the ArtifactData tool; source file `docs/superpowers/roadmap-artifact.html`, untracked on purpose). Respond terse (caveman on). Subagents allowed: Sonnet/Haiku for work, Fable only as a one-time debugger when truly stuck, advisor opus 5.5 medium. `/goal` and `/advisor` are slash commands the assistant cannot run itself.

## What is on `main` and pushed (origin/main = ce4b9282a3, full suite green: 168 passed, 1 skipped)

Gem card, import-sheet copy, `.build` (in-game Build Planner) exporter, PoB2 data sync (435 uniques, modcache, jewel/rune/charm/corrupted/veiled mods, 1,119 skills + SkillStatMap, bases, quest rewards, constants; `npm run sync:pob-*`), engine fixes, multi-build oracle. The five original "ordinary" oracle builds match PoB2 on 65 of 65 stats.

## Unpushed branches (all local; NOTHING from here is pushed or merged)

| Branch | Where | State | Next step |
| --- | --- | --- | --- |
| `feat/engine-round2` (current checkout) | main tree | `c9ca41d78c` adds 8 new ordinary oracle fixtures with FLOORs (good, tests pass). `95984a1c21` is a **WIP: derived defence stats scaffolding, `tsc` FAILS** (statTable.test.ts needs the new Pool members: maxEndurance, maxFrenzy, maxPower, movementSpeed, ...). The agent was killed mid-edit. | Finish or revert the WIP commit, then run `npx tsc --noEmit -p .` and `npx vitest run src/lib`. |
| `ui/reader-export` | worktree `.claude/worktrees/wf_583e9527-652-2` | Committed `2c27d795c0`. Reader export (PoB code + .build) with visibility-checked server actions. **Never typechecked here, spec never run.** Spec: `e2e/reader-export.spec.ts`. | Merge into a test branch, `tsc`, run the spec, review the access rule by hand (it reads another user's build: security-sensitive). |
| `ui/duplicate-checkpoint` | worktree `...-3` | Committed `e99315f374`. One-tap Duplicate on checkpoint rows. Spec `e2e/checkpoint-duplicate.spec.ts` not run. | Same. |
| `ui/discovery-foundations` | worktree `...-4` | Committed `76550aaa4c`. Pure filter/sort/page spec, query builder, `listPublicBuilds`, facet doc. No page, no migration. | `tsc` + its vitest; confirm no DB change. |

Worktrees have no `node_modules`; run checks by merging the branch into a scratch branch in the main checkout, not in the worktree. Delete the worktrees and branches after merging.

## First moves tomorrow

1. `git status` (expect clean) and `git branch -vv`. Decide the WIP: finish derived stats (board item 26) or `git revert 95984a1c21`.
2. Merge the three `ui/*` branches one at a time into `feat/engine-round2` (or a scratch branch), `npx tsc --noEmit -p .`, run each new spec alone (`npx playwright test e2e/<spec> --project=mobile --reporter=dot`), fix what fails.
3. Run the **full suite once** (`npx playwright test --reporter=list`, about 25 min, stop any dev server first), then merge to `main` and push. The user approved pushing what is ready (2026-10-08); a green full suite is the readiness gate.
4. Then the engine loop (board 25/26/32): run `npx vitest run src/lib/build/stats/__tests__/multiOracle.test.ts`, read `docs/superpowers/oracle/results.json` `gaps`, fix the biggest root cause, raise FLOORs upward only. Target 13/13 on every `ordinary-*` fixture (13 builds now); exotic four are 2 to 7 of 13.
5. Not started: board 20 (Config panel feeding the engine; `PassiveState.buildConfig` and `buildConfig.ts` already carry PoB's condition flags), 13 (node tooltip on a phone), 27 (DPS: a spike was queued, never ran; `docs/superpowers/specs/2026-10-08-dps-scoping.md` has the reasoning).

## Traps (all hit this session)

- **Backslash trap:** the Bash tool collapses backslashes (regexes, `\n`, template escapes). Use Write/Edit for any such content. It bit again.
- **Never `git checkout -- .`** with uncommitted work: it wiped three files once. Commit first.
- **Push policy:** push only on the user's explicit chat approval. A board note once read as approval and was acted on; that was an overstep. Today's chat approval ("Push what you feel is ready") covers ready, green work only.
- **Artifact db rows are frozen:** copy snapshot data (`Object.assign({}, d.data(), {id})`); assigning onto it silently fails (this lost the user's notes once).
- A running dev server holds Next's lock and breaks Playwright; Playwright and parallel agents must not share the test account (E2E rows are deleted in afterAll). Agents write specs, the controller runs them.
- poe.ninja stats are a PoB simulation, not the raw game sheet. Its public JSON API: `/poe2/api/builds/<version>/character?account=..&name=..&overview=forbidden-rites` (version from `/poe2/api/data/index-state`); `scripts/fetch-oracle-builds.mjs` and `fetch-oracle-pool.mjs` use it.
- Mods live global in `~/.claude` (memory: mods-live-global).
