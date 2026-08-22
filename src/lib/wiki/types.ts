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
  description: string | null;
  directions: string | null;
  consoleDirections: string | null;
  stackSize: number | null;
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
