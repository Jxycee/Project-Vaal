// src/lib/build/jewelState.ts
// =============================================================================
// Jewel-panel view model — combines the tree's resolved jewel sockets with a
// build's stored jewels into what the Jewels chip/sheet render.
//
// Deliberately separate from gearState.ts, which owns storage/validation for
// `gear_state.jewels` itself: this module has no opinion on persistence, only
// on "given these allocated node ids and this jewels map, what's socketed and
// what's orphaned right now." See
// docs/superpowers/specs/2026-09-20-jewels-design.md.
// =============================================================================

import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { resolvableJewelSockets } from '@/lib/tree/jewelSockets';
import type { GearItem } from './gearSlots';

export interface JewelSocketView {
  id: number;
  name: string;
  item: GearItem | null;
}

export interface JewelOrphan {
  /** The socket id as stored in `gear_state.jewels` (its object key — a string, since it round-trips through jsonb). */
  socketId: string;
  name: string;
  item: GearItem;
}

export interface JewelsSummary {
  /** Sockets currently allocated on the tree, in tree-export order. */
  sockets: JewelSocketView[];
  /** Jewels whose socket is no longer allocated — see the orphan rule below. */
  orphans: JewelOrphan[];
  filledCount: number;
}

/**
 * Builds the jewels view for the current tree allocation.
 *
 * `jewels` is keyed by socket node id (as a string, since it round-trips
 * through jsonb) — see gearState.ts. A jewel stays in `jewels` even after its
 * socket is deallocated: the orphan rule is that respeccing must never
 * silently discard a chosen item. This function enforces that by construction
 * rather than by remembering to — it never deletes a `jewels` entry, only
 * classifies each one as socketed (its id is in `allocated`) or orphaned
 * (it isn't) against the CURRENT allocation. Pruning only ever happens
 * through an explicit user action (JewelsSheet's Clear/Remove), which calls a
 * different, caller-owned code path entirely.
 */
export function summarizeJewels(
  raw: GggTreeJson,
  allocated: readonly number[],
  jewels: Record<string, GearItem>,
): JewelsSummary {
  const resolvable = resolvableJewelSockets(raw);
  const allocatedIds = new Set(allocated);
  const nameById = new Map(resolvable.map((s) => [s.id, s.name] as const));

  const sockets: JewelSocketView[] = resolvable
    .filter((s) => allocatedIds.has(s.id))
    .map((s) => ({ id: s.id, name: s.name, item: jewels[String(s.id)] ?? null }));

  const socketIdSet = new Set(sockets.map((s) => s.id));
  const orphans: JewelOrphan[] = Object.entries(jewels)
    .filter(([socketId]) => !socketIdSet.has(Number(socketId)))
    .map(([socketId, item]) => ({
      socketId,
      name: nameById.get(Number(socketId)) ?? `Socket ${socketId}`,
      item,
    }));

  const filledCount = sockets.filter((s) => s.item !== null).length;

  return { sockets, orphans, filledCount };
}
