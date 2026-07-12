// /dashboard — authenticated landing. Live Prices tile + dimmed "Soon" tiles.
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { VaalOrb } from '@/components/dashboard/vaal-orb'
import { Icon } from '@/components/ui/icon'
import { Card } from '@/components/ui/card'

const COMING_SOON = [
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
      <section className="relative overflow-hidden rounded-xl border border-border bg-card/35">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_50%,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_42%)]" />

        <div className="grid min-h-72 md:grid-cols-[minmax(0,1fr)_18rem] md:items-stretch">
          <div className="relative z-10 flex flex-col justify-center p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
              Project Vaal
            </p>
            <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Signed in as {account}</p>

            <Image
              src="/ornaments/divider.png"
              alt=""
              width={1096}
              height={182}
              sizes="192px"
              className="mt-4 h-auto w-48 opacity-80"
            />

            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Price checks, passive-tree planning, and character tools for Path of Exile 2.
            </p>
          </div>

          <VaalOrb className="h-64 min-h-64 md:h-72" />
        </div>
      </section>

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

          <Link href="/tree" className="group">
            <Card className="h-full p-4 transition-colors hover:border-primary/40 hover:bg-accent/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Icon name="tree" className="size-5 text-primary" />
                  <span className="font-medium">Passive Tree</span>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-medium text-primary">
                  Live
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Interactive skill tree viewer and planner.
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
