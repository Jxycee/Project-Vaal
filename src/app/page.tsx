import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Path of Exile 2 · Console
      </p>

      <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
        Project Vaal
      </h1>

      <p className="mt-4 max-w-md text-balance text-muted-foreground">
        A free companion for Path of Exile 2 on PlayStation and Xbox — the
        tools console players can&apos;t get on PC, built for your phone.
      </p>

      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center">
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