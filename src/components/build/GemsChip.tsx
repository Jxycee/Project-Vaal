'use client';

// The "Gems" chip in TreeBuildSession's notice column, next to Gear and
// Jewels — always rendered, same reasoning as JewelsChip (it should be clear
// to the user that the box exists). Tapping it opens GemsSheet.
//
// Theming: the box, border and icon slots below are original Project Vaal
// chrome built from the existing token vocabulary (bg-card/90, border-border,
// backdrop-blur) — never a recreation of the game's own gem panel. The gem
// icons rendered inside ARE real wiki icons, which is within AGENTS.md's
// sanctioned exception (they depict actual in-game skills sourced from
// official patch data): our frame, their gems.
import type { GemLoadout } from '@/lib/build/gemState';

// Caps how many skill icons the collapsed chip renders. A build with many
// loadouts could otherwise grow this chip wide enough to overflow a 375px
// viewport — e2e/mobile-layout.spec.ts fails the build on exactly that ("no
// horizontal page scroll"). The full list is always available in the sheet
// regardless of this cap.
const GEM_CHIP_ICON_LIMIT = 6;

export default function GemsChip({ loadouts, onOpen }: { loadouts: GemLoadout[]; onOpen: () => void }) {
  if (loadouts.length === 0) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex h-11 items-center gap-1.5 rounded-lg border border-border bg-card/90 px-3 text-sm font-medium text-foreground backdrop-blur"
      >
        Gems — add a skill
      </button>
    );
  }

  const shown = loadouts.slice(0, GEM_CHIP_ICON_LIMIT);
  const hiddenCount = loadouts.length - shown.length;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-11 items-center gap-1.5 rounded-lg border border-border bg-card/90 px-3 text-sm font-medium text-foreground backdrop-blur"
    >
      <span>Gems {loadouts.length}</span>
      <span className="flex items-center gap-1">
        {shown.map((loadout) => (
          <span
            key={loadout.id}
            className={
              loadout.skill
                ? 'flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded border border-border'
                : 'flex h-5 w-5 shrink-0 items-center justify-center rounded border border-dashed border-border/70'
            }
          >
            {loadout.skill?.iconUrl ? (
              // Plain <img>, not next/image — see GearSheet.tsx's SlotRow
              // comment. This icon is under /data/wiki/ (a session-cookie-
              // protected prefix, see src/proxy.ts); next/image's
              // server-side optimizer fetch can't carry that cookie and
              // would get redirected to /login instead of the image.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={loadout.skill.iconUrl} alt="" className="h-full w-full object-contain" />
            ) : null}
          </span>
        ))}
        {hiddenCount > 0 ? <span className="text-xs text-muted-foreground">+{hiddenCount}</span> : null}
      </span>
    </button>
  );
}
