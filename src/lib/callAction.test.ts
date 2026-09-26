import { describe, expect, it, vi } from 'vitest'
import { notFound, redirect } from 'next/navigation'
import { ACTION_UNREACHABLE, callAction } from './callAction'

// A Server Action that throws (a dropped connection, a deploy that retired the
// action id) inside startTransition is rethrown to the nearest error
// boundary, which on /tree unmounted the editor and every unsaved edit with
// it (review 2026-09-26). Callers get a failure result instead.
describe('callAction', () => {
  it('passes a result through untouched', async () => {
    const ok = { ok: true as const, id: 'x' }
    expect(await callAction(() => Promise.resolve(ok))).toBe(ok)
    const refused = { ok: false as const, error: 'Name cannot be empty.' }
    expect(await callAction(() => Promise.resolve(refused))).toBe(refused)
  })

  it('turns a thrown action into a failure the caller can show', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await callAction(() => Promise.reject(new TypeError('Failed to fetch')))).toEqual({
      ok: false,
      error: ACTION_UNREACHABLE,
    })
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("still lets Next's own redirect and notFound signals through", async () => {
    await expect(callAction(async () => redirect('/login'))).rejects.toMatchObject({ digest: expect.stringContaining('NEXT_REDIRECT') })
    await expect(callAction(async () => notFound())).rejects.toBeTruthy()
  })
})
