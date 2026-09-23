import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('proxy: signed-in user on an auth page', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.invalid'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    currentUser = { email: 'user@example.com' }
  })

  it('honours a valid redirect param, query string intact', async () => {
    const target = '/builds?tab=mine&x=1'
    expect(await locationFor(`/login?redirect=${encodeURIComponent(target)}`)).toBe(
      `${ORIGIN}${target}`
    )
  })

  it('honours it on /signup too', async () => {
    expect(await locationFor('/signup?redirect=%2Fbuilds')).toBe(`${ORIGIN}/builds`)
  })

  it('falls back to /dashboard with no redirect param', async () => {
    expect(await locationFor('/login')).toBe(`${ORIGIN}/dashboard`)
  })

  it.each([
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    '/\t/evil.com',
    'evil.com',
  ])('never redirects off-origin for %j', async (hostile) => {
    const loc = await locationFor(`/login?redirect=${encodeURIComponent(hostile)}`)
    expect(loc).toBe(`${ORIGIN}/dashboard`)
  })

  it('does not bounce back into an auth page', async () => {
    expect(await locationFor('/login?redirect=%2Flogin')).toBe(`${ORIGIN}/dashboard`)
    expect(await locationFor('/login?redirect=%2Fsignup%3Fx%3D1')).toBe(`${ORIGIN}/dashboard`)
  })
})

describe('proxy: round trip of the observed failure', () => {
  it('a transient no-user bounce to /login lands back on the original page', async () => {
    currentUser = null
    const bounce = await locationFor('/builds?tab=mine')
    expect(bounce).toBe(`${ORIGIN}/login?redirect=${encodeURIComponent('/builds?tab=mine')}`)

    currentUser = { email: 'user@example.com' }
    expect(await locationFor(bounce!)).toBe(`${ORIGIN}/builds?tab=mine`)
  })
})
