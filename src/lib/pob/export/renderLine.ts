// src/lib/pob/export/renderLine.ts
// =============================================================================
// One display template ("+(30-50)% to Fire Resistance") + the values a player
// rolled -> the line PoB2 reads ("+42% to Fire Resistance"). The inverse of
// craftText.matchTemplate, and built on the same RANGE_RE.
//
// Never leaves "(a-b)" behind: PoB reads a surviving range as a roll at its
// default fraction, which would silently change the item. A range with no
// value takes its best roll, as the editor does for a newly added affix.
// =============================================================================

import { clampToRange, RANGE_RE } from '@/lib/build/craft';

/** At most 6 decimals, no float noise (0.1 + 0.2 -> "0.3"). */
function format(value: number): string {
  return String(Math.round(value * 1e6) / 1e6);
}

export function renderLine(template: string, values: readonly number[]): string {
  let i = 0;
  return template.replace(RANGE_RE, (_match, a: string, b: string) => {
    const range = { min: Number(a), max: Number(b) };
    const value = i < values.length ? values[i] : range.max;
    i += 1;
    return format(clampToRange(value, range));
  });
}
