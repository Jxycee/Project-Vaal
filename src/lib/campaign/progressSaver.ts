// src/lib/campaign/progressSaver.ts
// Saves campaign ticks as CHANGES, merged onto the stored row as it is at save
// time, one save at a time. The tracker used to upsert its whole checklist from
// component state (review 2026-09-26), so a page restored from the router
// cache (browser Back) or a second tab wrote its old state over newer ticks,
// and a slow save could land after a newer one. Pure apart from the injected
// read/write, so the ordering rules are unit-tested (progressSaver.test.ts).

/** campaign_progress.progress: checkpoint id -> ticked. Unticked ids are absent. */
export type Progress = Record<string, boolean>

type Batch = { reset: boolean; changes: [string, boolean][] }

export class ProgressSaver {
  private pending = new Map<string, boolean>()
  private resetPending = false
  private chain: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly read: () => Promise<Progress>,
    private readonly write: (next: Progress) => Promise<void>,
  ) {}

  set(id: string, ticked: boolean): void {
    this.pending.set(id, ticked)
  }

  /** Clears every tick, including any set earlier in the same batch. */
  reset(): void {
    this.pending.clear()
    this.resetPending = true
  }

  hasPending(): boolean {
    return this.resetPending || this.pending.size > 0
  }

  /**
   * Saves everything set so far, after any save already running. Resolves to
   * the row as saved, or null when there was nothing to save. A failed save
   * rejects and keeps its changes queued (under anything set since) for the
   * next flush.
   */
  flush(): Promise<Progress | null> {
    if (!this.hasPending()) return this.chain.then(() => null, () => null)
    // Take the batch now, so a set() during the save goes into the next one.
    const batch: Batch = { reset: this.resetPending, changes: [...this.pending] }
    this.pending = new Map()
    this.resetPending = false

    const run = this.chain
      .catch(() => undefined)
      .then(async () => {
        try {
          const next: Progress = batch.reset ? {} : { ...(await this.read()) }
          for (const [id, ticked] of batch.changes) {
            if (ticked) next[id] = true
            else delete next[id]
          }
          await this.write(next)
          return next
        } catch (err) {
          const since = this.pending
          this.pending = new Map(batch.changes)
          for (const [id, ticked] of since) this.pending.set(id, ticked)
          if (batch.reset) this.resetPending = true
          throw err
        }
      })
    this.chain = run
    return run
  }
}
