import { describe, it, expect } from 'vitest'
import { NextResponse } from 'next/server'
import { redirectPreservingSession } from './proxy'

describe('redirectPreservingSession', () => {
  it('carries cookies set on the source response onto the redirect', () => {
    // Simulates what supabase.auth.getUser()'s setAll callback does when it
    // refreshes an expired session token mid-request.
    const source = NextResponse.next()
    source.cookies.set('sb-access-token', 'refreshed-value', { path: '/', httpOnly: true })
    source.cookies.set('sb-refresh-token', 'refreshed-refresh-value', { path: '/', httpOnly: true })

    const redirect = redirectPreservingSession(new URL('https://example.com/dashboard'), source)

    expect(redirect.cookies.get('sb-access-token')?.value).toBe('refreshed-value')
    expect(redirect.cookies.get('sb-refresh-token')?.value).toBe('refreshed-refresh-value')
  })

  it('produces an actual 3xx redirect to the given URL, not just a copy of the source', () => {
    const source = NextResponse.next()
    const redirect = redirectPreservingSession(new URL('https://example.com/login'), source)

    expect(redirect.status).toBeGreaterThanOrEqual(300)
    expect(redirect.status).toBeLessThan(400)
    expect(redirect.headers.get('location')).toBe('https://example.com/login')
  })

  it('does not carry cookies over when the source response set none (the common, no-refresh-needed case)', () => {
    const source = NextResponse.next()
    const redirect = redirectPreservingSession(new URL('https://example.com/dashboard'), source)

    expect(redirect.cookies.getAll()).toEqual([])
  })
})
