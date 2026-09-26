// src/lib/prices/prune.ts
// Which leagues' price rows the hourly sync may delete. Pure; the route passes
// in what it read and what it synced.
//
// A league is pruned only when the run has positive evidence that the league
// list it is judging by is real: poe2scout flagged at least one league current,
// AND every league it flagged synced rows in this same run. Without that, an
// upstream incident (a 200 with [] or a list missing the IsCurrent flag, a
// partial outage, a run that timed out before reaching a league) would look
// exactly like a league rollover and delete the live league's prices.
// Skipping a prune costs nothing: the next healthy run does it.

export function leaguesToPrune(input: {
  /** Leagues that have rows in price_entries now. */
  existing: readonly string[]
  /** Leagues poe2scout flagged IsCurrent this run. */
  current: readonly string[]
  /** Everything this run treats as live: Standard, current, env overrides. Never pruned. */
  active: readonly string[]
  /** Rows upserted this run, per league. */
  syncedRows: Readonly<Record<string, number>>
}): string[] {
  const { existing, current, active, syncedRows } = input
  if (current.length === 0) return []
  if (!current.every((league) => (syncedRows[league] ?? 0) > 0)) return []
  const keep = new Set(active)
  return existing.filter((league) => !keep.has(league))
}
