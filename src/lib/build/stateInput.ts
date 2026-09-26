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

import { MAX_AFFIXES_PER_KIND, MAX_ITEM_QUALITY, MAX_RUNES, RARITIES, type CraftedMod, type ItemCraft, type ItemRarity } from './craft';
import { GEAR_SLOTS, type GearItem } from './gearSlots';
import { parseGearState, type GearState } from './gearState';
import { parseGemState, type GemState } from './gemState';
import type { AttributeChoice } from '@poe2-toolkit/tree-core';
import { isAttributeChoice } from './passiveState';
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

// ---- Item craft (Slice 4) ----------------------------------------------------
// Shape and bounds only. Whether a mod or rune slug exists is the validator's
// job (a warning), so a later resync that renames one never makes a saved
// build unsavable — see plans/2026-09-25-slice4-item-affixes.md. The affix
// and rune caps are craft.ts's, where the editor and the PoB importer read
// them too. Other bounds come from our data (2026-09-25): at most 6 rolls per
// mod, 2 ranges per line, 7 implicit lines, 37 unique lines; mod slugs are
// [a-z0-9_-] (two carry '-'), item slugs [a-z0-9-].

const CRAFT_KEYS = ['rarity', 'name', 'itemLevel', 'quality', 'corrupted', 'implicitValues', 'uniqueValues', 'prefixes', 'suffixes', 'runes'] as const;
const MOD_SLUG_RE = /^[a-z0-9_-]{1,120}$/;
const ITEM_SLUG_RE = /^[a-z0-9-]{1,120}$/;
const MAX_VALUES_PER_ROW = 8;
const MAX_IMPLICIT_ROWS = 16;
const MAX_UNIQUE_ROWS = 64;

function cleanValueRow(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_VALUES_PER_ROW) return null;
  return raw.every((n) => typeof n === 'number' && Number.isFinite(n)) ? [...raw] : null;
}

function cleanValueRows(raw: unknown, maxRows: number): number[][] | null {
  if (!Array.isArray(raw) || raw.length > maxRows) return null;
  const rows: number[][] = [];
  for (const row of raw) {
    const cleaned = cleanValueRow(row);
    if (!cleaned) return null;
    rows.push(cleaned);
  }
  return rows;
}

function cleanAffixes(raw: unknown): CraftedMod[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_AFFIXES_PER_KIND) return null;
  const mods: CraftedMod[] = [];
  for (const entry of raw) {
    if (!isPlainObject(entry) || Object.keys(entry).some((k) => k !== 'slug' && k !== 'values')) return null;
    if (typeof entry.slug !== 'string' || !MOD_SLUG_RE.test(entry.slug)) return null;
    const values = cleanValueRow(entry.values);
    if (!values) return null;
    mods.push({ slug: entry.slug, values });
  }
  return mods;
}

/** Validates a raw craft and projects it to exactly the ItemCraft fields; null = refuse. */
function cleanCraft(raw: unknown): ItemCraft | null {
  if (!isPlainObject(raw)) return null;
  if (Object.keys(raw).some((k) => !(CRAFT_KEYS as readonly string[]).includes(k))) return null;
  const { rarity, name, itemLevel, quality, corrupted } = raw;
  if (typeof rarity !== 'string' || !(RARITIES as readonly string[]).includes(rarity)) return null;
  if (name !== null && (typeof name !== 'string' || name.length > MAX_TEXT_LENGTH)) return null;
  if (itemLevel !== null && (!Number.isInteger(itemLevel) || (itemLevel as number) < 1 || (itemLevel as number) > 100)) return null;
  if (!Number.isInteger(quality) || (quality as number) < 0 || (quality as number) > MAX_ITEM_QUALITY) return null;
  if (typeof corrupted !== 'boolean') return null;
  const implicitValues = cleanValueRows(raw.implicitValues, MAX_IMPLICIT_ROWS);
  const uniqueValues = cleanValueRows(raw.uniqueValues, MAX_UNIQUE_ROWS);
  const prefixes = cleanAffixes(raw.prefixes);
  const suffixes = cleanAffixes(raw.suffixes);
  const runes = raw.runes;
  if (!implicitValues || !uniqueValues || !prefixes || !suffixes) return null;
  if (!Array.isArray(runes) || runes.length > MAX_RUNES || !runes.every((r) => typeof r === 'string' && ITEM_SLUG_RE.test(r))) return null;
  return {
    rarity: rarity as ItemRarity,
    name: name as string | null,
    itemLevel: itemLevel as number | null,
    quality: quality as number,
    corrupted,
    implicitValues,
    uniqueValues,
    prefixes,
    suffixes,
    runes: [...(runes as string[])],
  };
}

