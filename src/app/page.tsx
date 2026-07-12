import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      {/* w-based + h-auto preserves aspect ratio; max-w-[70vw] stops it
          overflowing or distorting on small phones. This is the page's LCP
          element — `priority` disables lazy-loading and sets fetchpriority=high;
          `sizes` matches the actual w-84/sm:w-96/max-w-[88vw] responsive widths
          so next/image requests an appropriately small variant instead of
          always serving the full 1024x1024 source (was ~1.4MB, the single
          biggest contributor to a 10s+ LCP). */}
      <Image
        src="/brand/vaal-emblem.png"
        alt=""
        width={384}
        height={384}
        priority
        sizes="(max-width: 381px) 88vw, (max-width: 639px) 336px, 384px"
        className="mb-6 h-auto w-84 max-w-[88vw] opacity-95 sm:w-96"
      />

      <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
        Project Vaal
      </h1>

      {/* Same treatment as the emblem above: real intrinsic size (1096x182)
          instead of a bare <img>, so next/image serves a properly-sized,
          modern-format variant instead of the full source (was ~40KB,
          mostly wasted at this display size per Lighthouse). Not `priority`
          — this isn't the LCP element. */}
      <Image
        src="/ornaments/divider.png"
        alt=""
        width={1096}
        height={182}
        sizes="(max-width: 639px) 80vw, 320px"
        className="my-5 h-auto w-64 max-w-[80vw] opacity-80 sm:w-80"
      />

      <p className="mb-6 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Path of Exile 2 · Console Companion
      </p>

      <div className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
        <Button asChild size="lg" className="h-11 w-full px-6 text-base sm:w-auto">
          <Link href="/prices">Check prices</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="h-11 w-full px-6 text-base sm:w-auto"
        >
          <Link href="/login">Sign in</Link>
        </Button>
      </div>

      <p className="mt-10 max-w-md text-balance text-sm text-muted-foreground">
        Live now: currency &amp; item prices, passive skill tree. Coming soon: campaign
        tracker, build planner, and wiki.
      </p>
    </main>
  )
}
