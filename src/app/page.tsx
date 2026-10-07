import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { GildedFrame } from '@/components/landing/gilded-frame'

export default function Home() {
  return (
    <>
    <GildedFrame />
    <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col items-center justify-center px-8 py-20 text-center sm:px-4 sm:py-16 md:h-dvh md:min-h-0 md:overflow-hidden md:py-4">
      {/* w-based + h-auto preserves aspect ratio; max-w-[70vw] stops it
          overflowing or distorting on small phones. This is the page's LCP
          element — `priority` disables lazy-loading and sets fetchpriority=high;
          `sizes` matches the actual w-84/sm:w-96/max-w-[88vw] responsive widths
          so next/image requests an appropriately small variant instead of
          always serving the full 1024x1024 source (was ~1.4MB, the single
          biggest contributor to a 10s+ LCP). */}
      <div className="relative mb-6 md:mb-[2vh]">
        {/* Warm halo behind the emblem; decorative, slow breathing. */}
        <div
          aria-hidden="true"
          className="landing-halo absolute left-1/2 top-1/2 -z-10 size-[150%] max-h-[100vw] max-w-[100vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
        />
        <Image
          src="/brand/vaal-emblem.png"
          alt=""
          width={384}
          height={384}
          priority
          sizes="(max-width: 381px) 88vw, (max-width: 639px) 336px, 384px"
          className="h-auto w-72 max-w-[80vw] opacity-95 sm:w-96 md:w-[min(24rem,30vh)]"
        />
      </div>

      <h1 className="landing-title font-heading text-4xl font-semibold uppercase tracking-[0.06em] sm:text-5xl md:text-[clamp(1.75rem,6vh,3rem)]">
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
        className="my-5 h-auto w-64 max-w-[80vw] opacity-80 sm:w-80 md:my-[2vh] md:w-[min(20rem,34vh)]"
      />

      <p className="mb-6 text-xs md:mb-[2.5vh] font-medium uppercase tracking-[0.2em] text-muted-foreground">
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

      <p className="mt-10 max-w-md md:mt-[3vh] text-balance text-sm text-muted-foreground">
        Live now: currency &amp; item prices, passive skill tree. Coming soon: campaign
        tracker, build planner, and wiki.
      </p>

      <p className="mt-8 max-w-md md:mt-[2.5vh] text-balance text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground/70">
        Path of Exile 2 is a trademark of Grinding Gear Games. Not affiliated with or
        endorsed by Grinding Gear Games.
      </p>
      <div className="mt-2 flex items-center gap-3 text-xs font-medium text-muted-foreground">
        <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
          Terms
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <a
          href="https://github.com/Jxycee/Project-Vaal"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-foreground"
        >
          GitHub
        </a>
      </div>
    </main>
    </>
  )
}
