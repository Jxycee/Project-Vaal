// /dashboard — authenticated landing. Live Prices tile + dimmed "Soon" tiles.
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Icon } from '@/components/ui/icon'
import { Card } from '@/components/ui/card'

const COMING_SOON = [
  { title: 'Passive Tree', icon: 'tree', blurb: 'Interactive skill tree viewer and planner.' },
  { title: 'Campaign Tracker', icon: 'campaign', blurb: 'Per-character checklist for every act.' },
  { title: 'Build Planner', icon: 'builds', blurb: 'Create, save, and share builds via link.' },
  { title: 'Item Wiki', icon: 'wiki', blurb: 'Searchable bases, mods, and skill gems.' },
] as const

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const account = user?.email ?? 'Exile'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Signed in as {account}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ornaments/divider.png" alt="" className="mt-4 h-auto w-48 opacity-80" />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Tools
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link href="/prices" className="group">
            <Card className="h-full p-4 transition-colors hover:border-primary/40 hover:bg-accent/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Icon name="prices" className="size-5 text-primary" />
                  <span className="font-medium">Prices</span>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-medium text-primary">
                  Live
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Currency exchange rates and item prices, synced hourly.
              </p>
            </Card>
          </Link>

          {COMING_SOON.map((item) => (
            <Card
              key={item.title}
              aria-disabled="true"
              className="border-dashed bg-card/40 p-4 opacity-70"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Icon name={item.icon} className="size-5 text-muted-foreground" />
                  <span className="font-medium">{item.title}</span>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                  Soon
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{item.blurb}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
