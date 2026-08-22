/**
 * Version stamp for the wiki data artifacts (sync date). Path segment under
 * public/data/wiki/<version>/ for cache-busting. Manually bumped, reviewed
 * via the weekly sync PR (scripts/sync-wiki.ts).
 */
export const WIKI_DATA_VERSION = '2026-08-21';

/**
 * GGPK patch version passed to createCdnSource. No public "latest" endpoint
 * exists for PoE2; this is bumped by hand when the sync PR shows stale data.
 * See docs/superpowers/specs/2026-08-16-wiki-source-recon.md.
 */
export const WIKI_PATCH_VERSION = '4.5.4.10.2';

export type WikiEntryKind = 'item' | 'skill' | 'mod';

/** Slim entry — this is what ships to the browser for search. Keep it small. */
export interface WikiSearchEntry {
  slug: string;
  name: string;
  kind: WikiEntryKind;
  category: string;
  tags: string[];
}

export interface WikiIndexFile {
  version: string;
  generatedAt: string;
  entries: WikiSearchEntry[];
}

interface WikiDetailBase {
  slug: string;
  name: string;
  category: string;
  lastSynced: string;
}

export interface WikiItemArmour {
  armour: number;
  evasion: number;
  energyShield: number;
  ward: number;
  block: number;
}

export interface WikiItemWeapon {
  damageMin: number;
  damageMax: number;
  critical: number;
  attackTime: number;
  rangeMax: number;
  reloadTime: number;
}

export interface WikiItemFlask {
  lifeRecovery: number;
  manaRecovery: number;
  /** Seconds. Source `Flasks.RecoveryTime` is in tenths of a second. */
  duration: number;
}

/**
 * A unique item's actual mods and roll ranges — GGPK has no unique->base-type
 * link (the base a unique rolls on is decided at drop generation, not
 * stored, per @poe2-toolkit's own item-extractor docs), so this can't come
 * from the sync's usual GGPK tables. Sourced instead from Path of Building
 * Community's hand-maintained `Uniques/*.lua` data (MIT licensed) — see
 * `parsePobUniqueFile` in normalize.ts. `null` when no matching entry was
 * found for this unique's name.
 *
 * Implicit lines from this source are folded into the item's own top-level
 * `implicitMods` instead of duplicated here — GGPK-sourced implicits (normal
 * items) and PoB-sourced implicits (uniques) are the same concept from a
 * renderer's point of view, and a unique never has both.
 */
export interface WikiUniqueMods {
  /**
   * The unique's specific base type (e.g. "Sacrificial Regalia"), more exact
   * than the item's own GGPK-sourced `category` ("Body Armour" — the closest
   * .dat gets, per the unique/base-link gap above). `null` if PoB's entry
   * didn't carry one either.
   */
  baseType: string | null;
  requiresLevel: number | null;
  /** Plain-text drop source, e.g. "Drops from Olroth, Origin of the Fall". `null` when PoB has none on file (many basic-drop uniques don't). */
  dropSource: string | null;
  explicitMods: string[];
}

export interface WikiItemDetail extends WikiDetailBase {
  kind: 'item';
  rarity: 'normal' | 'unique';
  itemClass: string | null;
  twoHanded: boolean;
  requirements: { strength: number; dexterity: number; intelligence: number };
  armour: WikiItemArmour | null;
  weapon: WikiItemWeapon | null;
  spirit: number;
  dropLevel: number;
  flavourText: string[] | null;
  modDomain: string | null;
  tags: string[];
  iconUrl: string | null;
  /**
   * Intrinsic icon dimensions after the sync step's aspect-ratio-preserving
   * resize (`fit: 'inside'`) — most weapon/armour art is portrait, not
   * square (e.g. a crossbow's real icon is 65x128). `null` when `iconUrl`
   * is itself `null`. Lets the detail page render the icon at its real
   * proportions instead of squeezing it into a forced square box.
   */
  iconWidth: number | null;
  iconHeight: number | null;
  description: string | null;
  directions: string | null;
  consoleDirections: string | null;
  consoleButtons: string[] | null;
  stackSize: number | null;
  implicitMods: string[];
  flask: WikiItemFlask | null;
  uniqueMods: WikiUniqueMods | null;
}

export interface WikiSkillStatLine {
  text: string;
  min: number;
  max: number;
}

export interface WikiSkillLevelScaling {
  level: number;
  cost: number | null;
  castTime: number | null;
  cooldown: number | null;
  reservation: number | null;
  stats: WikiSkillStatLine[];
}

export interface WikiSkillDetail extends WikiDetailBase {
  kind: 'skill';
  gemType: 'active' | 'support' | 'spirit';
  color: 'r' | 'g' | 'b' | 'w';
  tags: string[];
  description: string | null;
  requirement: { strength: number; dexterity: number; intelligence: number; level: number };
  scaling: WikiSkillLevelScaling[];
  iconUrl: string | null;
  /** See {@link WikiItemDetail.iconWidth}. */
  iconWidth: number | null;
  iconHeight: number | null;
}

export interface WikiModRoll {
  stat: string;
  min: number;
  max: number;
}

export interface WikiModSpawnWeight {
  tag: string;
  weight: number;
}

export interface WikiModDetail extends WikiDetailBase {
  kind: 'mod';
  domain: string;
  generationType: string;
  group: string | null;
  tier: number | null;
  level: number;
  stats: string[];
  rolls: WikiModRoll[];
  families: string[];
  spawnWeights: WikiModSpawnWeight[];
}

const KINDS: readonly string[] = ['item', 'skill', 'mod'];

export function isWikiSearchEntry(value: unknown): value is WikiSearchEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.slug === 'string' && v.slug.length > 0 &&
    typeof v.name === 'string' && v.name.length > 0 &&
    typeof v.kind === 'string' && KINDS.includes(v.kind) &&
    typeof v.category === 'string' &&
    Array.isArray(v.tags) && v.tags.every((t) => typeof t === 'string')
  );
}
