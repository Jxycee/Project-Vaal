// The landing page's gilded frame: a double gold hairline inset from the
// viewport edge, bracket corners and two diamond studs, with a slow glow
// (globals.css .landing-*). Purely decorative, fixed to the viewport so it
// frames the screen however tall the content is, and never takes a click.
// Design: the "C5 · Gilded glow" board of the Vaal landing options canvas.

const CORNER = 'absolute size-5 border-primary sm:size-7'
const STUD = 'landing-stud absolute left-1/2 size-2 -translate-x-1/2 rotate-45 bg-primary sm:size-2.5'

export function GildedFrame() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
      <div className="landing-frame-line absolute inset-3 sm:inset-7" />
      <div className="absolute inset-5 border border-primary/15 sm:inset-10" />
      <div className={`${CORNER} left-2 top-2 border-l-2 border-t-2 sm:left-[22px] sm:top-[22px]`} />
      <div className={`${CORNER} right-2 top-2 border-r-2 border-t-2 sm:right-[22px] sm:top-[22px]`} />
      <div className={`${CORNER} bottom-2 left-2 border-b-2 border-l-2 sm:bottom-[22px] sm:left-[22px]`} />
      <div className={`${CORNER} bottom-2 right-2 border-b-2 border-r-2 sm:bottom-[22px] sm:right-[22px]`} />
      <div className={`${STUD} top-[3px] sm:top-[22px]`} />
      <div className={`${STUD} bottom-[3px] sm:bottom-[22px]`} />
    </div>
  )
}
