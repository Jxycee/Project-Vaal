import type { ReactNode } from 'react';

/**
 * Official Xbox face-button colors, and the PlayStation face button that
 * occupies the same physical position (bottom/right/left/top) - the
 * standard cross-platform mapping (Xbox A <-> PS Cross, B <-> Circle,
 * X <-> Square, Y <-> Triangle), each with its own official color.
 */
const BUTTON_GLYPH: Record<string, { xbox: string; xboxColor: string; ps: string; psColor: string }> = {
  a: { xbox: 'A', xboxColor: '#107C10', ps: '✕', psColor: '#2E5FE8' },
  b: { xbox: 'B', xboxColor: '#D0021B', ps: '○', psColor: '#E0243F' },
  x: { xbox: 'X', xboxColor: '#0F62C4', ps: '□', psColor: '#D93FC7' },
  y: { xbox: 'Y', xboxColor: '#C9A400', ps: '△', psColor: '#1FA65A' },
};

/** Renders one console button as its Xbox letter and PlayStation glyph, colored, joined by "/". */
export function ConsoleButtonBadge({ button }: { button: string }) {
  const glyph = BUTTON_GLYPH[button.toLowerCase()];
  if (!glyph) return <span className="font-semibold not-italic">{button.toUpperCase()}</span>;
  return (
    <span className="whitespace-nowrap font-semibold not-italic">
      <span style={{ color: glyph.xboxColor }}>{glyph.xbox}</span>
      <span className="text-muted-foreground">/</span>
      <span style={{ color: glyph.psColor }}>{glyph.ps}</span>
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
