import { describe, expect, it } from 'vitest'
import { leaguesToPrune } from './prune'

// The sync deletes every price row of a league that is no longer active. Until
// 2026-09-26 "active" was {Standard} ∪ whatever poe2scout flagged IsCurrent,
// computed before anything was fetched — so a 200 with [] (or a list missing
// the flag) during an upstream incident deleted the live league's prices.
const existing = ['Standard', 'Runes of Aldur', 'HC Runes of Aldur', 'Old League']

describe('leaguesToPrune', () => {
  it('prunes a league that closed, once the current leagues synced this run', () => {
    expect(
      leaguesToPrune({
        existing,
        current: ['Runes of Aldur', 'HC Runes of Aldur'],
        active: ['Standard', 'Runes of Aldur', 'HC Runes of Aldur'],
        syncedRows: { 'Runes of Aldur': 500, 'HC Runes of Aldur': 480, Standard: 300 },
      }),
    ).toEqual(['Old League'])
  })

  it('prunes nothing when upstream flags no current league at all', () => {
    expect(
      leaguesToPrune({ existing, current: [], active: ['Standard'], syncedRows: { Standard: 300 } }),
    ).toEqual([])
  })

  it('prunes nothing when a current league synced no rows (outage, or the run timed out before it)', () => {
    expect(
      leaguesToPrune({
        existing,
        current: ['Runes of Aldur', 'HC Runes of Aldur'],
        active: ['Standard', 'Runes of Aldur', 'HC Runes of Aldur'],
        syncedRows: { 'Runes of Aldur': 500 },
      }),
    ).toEqual([])
  })

  it('never prunes an active league, Standard included', () => {
    const pruned = leaguesToPrune({
      existing,
      current: ['Runes of Aldur'],
      active: ['Standard', 'Runes of Aldur'],
      syncedRows: { 'Runes of Aldur': 10 },
    })
    expect(pruned).not.toContain('Standard')
    expect(pruned).not.toContain('Runes of Aldur')
    expect(pruned).toEqual(['HC Runes of Aldur', 'Old League'])
  })
})
