// =============================================================================
// safeRedirect — the ONE validator for every `?redirect=` target in the app.
//
// Used by src/proxy.ts (signed-in user hitting /login or /signup), the /login
// and /signup pages, and the /auth/callback route handler. Do not add another
// copy: before this was extracted there were three, and all three accepted
// `/\evil.com`.
//
// Only a same-origin relative path is allowed. A value that resolves anywhere
// else is an open redirect, so every rule below is a rejection rule, and any
// doubt falls back to DEFAULT_REDIRECT:
//
//   - must be a string starting with exactly one `/` — rejects absolute URLs
//     (`https://evil.com`, `javascript:...`) and bare relative paths;
//   - no `\` anywhere — the WHATWG URL parser treats `\` as `/` in http(s)
//     URLs, so `/\evil.com` resolves as protocol-relative `//evil.com`;
//   - no ASCII control characters or whitespace — the URL parser strips tab
//     and newline, so `/\t/evil.com` would collapse to `//evil.com`;
//   - finally, resolved against a sentinel origin it must still land on that
//     origin — a backstop for any parser quirk the rules above miss.
//
// Percent-encoded forms (`/%2F%2Fevil.com`, `/%5Cevil.com`) pass, and that is
// correct: the URL parser does not decode them in a path, so they stay a path
// on this origin.
// =============================================================================

export const DEFAULT_REDIRECT = '/dashboard'

const SENTINEL_ORIGIN = 'http://safe-redirect.invalid'

// U+0000–U+0020 (controls + space) and U+007F (DEL).
const CONTROL_OR_SPACE = /[\u0000-\u0020\u007f]/

export function isSafeRedirect(raw: string | null | undefined): raw is string {
  if (typeof raw !== 'string') return false
  if (!raw.startsWith('/')) return false
  if (raw.startsWith('//')) return false
  if (raw.includes('\\')) return false
  if (CONTROL_OR_SPACE.test(raw)) return false

  try {
    return new URL(raw, SENTINEL_ORIGIN).origin === SENTINEL_ORIGIN
  } catch {
    return false
  }
}

export function safeRedirect(raw: string | null | undefined): string {
  return isSafeRedirect(raw) ? raw : DEFAULT_REDIRECT
}
