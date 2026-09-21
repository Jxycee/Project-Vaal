'use client';

// The "Jewels" chip in TreeBuildSession's notice column, next to the Gear
// chip — always rendered (see docs/superpowers/specs/2026-09-20-jewels-
// design.md: "it should be clear to the user that the box exists"). Tapping
// it opens JewelsSheet.
//
// Theming: the box, border and icon slots below are original Project Vaal
// chrome built from the existing token vocabulary (bg-card/95 via bg-card/90,
// border-border, backdrop-blur) — never a recreation of the game's own jewel
// panel. The item icons rendered inside ARE real wiki item icons, which is
// within AGENTS.md's sanctioned exception (they depict actual in-game items
// sourced from official patch data): our frame, their items.
import type { JewelsSummary } from '@/lib/build/jewelState';

// Caps how many socket icons the collapsed chip renders. A build with many
// allocated sockets could otherwise grow this chip wide enough to overflow a
// 375px viewport — e2e/mobile-layout.spec.ts fails the build on exactly that
// ("no horizontal page scroll"). The full list is always available in the
// sheet regardless of this cap.
const JEWEL_CHIP_ICON_LIMIT = 6;

export default function JewelsChip({ summary, onOpen }: { summary: JewelsSummary; onOpen: () => void }) {
  const totalSockets = summary.sockets.length;
  const hasOrphans = summary.orphans.length > 0;

  if (totalSockets === 0 && !hasOrphans) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex h-11 items-center gap-1.5 rounded-lg border border-border bg-card/90 px-3 text-sm font-medium text-foreground backdrop-blur"
      >
        Jewels — allocate a socket on the tree
      </button>
    );
  }

  const shown = summary.sockets.slice(0, JEWEL_CHIP_ICON_LIMIT);
  const hiddenCount = totalSockets - shown.length;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-11 items-center gap-1.5 rounded-lg border border-border bg-card/90 px-3 text-sm font-medium text-foreground backdrop-blur"
    >
      <span>
        Jewels {summary.filledCount}/{totalSockets}
      </span>
      <span className="flex items-center gap-1">
        {shown.map((socket) => (
          <span
            key={socket.id}
            className={
              socket.item
                ? 'flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded border border-border'
                : 'flex h-5 w-5 shrink-0 items-center justify-center rounded border border-dashed border-border/70'
            }
          >
            {socket.item?.iconUrl ? (
              // Plain <img>, not next/image — see GearSheet.tsx's SlotRow
              // comment. This icon is under /data/wiki/ (a session-cookie-
              // protected prefix, see src/proxy.ts); next/image's
              // server-side optimizer fetch can't carry that cookie and
              // would get redirected to /login instead of the image.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={socket.item.iconUrl} alt="" className="h-full w-full object-contain" />
            ) : null}
          </span>
        ))}
        {hiddenCount > 0 ? <span className="text-xs text-muted-foreground">+{hiddenCount}</span> : null}
      </span>
      {hasOrphans ? (
        <span className="text-xs text-muted-foreground">{summary.orphans.length} unsocketed</span>
      ) : null}
    </button>
  );
}
