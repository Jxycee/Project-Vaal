// Server wrapper: resolves auth state once, then renders the client chrome.
// Used by both protected routes ((dashboard)/layout) and public ones (prices).
import { getCachedUser } from '@/lib/supabase/server'
import { signOut } from '@/lib/actions'
import { ShellChrome } from './shell-chrome'

export default async function AppShell({
  children,
}: {
  children: React.ReactNode
}) {
  const {
    data: { user },
  } = await getCachedUser()

  return (
    <ShellChrome email={user?.email ?? null} signOutAction={signOut}>
      {children}
    </ShellChrome>
  )
}
