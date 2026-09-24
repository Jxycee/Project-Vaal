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
