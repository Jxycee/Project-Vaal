// src/lib/build/gemState.ts
// =============================================================================
// Gem-loadout state storage helpers — the gem analogue of gearState.ts.
//
// Stored in builds.gem_state as a jsonb object, `{ loadouts, primaryId }`.
// The column is NOT NULL with a `{}` default (see POST /api/builds), so
// parseGemState defensively validates whatever jsonb comes back (a hand-
// edited row, a future migration, a slug that no longer parses) rather than
// trusting the database — same reasoning as parseGearState.
//
// Pure module: no React, no fetch. This is the unit-test target for
// everything gem-related that isn't wiring (see __tests__/gemState.test.ts).
// =============================================================================

import type { WeaponSet } from '@poe2-toolkit/tree-core';
import { isGearItem } from './gearState'; // already exported and already unit-tested
import type { GearItem } from './gearSlots';
import { MAX_SUPPORTS_PER_SKILL } from './gemSlots';

export interface GemLoadout {
  /** Stable, client-generated. Identity has to survive reordering and removal, so it cannot be the array index. */
  id: string;
  skill: GearItem | null;
  /** At most MAX_SUPPORTS_PER_SKILL. */
  supports: GearItem[];
  /**
   * Weapon sets this loadout is active in. `[1, 2]` means "both", spelled
   * the same way passive_state spells an untagged node (present in both
   * set1 and set2) — one vocabulary, not two.
   */
  sets: WeaponSet[];
}

export interface GemState {
  loadouts: GemLoadout[];
  /** Which loadout's skill populates builds.main_skill. Null until one is set. */
  primaryId: string | null;
}

/** All loadouts empty, no primary — the starting state for a build with no gems yet. */
export function emptyGemState(): GemState {
  return { loadouts: [], primaryId: null };
}

/**
 * Client-generated stable id for a new loadout. Deliberately NOT
 * `crypto.randomUUID()` — that API is undefined on insecure origins, and
 * this runs in the browser.
 */
function newLoadoutId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newLoadout(): GemLoadout {
  return { id: newLoadoutId(), skill: null, supports: [], sets: [1, 2] };
}

/** Normalises a `sets` value: keeps only 1/2, dedupes, sorts, falls back to `[1, 2]` when empty. */
function normalizeSets(value: readonly number[]): WeaponSet[] {
  const kept = Array.from(new Set(value.filter((n): n is WeaponSet => n === 1 || n === 2))).sort();
  return kept.length > 0 ? kept : [1, 2];
}

function parseLoadout(raw: unknown): GemLoadout | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.id !== 'string' || v.id.length === 0) return null;

  const skill = isGearItem(v.skill) ? v.skill : null;
  const supports = (Array.isArray(v.supports) ? v.supports : [])
    .filter((item): item is GearItem => isGearItem(item))
    .slice(0, MAX_SUPPORTS_PER_SKILL);
  const sets = normalizeSets(Array.isArray(v.sets) ? (v.sets as unknown[]).filter((n): n is number => typeof n === 'number') : []);

  return { id: v.id, skill, supports, sets };
}

/**
 * `builds.gem_state` (raw jsonb) -> typed `GemState`.
 *
 * One malformed loadout is dropped entirely rather than blanking the whole
 * array — the same "one bad slot must not blank the others" rule
 * parseGearState follows. `primaryId` is kept only if it still points at a
 * surviving loadout.
 */
export function parseGemState(raw: unknown): GemState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return emptyGemState();
  const v = raw as Record<string, unknown>;

  const loadouts = (Array.isArray(v.loadouts) ? v.loadouts : [])
    .map(parseLoadout)
    .filter((l): l is GemLoadout => l !== null);

  const primaryId =
    typeof v.primaryId === 'string' && loadouts.some((l) => l.id === v.primaryId) ? v.primaryId : null;

  return { loadouts, primaryId };
}

/** Appends a fresh empty loadout. */
export function addLoadout(state: GemState): GemState {
  return { ...state, loadouts: [...state.loadouts, newLoadout()] };
}

/** Removes a loadout by id. Clears `primaryId` if it pointed there. */
export function removeLoadout(state: GemState, id: string): GemState {
  return {
    loadouts: state.loadouts.filter((l) => l.id !== id),
    primaryId: state.primaryId === id ? null : state.primaryId,
  };
}

function updateLoadout(state: GemState, id: string, update: (loadout: GemLoadout) => GemLoadout): GemState {
  return { ...state, loadouts: state.loadouts.map((l) => (l.id === id ? update(l) : l)) };
}

export function setSkill(state: GemState, id: string, item: GearItem | null): GemState {
  return updateLoadout(state, id, (l) => ({ ...l, skill: item }));
}

/** No-op at the cap — returns an equal (by value) state rather than throwing or silently truncating. */
export function addSupport(state: GemState, id: string, item: GearItem): GemState {
  return updateLoadout(state, id, (l) =>
    l.supports.length >= MAX_SUPPORTS_PER_SKILL ? l : { ...l, supports: [...l.supports, item] },
  );
}

export function removeSupport(state: GemState, id: string, index: number): GemState {
  return updateLoadout(state, id, (l) => ({ ...l, supports: l.supports.filter((_, i) => i !== index) }));
}

export function setSets(state: GemState, id: string, sets: readonly WeaponSet[]): GemState {
  return updateLoadout(state, id, (l) => ({ ...l, sets: normalizeSets(sets) }));
}

export function setPrimary(state: GemState, id: string): GemState {
  return { ...state, primaryId: id };
}

/**
 * The primary loadout's skill name populates `builds.main_skill`. If no
 * primary is set, or the primary loadout has no skill, falls back to the
 * first loadout (insertion order) that has one. `null` when nothing in the
 * state has a skill at all. The single definition of what `main_skill`
 * means — TreeBuildSession only calls this, it never re-derives the rule.
 */
export function deriveMainSkill(state: GemState): string | null {
  const primary = state.primaryId ? state.loadouts.find((l) => l.id === state.primaryId) : undefined;
  if (primary?.skill) return primary.skill.name;
  const firstWithSkill = state.loadouts.find((l) => l.skill !== null);
  return firstWithSkill?.skill?.name ?? null;
}
