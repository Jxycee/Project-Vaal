// src/lib/build/stateInput.ts
// =============================================================================
// Server-side gate for tree, gear and gem state arriving from a client.
//
// parseGearState/parseGemState exist to READ stored jsonb defensively. They
// are not enough on their own for WRITES: isGearItem accepts any string as
// `iconUrl` and ignores extra properties, and nothing bounds the size of what
// is stored. Every stored item is later rendered for OTHER viewers (the
// finder, shared build pages) as a raw <img src={iconUrl}>, so an unchecked
// URL is a tracking pixel planted on every signed-in visitor.
//
// So a write goes through here: parse with the same readers (one notion of
// "valid shape"), then reject anything that is not what our own client
// produces, and store a projection carrying only the known item fields.
//
// Used by POST /api/builds and addCheckpoint. Do not write a second copy.
// =============================================================================

import { GEAR_SLOTS, type GearItem } from './gearSlots';
import { parseGearState, type GearState } from './gearState';
import { parseGemState, type GemState } from './gemState';
import type { PassiveState } from './types';

/** Serialised size cap per state column. A full build is a few KB; this is headroom, not a target. */
export const MAX_STATE_JSON_LENGTH = 64 * 1024;

/**
 * The only icon URLs our client stores: same-origin wiki icons, as written by
 * scripts/sync-wiki.ts (`/data/wiki/<version>/icons/<kind>s/<slug>.png`), plus
 * the older flat `/data/wiki/<version>/icons/<slug>.png` layout that saved
 * builds may still carry. A literal pattern, not a prefix check, so `..`,
 * `//host` and query strings cannot ride along.
 */
const ICON_URL_RE = /^\/data\/wiki\/\d{4}-\d{2}-\d{2}\/icons\/(?:[a-z]+\/)?[a-z0-9-]+\.png$/;

const MAX_TEXT_LENGTH = 200;
const MAX_LOADOUT_ID_LENGTH = 64;
const MAX_LOADOUTS = 100;
const MAX_JEWELS = 100;
const JEWEL_KEY_RE = /^\d{1,10}$/;

export type InputResult<T> = { ok: true; value: T } | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tooLarge(raw: unknown): boolean {
  try {
    return JSON.stringify(raw).length > MAX_STATE_JSON_LENGTH;
  } catch {
    return true;
  }
}

export function isAllowedIconUrl(value: string): boolean {
  return ICON_URL_RE.test(value);
}

/** Validates one item already accepted by isGearItem, and projects it to exactly the GearItem fields. */
function cleanItem(item: GearItem): GearItem | null {
  for (const text of [item.slug, item.name, item.category]) {
    if (text.length === 0 || text.length > MAX_TEXT_LENGTH) return null;
  }
  if (item.iconUrl !== null && !isAllowedIconUrl(item.iconUrl)) return null;
  return {
    slug: item.slug,
    name: item.name,
    category: item.category,
    isUnique: item.isUnique,
    iconUrl: item.iconUrl,
  };
}

function isFiniteNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((n) => typeof n === 'number' && Number.isFinite(n));
}

export function isPassiveState(value: unknown): value is PassiveState {
  if (!isPlainObject(value)) return false;
  return isFiniteNumberArray(value.set1) && isFiniteNumberArray(value.set2) && isFiniteNumberArray(value.ascendancyNodes);
}

export function cleanPassiveStateInput(raw: unknown): InputResult<PassiveState> {
  if (tooLarge(raw) || !isPassiveState(raw)) return fail('Malformed passive_state');
  return { ok: true, value: { set1: raw.set1, set2: raw.set2, ascendancyNodes: raw.ascendancyNodes } };
}

export function cleanGearStateInput(raw: unknown): InputResult<GearState> {
  if (!isPlainObject(raw) || tooLarge(raw)) return fail('Malformed gear_state');

  const parsed = parseGearState(raw);
  // The reader drops what it cannot use; a write must refuse it instead, or a
  // malformed item is silently lost with a 200.
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'jewels') continue;
    if (!(GEAR_SLOTS as readonly string[]).includes(key)) return fail('Malformed gear_state');
    if (value !== null && parsed[key as keyof GearState] === null) return fail('Malformed gear_state');
  }
  if (raw.jewels !== undefined) {
    if (!isPlainObject(raw.jewels)) return fail('Malformed gear_state');
    if (Object.keys(raw.jewels).length !== Object.keys(parsed.jewels).length) return fail('Malformed gear_state');
  }
  const out = { ...parsed, jewels: {} } as GearState;

  for (const slot of GEAR_SLOTS) {
    const item = parsed[slot];
    if (item === null) continue;
    const cleaned = cleanItem(item);
    if (!cleaned) return fail('Malformed gear_state');
    out[slot] = cleaned;
  }

  const jewelEntries = Object.entries(parsed.jewels);
  if (jewelEntries.length > MAX_JEWELS) return fail('Malformed gear_state');
  for (const [key, item] of jewelEntries) {
    const cleaned = cleanItem(item);
    if (!JEWEL_KEY_RE.test(key) || !cleaned) return fail('Malformed gear_state');
    out.jewels[key] = cleaned;
  }

  return { ok: true, value: out };
}

export function cleanGemStateInput(raw: unknown): InputResult<GemState> {
  if (!isPlainObject(raw) || tooLarge(raw)) return fail('Malformed gem_state');

  const parsed = parseGemState(raw);
  // Same refusal as gear: anything the reader would drop is an error here.
  const rawLoadouts = raw.loadouts === undefined ? [] : raw.loadouts;
  if (!Array.isArray(rawLoadouts) || rawLoadouts.length !== parsed.loadouts.length) return fail('Malformed gem_state');
  if (raw.primaryId !== undefined && raw.primaryId !== null && raw.primaryId !== parsed.primaryId) {
    return fail('Malformed gem_state');
  }
  for (let i = 0; i < rawLoadouts.length; i++) {
    const rawLoadout = rawLoadouts[i] as Record<string, unknown>;
    const loadout = parsed.loadouts[i];
    if (rawLoadout.skill != null && loadout.skill === null) return fail('Malformed gem_state');
    const rawSupports = rawLoadout.supports === undefined ? [] : rawLoadout.supports;
    if (!Array.isArray(rawSupports) || rawSupports.length !== loadout.supports.length) return fail('Malformed gem_state');
  }
  if (parsed.loadouts.length > MAX_LOADOUTS) return fail('Malformed gem_state');

  const loadouts = [];
  for (const loadout of parsed.loadouts) {
    if (loadout.id.length > MAX_LOADOUT_ID_LENGTH) return fail('Malformed gem_state');
    const skill = loadout.skill === null ? null : cleanItem(loadout.skill);
    if (loadout.skill !== null && !skill) return fail('Malformed gem_state');
    const supports = [];
    for (const support of loadout.supports) {
      const cleaned = cleanItem(support);
      if (!cleaned) return fail('Malformed gem_state');
      supports.push(cleaned);
    }
    loadouts.push({ ...loadout, skill, supports });
  }

  return { ok: true, value: { loadouts, primaryId: parsed.primaryId } };
}
