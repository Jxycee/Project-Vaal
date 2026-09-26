import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

let currentUser: { email: string } | null = null

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: currentUser } }) },
  }),
}))

const { proxy } = await import('./proxy')

const ORIGIN = 'http://localhost:3000'

async function locationFor(path: string): Promise<string | null> {
  const res = await proxy(new NextRequest(new URL(path, ORIGIN)))
  return res.headers.get('location')
}

describe('proxy: round trip of the observed failure', () => {
  it('a transient no-user bounce to /login lands back on the original page', async () => {
    currentUser = null
    const bounce = await locationFor('/builds?tab=mine')
    expect(bounce).toBe(`${ORIGIN}/login?redirect=${encodeURIComponent('/builds?tab=mine')}`)

    currentUser = { email: 'user@example.com' }
    expect(await locationFor(bounce!)).toBe(`${ORIGIN}/builds?tab=mine`)
  })
})

// next.config.ts gives every /data/wiki/** response a 1-hour private
// Cache-Control by PATH, so the 307 to /login inherited it: the browser kept
// the redirect, and after signing back in every wiki fetch bounced
// cached-307 -> /login -> back -> cached-307 until the hour ran out
// (confirmed on production 2026-09-26). A redirect must never be cacheable.
describe('proxy: redirects are never cached', () => {
  it.each([
    ['a signed-out request for gated wiki data', null, '/data/wiki/2026-08-25/item-index.json'],
    ['a signed-out request for a gated page', null, '/builds'],
    ['a signed-in request for /login', { email: 'user@example.com' }, '/login?redirect=/wiki'],
  ])('%s', async (_label, user, path) => {
    currentUser = user
    const res = await proxy(new NextRequest(new URL(path, ORIGIN)))
    expect(res.headers.get('location')).not.toBeNull()
    expect(res.headers.get('cache-control')).toBe('no-store')
  })
})
