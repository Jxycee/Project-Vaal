// =============================================================================
// /dashboard — authenticated landing page.
//
// Minimal overview that closes the auth loop (login redirects here). Greets the
// signed-in user and links only to what works today (Prices). Unbuilt features
// are disabled "Soon" tiles so nothing 404s. As features ship
// (passive tree -> campaign -> builds -> wiki) flip each tile into a real Link.
// =============================================================================

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// Build order from the plan: passive tree -> campaign -> builds -> wiki.
const COMING_SOON = [
  { title: 'Passive Tree', blurb: 'Interactive skill tree viewer and planner.' },
  { title: 'Campaign Tracker', blurb: 'Per-character checklist for every act.' },
  { title: 'Build Planner', blurb: 'Create, save, and share builds via link.' },
  { title: 'Item Wiki', blurb: 'Searchable bases, mods, and skill gems.' },
] as const

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware guarantees a session here; fall back gracefully just in case.
  const account = user?.email ?? 'Exile'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {account}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tools
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/prices"
            className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">Prices</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-medium text-primary">
                Live
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Currency exchange rates and item prices, synced hourly.
            </p>
          </Link>

          {COMING_SOON.map((item) => (
            <div
              key={item.title}
              aria-disabled="true"
              className="rounded-xl border border-dashed bg-card/50 p-4 text-card-foreground opacity-70"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{item.title}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                  Soon
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.blurb}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}