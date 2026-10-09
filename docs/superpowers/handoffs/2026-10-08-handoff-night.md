# Handoff, end of 2026-10-08: where things stand and how to continue

Start here. Read `docs/superpowers/CURRENT-STATE.md` and the memory index too. Live board: https://claude.ai/artifact/WCCEdBJQ2g7aEpQFSxxBP5 (private; the user edits status/notes there, Claude updates it with the ArtifactData tool; source `docs/superpowers/roadmap-artifact.html`, untracked on purpose). This supersedes `2026-10-08-handoff-round2.md`.

Working style: terse (caveman). Subagents allowed: Haiku (nearly free, strong: fan-out, measuring, diagnosis with numeric proof, verification), Sonnet (code edits), Opus (architecture, security review, stalled-loop diagnosis), Fable only as a one-time debugger after a stalled Sonnet loop and an Opus plan. Push only after a green full Playwright suite and on the user's approval ("push what is ready" was given 2026-10-08). `/goal` and `/advisor` are slash commands the assistant cannot run.

## State of the repo

- `origin/main` = `3a56c1966f` when this was written (CI green).
- Local branch `feat/engine-round5` holds everything unpushed (if it has not been pushed yet; check `git status -sb` and `git log origin/main..HEAD --oneline`): 20 engine commits (all 33 ordinary oracle builds 429/429 base stats, the exotic four 52/52), the PoB reference probe (`spike/pob-lua-wasm/`), the weekly PoB data drift GitHub Action (`.github/workflows/pob-sync-drift.yml`, read-only, fails the run when PoB data moves), the "≈" marks on inexact Defences rows (`DefencesGroup.tsx` APPROXIMATE set), and the E2E speed-up (one-call cleanup, `E2E-SHARED-` prefix protected, mobile deviceScaleFactor 1, wider warm-up).
- 37 oracle fixtures in `docs/superpowers/oracle/` (33 `ordinary-*`, 4 exotic). Report: `docs/superpowers/oracle/results.json` (rewritten by `npx vitest run src/lib/build/stats/__tests__/multiOracle.test.ts`).
- Unit tests 1,319, run in about 15 s. Playwright about 23 minutes, run only by the controller (shared test account, one dev port).

## First moves next session

1. `git status -sb`, `git branch -vv`. If `feat/engine-round5` is not pushed: `npm test`, `npx tsc --noEmit -p .`, `npm run lint`, then the full suite `npx playwright test --reporter=list` (stop any dev server first), and push only on green.
2. Derived-stat fixes: board item 36 and the ordered plan from the Haiku diagnosis (`docs/superpowers/specs/` plus the workflow journal; summary in the board). Proven first: re-baseline oracle; movement speed ("ignore armour movement penalties" flag); support-gem constant stats (Blind etc.) feeding enemy accuracy/evade/deflect/regen with per-carrier counting; enemy accuracy `floor()`; max hit and EHP companion-redirect transform (10% share); life reservation; per-second item regen lines wrongly divided by 60. Unproven items need the probe. Use Sonnet to implement, Haiku to measure, probe as reference only; every fix must match the poe.ninja oracle. Remove ids from the APPROXIMATE set in `DefencesGroup.tsx` as stats become exact.
3. The PoB reference probe: `node spike/pob-lua-wasm/probe.mjs <fixture.json> --stats ... --pools ...` (README in that folder). It needs the PoB2 clone and wasmoon installed OUTSIDE the repo: set `POBWASM_DIR` and follow the README's three setup steps (the old scratch folder from today is gone with the session). It is a hint where to read PoB's source, never the answer: it is wrong on Chaos Inoculation chaos resistance and drifts from poe.ninja's exports.

## Still the user's

- PoB2 hand test of `docs/superpowers/handoffs/2026-10-06-momentsZX-EXPORTED-pob2-code.txt` (item 12).
- Eyeball the tooltip panel (item 13) and the Defences panel (item 26) at 375px on a phone; nobody has seen them.
- Guidance layer (item 19): design and mock are ready (`docs/superpowers/mocks/guidance.html`, `docs/superpowers/specs/2026-10-08-guidance-layer-design.md`); needs the user's design OK and a database migration (SQL in the doc only, never run).
- Whether to ever use PoB-in-WebAssembly for DPS (item 27: not ready; spike doc `docs/superpowers/specs/2026-10-08-pob-lua-wasm-spike.md`).

## Traps learned today

- The Bash tool collapses backslashes: any content with one goes through Write/Edit, never heredoc, node -e or sed.
- Never `git checkout -- .` with uncommitted work. Never `rm -rf` a worktree's `node_modules` (a junction to the main one); use `git worktree remove`.
- The oracle tests fresh imports; the app runs the engine on SAVED data read through `parseCraft`/`parseGearState`/`parsePassiveState`. Any field the importer writes and the engine reads must be kept there AND accepted by `stateInput.ts`, or the app shows lower numbers than the oracle. `e2e/derived-stats.spec.ts` guards the main stats on a saved build; a leak scan over all 37 fixtures was clean on 2026-10-08.
- `npm install` in the repo reverts the `@poe2-toolkit` patches (run `npx patch-package`); do dependency installs for tools outside the repo.
- A running dev server blocks Playwright; agents write specs, the controller runs them.
- Artifact db rows are frozen: copy snapshot data before adding fields.
- poe.ninja stats are a PoB simulation, not the raw game sheet; its public JSON API is `/poe2/api/builds/<version>/character?account=..&name=..&overview=..` (version from `/poe2/api/data/index-state`).
- Mods live global in `~/.claude`; no docs-only pushes (ship docs with code).
