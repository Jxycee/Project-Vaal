// Server wrapper: resolves auth state once, then renders the client chrome.
// Used by both protected routes ((dashboard)/layout) and public ones (prices).
//
// Email comes from the `x-vaal-user-email` request header set by proxy.ts
// (src/proxy.ts), which already validated it via its own
// supabase.auth.getUser() call on this same request — reading it here avoids
// a second, redundant round-trip to Supabase's auth server just to display
// it. That header is always a string ('' when signed out), so an empty
// string is normalized to null before reaching ShellChrome.
import { headers } from 'next/headers'
import { signOut } from '@/lib/actions'
import { ShellChrome } from './shell-chrome'

export default async function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const email = (await headers()).get('x-vaal-user-email') || null

  return (
    <ShellChrome email={email} signOutAction={signOut}>
      {children}
    </ShellChrome>
  )
}
