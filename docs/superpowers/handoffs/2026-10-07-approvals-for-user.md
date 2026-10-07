# Approvals needed (2026-10-07, written while the user napped)

## Done without needing approval (local branch `chore/scratch-save-diagnostics`, NOT pushed)

- Scratch-planner timeout: **not reproduced.** Cold standalone save lands in 13 s. Full suite from a deleted `.next` with server log on: 164 passed, 1 skipped, 24.2 min, scratch-planner 6/6 green. Not declared fixed.
- `e2e/helpers.ts` `saveBuild` (scratch path): on a stall, throws with a request timeline, still-pending requests and page state. Next failure names its own cause.
- `playwright.config.ts`: `E2E_SERVER_LOG=1` pipes Next's compile/reload lines into the run output.
- Memory: mods live global (`~/.claude`).
- Handoff `2026-10-07-handoff-scratch-planner-then-convergence.md` rides on this branch.

## Needs your approval (in order)

1. **Merge + push the branch to `main`.** Push deploys to Vercel production. Changes are test-tooling only; nothing user-facing. (Held back because you were asleep; it is also the carrier for the handoff doc, per no-docs-only-pushes.)
2. **Gem card design.** Mock at `docs/superpowers/mocks/gem-card.html` (open in a browser). Tap a Skills row (phone) / hover (desktop) shows: description, tags, level/quality, stat lines at the build's level, quality bonuses, each support with a one-line "what it does". Data already exists in `public/data/wiki/<v>/skills/*.json`. Approve or redline, then I build it. Two open choices are listed in the mock: cap stat lines at 4 with "more"? support text always visible or tap-to-expand?
3. **PoB2 hand test.** Paste `docs/superpowers/handoffs/2026-10-06-momentsZX-EXPORTED-pob2-code.txt` into PoB2 (Import/Export > Import from code). Only you can do this; export has never been opened by PoB2.
4. **Which of these next:** guidance/editorial layer (#7), config-affects-numbers (#8), amulet catalyst + lightning res stat leftovers (no approval needed, I can just do it), reader export.
5. **Optional cleanup:** delete worktree `C:/Dev/project-vaal-wt/shader-spike` and branch `feat/shader-hero-embers` (rejected spike).

## Convergence path (gem tooltips), once #2 is approved

1. Failure modes first (AGENTS.md): gem missing from wiki, level beyond scaling table, support with no description, unknown quality stat, slug mismatch, empty group.
2. E2E spec on mobile: tap row shows card; assert description, quality line, each support's text; screenshot artifact in test output.
3. Pure builder `src/lib/build/gemCard.ts` (mirrors `itemCard.ts`), `GemCard.tsx` reusing `ItemCardView` styling, replace `SkillDetail.tsx` body, desktop hover popover.
4. Narrow runs while iterating, one full suite at the end, merge `--no-ff`, push.