/**
 * Validates one item already accepted by isGearItem, and projects it to
 * exactly the GearItem fields. `rawCraft` is the item's `craft` as the client
 * SENT it — not the reader's defaulted copy — so a malformed craft is
 * refused rather than silently repaired. Gems pass `allowCraft: false`.
 */
function cleanItem(item: GearItem, rawCraft: unknown, allowCraft: boolean): GearItem | null {
  for (const text of [item.slug, item.name, item.category]) {
    if (text.length === 0 || text.length > MAX_TEXT_LENGTH) return null;
  }
  if (item.iconUrl !== null && !isAllowedIconUrl(item.iconUrl)) return null;
  const base: GearItem = {
    slug: item.slug,
    name: item.name,
    category: item.category,
    isUnique: item.isUnique,
    iconUrl: item.iconUrl,
  };
  if (rawCraft === undefined) return base;
  if (!allowCraft) return null;
  const craft = cleanCraft(rawCraft);
  return craft ? { ...base, craft } : null;
}

/** The `craft` property as sent, or undefined when the item has none. */
function rawCraftOf(rawItem: unknown): unknown {
  return isPlainObject(rawItem) ? rawItem.craft : undefined;
}

function isFiniteNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((n) => typeof n === 'number' && Number.isFinite(n));
}

export function isPassiveState(value: unknown): value is PassiveState {
  if (!isPlainObject(value)) return false;
  return isFiniteNumberArray(value.set1) && isFiniteNumberArray(value.set2) && isFiniteNumberArray(value.ascendancyNodes);
}

/** 293 generic attribute nodes exist on the 0.5.2 tree; this is headroom, not a target. */
const MAX_ATTRIBUTE_CHOICES = 300;
const NODE_ID_RE = /^\d{1,10}$/;

export function cleanPassiveStateInput(raw: unknown): InputResult<PassiveState> {
  if (tooLarge(raw) || !isPassiveState(raw)) return fail('Malformed passive_state');
  const value: PassiveState = { set1: raw.set1, set2: raw.set2, ascendancyNodes: raw.ascendancyNodes };
  // Slice 5: kept, not projected away — refused, not repaired, when malformed.
  const choices = (raw as unknown as Record<string, unknown>).attributeChoices;
  if (choices !== undefined) {
    if (!isPlainObject(choices)) return fail('Malformed passive_state');
    const entries = Object.entries(choices);
    if (entries.length > MAX_ATTRIBUTE_CHOICES) return fail('Malformed passive_state');
    for (const [id, choice] of entries) {
      if (!NODE_ID_RE.test(id) || !isAttributeChoice(choice)) return fail('Malformed passive_state');
    }
    if (entries.length > 0) value.attributeChoices = { ...(choices as Record<string, AttributeChoice>) };
  }
  return { ok: true, value };
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
    const cleaned = cleanItem(item, rawCraftOf(raw[slot]), true);
    if (!cleaned) return fail('Malformed gear_state');
    out[slot] = cleaned;
  }

  const jewelEntries = Object.entries(parsed.jewels);
  if (jewelEntries.length > MAX_JEWELS) return fail('Malformed gear_state');
  const rawJewels = (raw.jewels ?? {}) as Record<string, unknown>;
  for (const [key, item] of jewelEntries) {
    const cleaned = cleanItem(item, rawCraftOf(rawJewels[key]), true);
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
    const skill = loadout.skill === null ? null : cleanItem(loadout.skill, rawCraftOf(loadout.skill), false);
    if (loadout.skill !== null && !skill) return fail('Malformed gem_state');
    const supports = [];
    for (const support of loadout.supports) {
      const cleaned = cleanItem(support, rawCraftOf(support), false);
      if (!cleaned) return fail('Malformed gem_state');
      supports.push(cleaned);
    }
    loadouts.push({ ...loadout, skill, supports });
  }

  return { ok: true, value: { loadouts, primaryId: parsed.primaryId } };
}
