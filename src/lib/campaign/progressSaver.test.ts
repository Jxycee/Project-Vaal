import { describe, expect, it } from 'vitest'
import { ProgressSaver, type Progress } from './progressSaver'

// Failure modes first (AGENTS.md). The tracker used to upsert its WHOLE
// checklist from component state after a 900ms debounce (review 2026-09-26):
//  1. navigating away inside the debounce cleared the timer: the tick was lost;
//  2. a page restored from the router cache (browser Back) held old state, and
//     its next tick wrote that old state over newer saved ticks;
//  3. a slow save could land after a newer one and overwrite it.

/** A fake campaign_progress row with controllable latency. */
function fakeStore(initial: Progress = {}) {
  let row: Progress = { ...initial }
  const writes: Progress[] = []
  let delays: number[] = []
  return {
    get row() {
      return row
    },
    writes,
    slowNext(...ms: number[]) {
      delays = ms
    },
    read: async () => ({ ...row }),
    write: async (next: Progress) => {
      const wait = delays.shift() ?? 0
      if (wait) await new Promise((r) => setTimeout(r, wait))
      row = { ...next }
      writes.push({ ...next })
    },
  }
}

describe('ProgressSaver', () => {
  it('saves only what changed, on top of the row as it is now — a stale page never reverts newer ticks', async () => {
    // Another tab (or an earlier visit) already saved a and b.
    const store = fakeStore({ a: true, b: true })
    const saver = new ProgressSaver(store.read, store.write)
    // This page loaded before b was ticked, and now ticks c.
    saver.set('c', true)
    await saver.flush()
    expect(store.row).toEqual({ a: true, b: true, c: true })
  })

  it('removes an unticked checkpoint instead of writing false', async () => {
    const store = fakeStore({ a: true, b: true })
    const saver = new ProgressSaver(store.read, store.write)
    saver.set('a', false)
    await saver.flush()
    expect(store.row).toEqual({ b: true })
  })

  it('never lets an older save land after a newer one', async () => {
    const store = fakeStore()
    const saver = new ProgressSaver(store.read, store.write)
    store.slowNext(50, 0)
    saver.set('a', true)
    const first = saver.flush()
    saver.set('a', false)
    const second = saver.flush()
    await Promise.all([first, second])
    expect(store.row).toEqual({})
  })

  it('a flush with nothing pending writes nothing', async () => {
    const store = fakeStore({ a: true })
    const saver = new ProgressSaver(store.read, store.write)
    await saver.flush()
    expect(store.writes).toEqual([])
  })

  it('reset clears everything, including ticks made before it in the same batch', async () => {
    const store = fakeStore({ a: true, b: true })
    const saver = new ProgressSaver(store.read, store.write)
    saver.set('c', true)
    saver.reset()
    await saver.flush()
    expect(store.row).toEqual({})
    saver.set('d', true)
    await saver.flush()
    expect(store.row).toEqual({ d: true })
  })

  it('reports the saved row, and a failed save keeps its changes for the next flush', async () => {
    const store = fakeStore({ a: true })
    let fail = true
    const saver = new ProgressSaver(store.read, async (next) => {
      if (fail) throw new Error('offline')
      await store.write(next)
    })
    saver.set('b', true)
    await expect(saver.flush()).rejects.toThrow('offline')
    fail = false
    expect(await saver.flush()).toEqual({ a: true, b: true })
    expect(store.row).toEqual({ a: true, b: true })
  })
})
