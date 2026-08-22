import type { ReactNode } from 'react';

/**
 * Official Xbox face-button colors, and the PlayStation face button that
 * occupies the same physical position (bottom/right/left/top) - the
 * standard cross-platform mapping (Xbox A <-> PS Cross, B <-> Circle,
 * X <-> Square, Y <-> Triangle), each with its own official color. `ps` is
 * an inline SVG icon rather than a unicode glyph (□ △ ○ ✕): unicode glyphs
 * render at inconsistent sizes/weights against the adjacent bold letter and
 * against each other (font-dependent), and the PS Cross glyph in particular
 * reads as a second, confusingly different-looking "X" right next to the
 * Xbox X button's actual letter. A same-size stroke icon fixes both.
 */
const BUTTON_GLYPH: Record<string, { xbox: string; xboxColor: string; ps: ReactNode; psColor: string }> = {
  a: { xbox: 'A', xboxColor: '#107C10', ps: <PsCross />, psColor: '#2E5FE8' },
  b: { xbox: 'B', xboxColor: '#D0021B', ps: <PsCircle />, psColor: '#E0243F' },
  x: { xbox: 'X', xboxColor: '#0F62C4', ps: <PsSquare />, psColor: '#D93FC7' },
  y: { xbox: 'Y', xboxColor: '#C9A400', ps: <PsTriangle />, psColor: '#1FA65A' },
};

const ICON_BOX = 'inline-flex h-4 w-4 shrink-0 items-center justify-center';

function PsCross() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function PsCircle() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="8" r="5.4" />
    </svg>
  );
}

function PsSquare() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <rect x="3.3" y="3.3" width="9.4" height="9.4" rx="1" />
    </svg>
  );
}

function PsTriangle() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M8 3.2l5 9.6h-10z" />
    </svg>
  );
}

/** Renders one console button as its Xbox letter and PlayStation icon, colored, joined by "/" - both sized to the same fixed box so neither dominates the other. */
export function ConsoleButtonBadge({ button }: { button: string }) {
  const glyph = BUTTON_GLYPH[button.toLowerCase()];
  if (!glyph) return <span className="font-semibold not-italic">{button.toUpperCase()}</span>;
  return (
    <span className="inline-flex items-center gap-0.5 align-middle font-semibold not-italic">
      <span className={ICON_BOX} style={{ color: glyph.xboxColor }}>{glyph.xbox}</span>
      <span className="text-muted-foreground">/</span>
      <span className={ICON_BOX} style={{ color: glyph.psColor }}>{glyph.ps}</span>
    </span>
  );
}

const CLICK_PHRASE_RE = /(Right click|left click)/g;

/**
 * Splits PC `directions` text on its "Right click" / "left click" phrases
 * and replaces each, in order, with the matching {@link ConsoleButtonBadge}
 * from `buttons` - the combined result reads as one directions line with
 * console button prompts standing in for the PC-only mouse phrasing,
 * instead of two separate PC/console paragraphs.
 */
export function mergeDirectionsWithConsoleButtons(directions: string, buttons: string[]): ReactNode[] {
  let buttonIndex = 0;
  return directions.split(CLICK_PHRASE_RE).map((part, i) => {
    if (part === 'Right click' || part === 'left click') {
      return <ConsoleButtonBadge key={i} button={buttons[buttonIndex++]} />;
    }
    return part;
  });
}
