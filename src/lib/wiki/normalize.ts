/**
 * Normalization layer: turns raw @poe2-toolkit extractor output (Item, Gem,
 * Mod) into this wiki's own detail/search types (see ./types). Keeps the
 * wiki's shape stable even if the extractor packages' shapes shift, and is
 * the single place that decides how extractor fields map onto wiki fields.
 */
import type { Item } from '@poe2-toolkit/item-extractor';
import type { Gem, GemRequirement, GemScaling } from '@poe2-toolkit/gem-extractor';
import type { Mod } from '@poe2-toolkit/mod-extractor';
import type {
  WikiItemDetail,
  WikiSkillDetail,
  WikiModDetail,
  WikiSearchEntry,
} from './types';

/**
 * Turns a display name into a URL-safe slug: lowercased, apostrophes
 * stripped outright (not encoded), every other run of non-alphanumeric
 * characters collapsed to a single hyphen, and leading/trailing hyphens
 * trimmed.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Strips PoE's inline `[Key]` / `[Key|Display]` markup from GGPK text.
 * `CurrencyItems.Description`/`.Directions` carry this formatting; no
 * @poe2-toolkit extractor renders it for us (unlike gem/mod stat text,
 * which the toolkit already returns pre-formatted), since this table isn't
 * one any extractor package reads. `[Key|Display]` keeps `Display`; a bare
 * `[Key]` (no pipe) keeps `Key` itself, e.g. `[Mirrored]` -> `Mirrored`.
 * Verified against a live decode: 409/1518 Description rows and 19/1518
 * Directions rows contain this markup.
 */
export function stripBracketMarkup(text: string): string {
  return text.replace(/\[([^\]|]+)(?:\|([^\]]+))?\]/g, (_match, key: string, display?: string) => display ?? key);
}

/**
 * One item's joined `CurrencyItems` row, keyed by display name in
 * scripts/sync-wiki.ts's own join (see that file's `joinCurrencyByName`) —
 * this module only shapes it onto `WikiItemDetail`, it doesn't do the join.
 */
export interface CurrencyText {
  stackSize: number;
  description: string | null;
  directions: string | null;
}

/**
 * Normalizes one item-extractor {@link Item} into a {@link WikiItemDetail}.
 * `name` is the item's display name (the key it was found under in
 * `ItemData`) since `Item` itself carries no name field. `iconUrl` is the
 * already-decoded/published icon path (or `null` when none is available
 * yet) - this function does no icon decoding of its own.
 *
 * `lastSynced` is supplied by the caller rather than read from the clock
 * here: one sync run stamps every record it writes with the same instant, so
 * a re-sync over unchanged upstream data produces byte-identical files. When
 * each record stamped itself, every weekly sync rewrote all ~22k detail
 * files with nothing but a new millisecond, making the sync PR unreviewable
 * and growing git history without carrying any information.
 */
export function normalizeItem(
  name: string,
  item: Item,
  iconUrl: string | null,
  lastSynced: string,
  currency: CurrencyText | null = null,
): WikiItemDetail {
  return {
    kind: 'item',
    slug: slugify(name),
    name,
    category: item.itemClass ?? item.category ?? 'Unknown',
    rarity: item.rarity,
    itemClass: item.itemClass,
    twoHanded: item.twoHanded,
    requirements: {
      strength: item.req.str,
      dexterity: item.req.dex,
      intelligence: item.req.int,
    },
    armour: item.armour,
    weapon: item.weapon,
    spirit: item.spirit,
    dropLevel: item.dropLevel,
    flavourText: item.flavourText,
    modDomain: item.modDomain,
    tags: item.tags,
    iconUrl,
    description: currency?.description != null ? stripBracketMarkup(currency.description) : null,
    directions: currency?.directions != null ? stripBracketMarkup(currency.directions) : null,
    stackSize: currency?.stackSize ?? null,
    lastSynced,
  };
}

const GEM_CATEGORY: Record<Gem['kind'], string> = {
  support: 'Support Gem',
  spirit: 'Spirit Gem',
  active: 'Active Skill Gem',
};

/**
 * Normalizes one gem-extractor {@link Gem} (plus its optional per-level
 * {@link GemRequirement} curve and {@link GemScaling} tooltip data) into a
 * {@link WikiSkillDetail}. `key` is the gem's `GemData.gems` key (PoB's
 * `normalizeGemId`) - currently unused for display since `Gem.name` already
 * carries the display name, but accepted so callers can pass it through
 * without a lookup. `requirement`/`scaling` are `null` when the source data
 * has none for this gem (e.g. many supports have no per-level curve).
 * `lastSynced` is the caller's single per-run timestamp (see normalizeItem).
 */
export function normalizeSkill(
  key: string,
  gem: Gem,
  requirement: GemRequirement | null,
  scaling: GemScaling | null,
  iconUrl: string | null,
  lastSynced: string,
): WikiSkillDetail {
  const level1 = requirement?.levels[1];
  return {
    kind: 'skill',
    slug: slugify(gem.name),
    name: gem.name,
    category: GEM_CATEGORY[gem.kind],
    gemType: gem.kind,
    color: gem.color,
    tags: gem.tags,
    description: gem.description,
    requirement: {
      strength: level1?.str ?? 0,
      dexterity: level1?.dex ?? 0,
      intelligence: level1?.int ?? 0,
      level: level1?.requiredLevel ?? gem.req.level,
    },
    scaling: (scaling?.levels ?? []).map((l) => ({
      level: l.level,
      cost: l.cost,
      castTime: l.castTime,
      cooldown: l.cooldown,
      reservation: l.reservation,
      stats: l.stats.map((s) => ({ text: s.text, min: s.min, max: s.max })),
    })),
    iconUrl,
    lastSynced,
  };
}

/**
 * Normalizes one mod-extractor {@link Mod} into a {@link WikiModDetail}.
 * `id` is the mod's `ModData` key (`Mods.Id`) - mods have no single display
 * name (`Mod.name` is `null` for implicits, uniques and many generated
 * mods), so the slug is derived from `id`, not `name`.
 * `lastSynced` is the caller's single per-run timestamp (see normalizeItem).
 */
export function normalizeMod(id: string, mod: Mod, lastSynced: string): WikiModDetail {
  return {
    kind: 'mod',
    slug: slugify(id),
    name: mod.name ?? id,
    category: mod.generationType,
    domain: mod.domain,
    generationType: mod.generationType,
    group: mod.group,
    tier: mod.tier,
    level: mod.level,
    stats: mod.stats,
    rolls: mod.rolls,
    families: mod.families,
    spawnWeights: mod.spawnWeights,
    lastSynced,
  };
}

/**
 * Slims a detail record down to the {@link WikiSearchEntry} shape shipped to
 * the browser for search. Mods have no `tags` field of their own; their
 * mutual-exclusion `families` (the closest analog - what determines which
 * other mods they compete with) stand in for search tags.
 */
export function toSearchEntry(
  detail: WikiItemDetail | WikiSkillDetail | WikiModDetail,
): WikiSearchEntry {
  const tags = detail.kind === 'mod' ? detail.families : detail.tags;
  return {
    slug: detail.slug,
    name: detail.name,
    kind: detail.kind,
    category: detail.category,
    tags,
  };
}
