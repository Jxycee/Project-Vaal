// /dashboard — authenticated landing. Live tools + upcoming features.
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { VaalOrb } from '@/components/dashboard/vaal-orb'
import { Icon } from '@/components/ui/icon'
import { Card } from '@/components/ui/card'

const LIVE_TOOLS = [
  {
    href: '/prices',
    title: 'Prices',
    icon: 'prices',
    blurb: 'Currency exchange rates and item prices, synced hourly.',
  },
  {
    href: '/tree',
    title: 'Passive Tree',
    icon: 'tree',
    blurb: 'Interactive skill tree viewer and planner.',
  },
] as const

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
    <div className="flex flex-col gap-8 overflow-x-clip pb-6 sm:gap-10">
      <style>{`
        .vaal-orb-stage canvas {
          display: block;
          z-index: 1;
          touch-action: pan-y !important;
        }
      `}</style>

      <section className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)] lg:gap-8 xl:gap-12">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card/45 p-5 shadow-[0_24px_70px_-44px_rgba(0,0,0,0.9)] sm:p-8 lg:p-9">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_40%)]" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-primary/25 to-transparent" />

          <div className="relative z-10 max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
              Project Vaal
            </p>
            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome back
            </h1>
            <p className="mt-2 break-all text-sm text-muted-foreground sm:break-normal">
              Signed in as {account}
            </p>

            <Image
              src="/ornaments/divider.png"
              alt=""
              width={1096}
              height={182}
              sizes="(max-width: 640px) 200px, 240px"
              className="mt-5 h-auto w-48 opacity-80 sm:w-60"
            />

            <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
              Price checks, passive-tree planning, and character tools for Path of Exile 2.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap">
              <Link
                href="/prices"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto"
              >
                <Icon name="prices" className="size-4" />
                Check prices
              </Link>
              <Link
                href="/tree"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-background/45 px-4 text-sm font-medium text-foreground transition-colors hover:border-primary/35 hover:bg-accent/50 sm:w-auto"
              >
                <Icon name="tree" className="size-4 text-primary" />
                Open passive tree
              </Link>
            </div>
          </div>
        </div>

        <div className="relative mx-auto h-[20rem] w-full max-w-[30rem] overflow-visible sm:h-[24rem] lg:h-[28rem] lg:max-w-none xl:h-[30rem]">
          <div className="pointer-events-none absolute inset-[14%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_68%)] blur-2xl" />

          {/* Keep positioning on a wrapper. VaalOrb itself stays relative so its
              absolutely positioned WebGL canvas receives a real width/height. */}
          <div className="absolute inset-x-0 -inset-y-8 z-10 sm:-inset-x-8 sm:-inset-y-12 lg:-inset-x-12 lg:-inset-y-14">
            <VaalOrb className="vaal-orb-stage h-full w-full" />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-primary">
              Available now
            </p>
            <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight">Tools</h2>
          </div>
          <span className="text-xs text-muted-foreground">2 live</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {LIVE_TOOLS.map((item) => (
            <Link key={item.href} href={item.href} className="group">
              <Card className="relative h-full overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent/35 hover:shadow-[0_18px_45px_-30px_color-mix(in_oklab,var(--primary)_45%,transparent)] sm:p-5">
                <div className="pointer-events-none absolute right-0 top-0 size-28 translate-x-1/3 -translate-y-1/3 rounded-full bg-primary/8 blur-2xl transition-opacity group-hover:opacity-100" />
                <div className="relative flex items-start gap-3 sm:gap-4">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 sm:size-11">
                    <Icon name={item.icon} className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-medium">{item.title}</h3>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.68rem] font-medium text-primary">
                        Live
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.blurb}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      Open tool
                      <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                        →
                      </span>
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            In development
          </p>
          <h2 className="mt-1 font-heading text-lg font-semibold tracking-tight">Coming next</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {COMING_SOON.map((item) => (
            <Card
              key={item.title}
              aria-disabled="true"
              className="border-dashed bg-card/30 p-4 opacity-75"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Icon name={item.icon} className="size-5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{item.title}</span>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                  Soon
                </span>
              </div>
              <p className="mt-3 text-sm leading-5 text-muted-foreground">{item.blurb}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
