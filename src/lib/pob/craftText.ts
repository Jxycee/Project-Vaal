// src/lib/pob/craftText.ts
// =============================================================================
// Reading PoB item text against our data's display templates (Slice 4).
//
// PoB writes each line as clipboard text, prefixed with `{…}` markup
// (`{range:0.5}`, `{tags:attribute}`, `{enchant}`) and sometimes still ranged:
// "+(30-50)% to Fire Resistance" plus a fraction. Our data writes the same
// line as a template: "+(30-50)% to Fire Resistance". A line matches a
// template when every fixed character and fixed number is identical, and
// every "(a-b)" in the template is filled by a number inside that range — or
// by the same "(a-b)" in PoB's own ranged form, read at its fraction the way
// PoB's itemLib.applyRange does (src/Modules/ItemTools.lua:130).
// =============================================================================

const NUM = '(-?\\d+(?:\\.\\d+)?)';
const RANGE_RE = /\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)/g;

/** PoB's `{…}` markup at the start of a line, removed. */
export function stripTags(line: string): string {
  return line.replace(/^(\{[^}]*\})+/, '');
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** PoB rounds an integer range's value to a whole number; a decimal range keeps its precision. */
function valueAt(min: number, max: number, fraction: number): number {
  const v = min + fraction * (max - min);
  return Number.isInteger(min) && Number.isInteger(max) ? Math.round(v) : v;
}

/**
 * The numbers `line` fills into `template`'s ranges, in order — or null when
 * the line is not an instance of the template. `fraction` reads a line PoB
 * still writes as a range (PoB's own default is 0.5).
 */
export function matchTemplate(line: string, template: string, fraction = 0.5): number[] | null {
  const ranges: { min: number; max: number }[] = [];
  let pattern = '^';
  let last = 0;
  for (const m of template.matchAll(RANGE_RE)) {
    pattern += escapeRegex(template.slice(last, m.index));
    pattern += `(?:\\(${NUM}-${NUM}\\)|${NUM})`;
    ranges.push({ min: Number(m[1]), max: Number(m[2]) });
    last = m.index! + m[0].length;
  }
  pattern += `${escapeRegex(template.slice(last))}$`;

  const found = new RegExp(pattern).exec(line);
  if (!found) return null;

  const values: number[] = [];
  for (let i = 0; i < ranges.length; i++) {
    const { min, max } = ranges[i];
    const [rangedMin, rangedMax, single] = found.slice(1 + i * 3, 4 + i * 3);
    if (single !== undefined) {
      const v = Number(single);
      if (v < Math.min(min, max) || v > Math.max(min, max)) return null;
      values.push(v);
    } else {
      if (Number(rangedMin) !== min || Number(rangedMax) !== max) return null;
      values.push(valueAt(min, max, fraction));
    }
  }
  return values;
}
