# Node tooltip review (board item 13)

Scope: what a phone reader sees when tapping a keystone / notable / small node at 375px, read mode.

## How it works
- `NodeTooltip.tsx` is hover-only (mouse), `pointer-events-none`. It never shows on touch. Not a phone concern.
- Touch path is `NodeInfoPanel.tsx`: tap sets `selectedNode`; panel pinned at the canvas bottom (`inset-x-3 bottom-3`). In read mode the Allocate/Remove button and the attribute chooser are not wired (checked in `PassiveTree.tsx`), so a reader gets name + stats + dismiss only.
- Stat text goes through `parseStatText`; ascendancy `nodeOverrides` names/stats are used, so Abyssal Lich-style borrowed nodes show the right text.

## Found and fixed (NodeInfoPanel.tsx)
1. Dismiss X was a 16px icon button, well under 44px. Now a 44px box, pulled into the panel corner with negative margin so the panel does not grow.
2. Long stat lists (keystones with many lines) had no height limit; the panel could grow over most of the canvas. Now `max-h-[45%]` with vertical scroll (`overscroll-contain` so it does not scroll the page).
3. Long node names could push the X off the row. Name now `min-w-0 break-words`.
4. Allocate/Remove button (edit mode on touch) was about 28px tall. Now `h-11`.

## Checked, no change
- Unusual stats: `[Token|Display]`, `[Word]`, `<tag>`, `{text}` markup handled by `parseStatText`.
- Attribute choice nodes: buttons already `h-11`; read mode shows "Set to X" or "No attribute chosen" (only for allocated attribute nodes; an unallocated one shows plain stats, correct).
- Empty stats shows "No effect." Slightly odd for class start nodes but not wrong.

## Not fixed (judgement calls, noted)
- The panel can sit over the tapped node when that node is in the bottom ~45% of the canvas. A fix means panning the tree on select, which touches TreeView focus; not minimal. The X is now easy to hit to uncover it.
- Desktop `NodeTooltip` is not clamped to the viewport; near the top or left/right edge it can clip. Mouse-only, not phone.
- No tap-a-node hook exists in `window.__vaalTree`, so no e2e assertion was added; adding one blind (Playwright not runnable here) would be a guess. Suggested follow-up: expose a `select(skill)` on the test api, then assert the Dismiss button box is at least 44px in mobile-layout.spec.ts.
