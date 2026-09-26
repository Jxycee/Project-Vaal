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
import { isGearItem, withSafeIcon } from './gearState'; // already exported and already unit-tested
import { isSafeItemSlug } from './iconUrl';
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
  /**
   * The SKILL's gem level. Default 1. Its upper bound is per-gem — read from
   * that gem's `scaling[]` max `level` in its wiki detail JSON (see
   * `fetchMaxGemLevel`, `src/lib/wiki/fetchGemScaling.ts`) — 40 for most
   * Active Skill Gems, lower for some Spirit gems, capped at 1 when that
   * data is unavailable. This module has no fetch access and does not know
   * that cap; it only guarantees an integer >= 1 (see `setLevel`). The UI
   * layer is responsible for clamping to the fetched per-gem max before
   * calling `setLevel`.
   *
   * Deliberately NOT present on individual support items: every sampled
   * Support Gem in our data caps at level 1 (see CURRENT-STATE.md), so a
   * per-support level field would have nothing to represent. Do not add one.
   */
  level: number;
  /**
   * The SKILL's gem quality, 0–20. Default 0. **The 0–20 bound is an
   * assumption, not data-backed** — no file under public/data/wiki carries a
   * `quality` field on any skill (200 files checked, see CURRENT-STATE.md),
   * so this exists purely for storage fidelity and future import/export; it
   * is never validated against real gem data and has no gameplay effect
   * applied anywhere in this codebase.
   *
   * Also NOT present on supports — same reasoning as `level` above.
   */
  quality: number;
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

/** Upper bound for `GemLoadout.quality` — an assumption, not data-backed. See that field's doc comment. */
export const MAX_GEM_QUALITY = 20;

export function newLoadout(): GemLoadout {
  return { id: newLoadoutId(), skill: null, supports: [], sets: [1, 2], level: 1, quality: 0 };
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

  // Same reader rule as gear: a path-shaped slug drops the item, an off-origin
  // icon is blanked (see iconUrl.ts).
  const isSafeGem = (item: unknown): item is GearItem => isGearItem(item) && isSafeItemSlug(item.slug);
  const skill = isSafeGem(v.skill) ? withSafeIcon(v.skill) : null;
  const supports = (Array.isArray(v.supports) ? v.supports : [])
    .filter(isSafeGem)
    .slice(0, MAX_SUPPORTS_PER_SKILL)
    .map(withSafeIcon);
  const sets = normalizeSets(Array.isArray(v.sets) ? (v.sets as unknown[]).filter((n): n is number => typeof n === 'number') : []);

  // Old gem states (pre-level/quality) never carried these keys — migrate
  // silently to the defaults rather than rejecting the stored loadout.
  // Malformed/out-of-range values fall back the same way, via the same
  // clamps `setLevel`/`setQuality` apply on write.
  const level = typeof v.level === 'number' && Number.isFinite(v.level) ? Math.max(1, Math.trunc(v.level)) : 1;
  const quality =
    typeof v.quality === 'number' && Number.isFinite(v.quality)
      ? Math.min(MAX_GEM_QUALITY, Math.max(0, Math.trunc(v.quality)))
      : 0;

  return { id: v.id, skill, supports, sets, level, quality };
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

/**
 * Sets the loadout's gem level. Only guarantees an integer >= 1 — this
 * module doesn't know any individual gem's per-gem max (that lives in wiki
 * scaling data this module never fetches), so clamping to that upper bound
 * is the caller's job (see GemLoadout.level's doc comment).
 */
export function setLevel(state: GemState, id: string, level: number): GemState {
  const clamped = Number.isFinite(level) ? Math.max(1, Math.trunc(level)) : 1;
  return updateLoadout(state, id, (l) => ({ ...l, level: clamped }));
}

/** Sets the loadout's gem quality, clamped to 0–MAX_GEM_QUALITY. See that constant's doc comment — the bound is an assumption, not data-backed. */
export function setQuality(state: GemState, id: string, quality: number): GemState {
  const clamped = Number.isFinite(quality) ? Math.min(MAX_GEM_QUALITY, Math.max(0, Math.trunc(quality))) : 0;
  return updateLoadout(state, id, (l) => ({ ...l, quality: clamped }));
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
