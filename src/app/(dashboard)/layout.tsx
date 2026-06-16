// =============================================================================
// (dashboard)/layout.tsx — shared shell for authenticated routes.
//
// Minimal on purpose: a top bar (brand + sign out) and a centred container.
// The full app shell (desktop sidebar + mobile bottom nav) is deferred to the
// UI overhaul (plan §15). Middleware already gates every route in this group,
// so unauthenticated users never reach here. Semantic tokens only.
// =============================================================================

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { signOut } from './actions'

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link
            href="/dashboard"
            className="font-heading text-sm font-semibold tracking-tight"
          >
            Project Vaal
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  )
}