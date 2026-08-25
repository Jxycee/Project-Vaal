/**
 * Version stamp for the wiki data artifacts (sync date). Path segment under
 * public/data/wiki/<version>/ for cache-busting. Manually bumped, reviewed
 * via the weekly sync PR (scripts/sync-wiki.ts).
 */
export const WIKI_DATA_VERSION = '2026-08-25';

/**
 * GGPK patch version passed to createCdnSource. No public "latest" endpoint
 * exists for PoE2; this is bumped by hand when the sync PR shows stale data.
 * See docs/superpowers/specs/2026-08-16-wiki-source-recon.md.
 */
export const WIKI_PATCH_VERSION = '4.5.4.10.2';

export type WikiEntryKind = 'item' | 'skill' | 'mod' | 'effect';

/** Browse-page base path per kind — shared by breadcrumbs, mention links, and nav. */
export const WIKI_BASE_PATH: Record<WikiEntryKind, string> = {
  item: '/wiki/items',
  skill: '/wiki/skills',
  mod: '/wiki/mods',
  effect: '/wiki/effects',
};

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

/**
 * A hand-verified explanation pulled from poedb.tw for an entry the GGPK
 * data itself has no description for (e.g. a mod's `stats` line that's
 * just an unexplained proper-noun phrase like "Atziri's Influence", with
 * no `BuffDefinitions` row or other extractable text behind it). Never
 * auto-scraped — see `scripts/wiki/poedb-overrides.json` and
 * THIRD-PARTY-NOTICES.md. `null`/absent for the overwhelming majority of
 * entries, which get everything they need from GGG's own data.
 */
export interface WikiCommunitySource {
  text: string;
  /** The poedb.tw page this was verified against, at merge time - not necessarily still live-verifiable if the site's URL scheme or patch coverage changes later. */
  sourceUrl: string;
}

interface WikiDetailBase {
  slug: string;
  name: string;
  category: string;
  lastSynced: string;
  communitySource?: WikiCommunitySource | null;
  /**
   * The full explanation from GGG's own in-game keyword-tooltip glossary
   * (`KeywordPopups` - the popup you get hovering a blue-underlined term in
   * the real client), when this entry's exact `name` matches a glossary
   * term. Distinct from `communitySource`: this is first-party GGPK data,
   * same source/license as everything else on the page, just a second
   * (usually longer, more mechanical) explanation alongside whatever
   * shorter description the entry already has - see
   * docs/superpowers/specs/2026-08-22-wiki-ggpk-source-audit.md, "Finding 1".
   * `null`/absent for the ~92% of entries with no matching term.
   */
  keywordDefinition?: string | null;
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

/**
 * A Rune's (SoulCore-category item's) socketing bonus, one entry per
 * equipment category it grants a different effect for (e.g. a Desert Rune
 * grants added Fire damage socketed in a weapon but Fire Resistance
 * socketed in Armour) - see `joinSoulCoresByName` in sync-wiki.ts, sourced
 * from GGPK's `SoulCores`/`SoulCoreStats`/`SoulCoreStatCategories` tables,
 * rendered through `@poe2-toolkit/ggpk`'s own stat-description engine (the
 * same one that renders every mod's `stats` text) rather than hand-rolled
 * formatting.
 */
export interface WikiSoulCoreEffect {
  /** e.g. "Martial Weapon", "Wand or Staff", "Armour" - which equipment category this bonus applies to when the rune is socketed there. */
  category: string;
  /** Rendered stat lines for this category, e.g. ["Adds 4 to 6 Fire Damage"]. */
  lines: string[];
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
  soulCoreEffects: WikiSoulCoreEffect[] | null;
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

/**
 * A buff or ailment (Bleeding, Chilled, Maimed, Righteous Fire, ...), from
 * GGPK's `BuffDefinitions` table — `Id`/`Name`/`Description` only; no icon
 * art is referenced anywhere in that table, and `Description` is already
 * player-facing prose (same `[Key|Display]` bracket markup convention as
 * `CurrencyItems.Description`), so no stat-translation step is needed.
 * `category` is always `"Effect"` — the table has no further
 * classification to group by (ailment vs. buff vs. utility effect aren't
 * distinguished in the source data).
 */
export interface WikiEffectDetail extends WikiDetailBase {
  kind: 'effect';
  description: string;
  /**
   * Quick-filter tags derived from GGPK's own `BuffDefinitions.BuffCategory`
   * field (an undocumented raw enum, reverse-mapped by cross-referencing
   * known effects - see `BUFF_CATEGORY_TAG` in normalize.ts) plus a
   * name-shape check for Auras (`BuffCategory` doesn't distinguish them).
   * Empty for the ~1% of effects in a tiny/ambiguous category bucket -
   * intentionally left untagged rather than force-fit into a wrong label.
   */
  tags: string[];
}

const KINDS: readonly string[] = ['item', 'skill', 'mod', 'effect'];

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
