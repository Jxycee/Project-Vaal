// src/lib/tree/jewelSockets.ts
// =============================================================================
// Jewel socket resolution from the raw GGG tree export.
//
// TreeBuildSession derives which passive-tree sockets exist directly from
// `raw` (the GGG export it already holds as a prop) rather than from
// PassiveTree's normalized TreeData, so this feature never has to touch
// PassiveTree's onStateChange contract — see
// docs/superpowers/specs/2026-09-20-jewels-design.md.
//
// Two GGG quirks verified against public/data/tree/0.5.2/data.json (31
// jewelSlots ids, 19 resolve, 12 do not):
//
//  - `raw.jewelSlots` is typed `(string | number)[]` by the toolkit
//    (@poe2-toolkit/tree-core's ggg/normalize.d.ts). A string/number mismatch
//    against `raw.nodes`' (numeric) ids would silently make every socket look
//    unallocated with no error, so every id is run through `Number()` first.
//  - 12 of the 31 ids do not exist in `raw.nodes` at all. Blind dereference
//    yields `undefined` for nearly 40% of them; every id here is filtered to
//    ones that actually resolve to a real node.
//  - Socket names are raw GGG markup, not display text — e.g.
//    "[SinisterJewelSockets|Sinister] [Jewel] Socket" should read "Sinister
//    Jewel Socket". `parseStatText` (./statText.ts) already unwraps this
//    exact bracket-token family for the tree's stat tooltips, so it's reused
//    here rather than writing a second parser for the same markup.
// =============================================================================

import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { parseStatText } from './statText';

export interface JewelSocketDef {
  id: number;
  /** Display name, normalised from GGG's raw bracket-token markup. */
  name: string;
}

/**
 * Every jewel-socket node id from `raw.jewelSlots` that actually resolves to
 * a node in `raw.nodes`, with its display name normalised. Order follows
 * `raw.jewelSlots`. A ~40% dangling rate is real (see header comment), not a
 * hypothetical edge case — this is the one place that filter is applied, so
 * every caller (the chip, the sheet, the dev test hook) sees the same 19.
 */
export function resolvableJewelSockets(raw: GggTreeJson): JewelSocketDef[] {
  const slots = raw.jewelSlots ?? [];
  const seen = new Set<number>();
  const result: JewelSocketDef[] = [];
  for (const rawId of slots) {
    const id = Number(rawId);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    const node = raw.nodes[id];
    if (!node) continue;
    seen.add(id);
    result.push({ id, name: parseStatText(node.name ?? '') });
  }
  return result;
}
