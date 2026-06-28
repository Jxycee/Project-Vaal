import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/vaal-emblem.png" alt="" className="mb-6 size-150 opacity-95" />

      <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
        Project Vaal
      </h1>

                  {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ornaments/divider.png" alt="" className="my-5 h-auto w-72 opacity-80 sm:w-100" />

            <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Path of Exile 2 · Console Companion
      </p>

      <div className="mt-4 flex items-center justify-center gap-4 flex-col sm:flex-row">
        <Button asChild size="lg" className="h-11 px-6 text-base">
          <Link href="/prices">Check prices</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-11 px-6 text-base">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        Live now: currency &amp; item prices. Coming soon: passive tree, campaign
        tracker, build planner, and wiki.
      </p>
    </main>
  )
}
