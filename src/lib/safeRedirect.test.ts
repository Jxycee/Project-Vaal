import { describe, expect, it } from 'vitest'
import { DEFAULT_REDIRECT, isSafeRedirect, safeRedirect } from './safeRedirect'

describe('safeRedirect', () => {
  it.each([
    '/builds',
    '/dashboard',
    '/',
    '/builds?tab=mine',
    '/builds/abc123?view=tree&slot=2',
    '/wiki/items?q=vaal%20orb#top',
    '/login?redirect=%2Fbuilds', // nested redirect param stays a path on this origin
    '/%2F%2Fevil.com', // percent-encoded slashes are not decoded in a path
    '/%5Cevil.com', // percent-encoded backslash likewise
  ])('keeps same-origin path %j', (input) => {
    expect(isSafeRedirect(input)).toBe(true)
    expect(safeRedirect(input)).toBe(input)
  })

  it.each([
    // missing / wrong type
    null,
    undefined,
    '',
    // absolute and scheme URLs
    'https://evil.com',
    'http://evil.com/builds',
    'HTTPS://evil.com',
    'javascript:alert(1)',
    'data:text/html,hi',
    // protocol-relative
    '//evil.com',
    '//evil.com/builds?x=1',
    '///evil.com',
    // backslash tricks (URL parser treats `\` as `/` for http(s))
    '/\\evil.com',
    '\\\\evil.com',
    '\\/evil.com',
    '/\\/evil.com',
    '/builds\\..\\..\\evil',
    // does not start with a single `/`
    'builds',
    'evil.com',
    './/evil.com',
    ' /builds',
    '?redirect=/builds',
    // control characters / whitespace the URL parser strips or trims
    '/\t/evil.com',
    '/\n/evil.com',
    '/\r/evil.com',
    '/\u0000/evil.com',
    '/builds ',
    '/\u007f',
  ])('rejects %j', (input) => {
    expect(isSafeRedirect(input)).toBe(false)
    expect(safeRedirect(input)).toBe(DEFAULT_REDIRECT)
  })

  it('falls back to /dashboard', () => {
    expect(DEFAULT_REDIRECT).toBe('/dashboard')
  })
})
