# PoB2 data re-sync (drift check)

`.github/workflows/pob-sync-drift.yml` runs weekly (Mon 05:00 UTC) and on demand. It re-runs the PoB2 sync scripts on a clean checkout and compares to what is committed. It never commits, pushes or opens a PR (read-only token).

## Reading the report

- Green run: our `src/lib/pob/data` matches PoB2 `dev`.
- Red run: PoB2 changed, or a script broke. Open the run, read the job summary: a table of changed files with added/removed line counts. Data files are minified JSON, so line counts are tiny; use the patch for real size.
- A red run with no table means a sync script itself failed (fetch or parse error). Read the failing step log; upstream probably moved or renamed a file.
- Download artifact `pob-drift-patch` for the full `git diff`.

## Applying

1. On a branch: run each in turn with `npm run`: `sync:pob-uniques`, `sync:pob-modcache`, `sync:pob-jewel-rune-charm`, `sync:pob-skills`, `sync:pob-bases`, `sync:pob-gem-ids`. (Do not use `git apply` on the patch unless the branch matches main; re-running is authoritative.)
2. Run the oracle (build stat comparison against PoB) and `npx tsc --noEmit -p .`. Any regression in the oracle count means upstream changed a format or value we do not handle yet.
3. Review `git diff --stat`, then spot-check changed uniques/skills against PoB2.
4. Merge locally into main. Pushing deploys production, so push only once the oracle is green.

`sync:mod-tiers` is not part of the check: it derives from our wiki data, not PoB2.
