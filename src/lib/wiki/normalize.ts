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
  WikiItemFlask,
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
 * Maps PoE's `<<xbox_button_x>>` style button-glyph placeholders (from
 * `CurrencyItems.XBoxDirections`) to a plain-text button name. Verified
 * against a live decode: exactly two tokens appear across the whole table,
 * `xbox_button_x` and `xbox_button_a` — both currency-item action buttons
 * (X to use the item, A to apply it to a target). An unrecognized future
 * token falls back to its raw inner name rather than vanishing silently.
 */
const XBOX_BUTTON_NAME: Record<string, string> = {
  xbox_button_x: 'X',
  xbox_button_a: 'A',
};

export function stripXboxButtonTokens(text: string): string {
  return text.replace(/<<xbox_button_([a-z0-9_]+)>>/g, (_match, key: string) => XBOX_BUTTON_NAME[`xbox_button_${key}`] ?? key);
}

/**
 * Matches PC `Directions` text's mouse-click phrasing, in the exact casing
 * the source data uses (verified against a live decode: only these two
 * variants occur across all 800 rows with `Directions` text — "Right click"
 * capitalized, "left click" not).
 */
const CLICK_PHRASE_RE = /Right click|left click/g;

/**
 * Pulls the ordered list of `<<xbox_button_*>>` tokens out of a raw (not yet
 * `stripXboxButtonTokens`-processed) `XBoxDirections` string, e.g.
 * `'x'` then `'a'` for `'<<xbox_button_x>> to use, then <<xbox_button_a>>...'`.
 */
function extractXboxButtonTokens(xboxDirectionsRaw: string): string[] {
  return [...xboxDirectionsRaw.matchAll(/<<xbox_button_([a-z0-9_]+)>>/g)].map((m) => m[1]);
}

/**
 * Returns the ordered console button letters (e.g. `['x', 'a']`) that map
 * 1:1 onto this item's PC `directions` text's "Right click" / "left click"
 * phrases, in the order those phrases appear — or `null` when a positional
 * substitution isn't safe to make.
 *
 * Not safe when: either string is missing, `directions` has no click
 * phrasing at all (nothing to substitute), or the click-phrase count and
 * button-token count don't match. That mismatch is real, not rare: verified
 * against a live decode, 9/683 rows with both fields populated have console
 * directions phrased as an entirely different sentence rather than a
 * button-for-click substitution of the PC text (e.g. an emote's "Click (or
 * type /dance)" vs its console "<<xbox_button_a>> to dance!", or a Beast
 * recipe whose console text describes interacting with menagerie signs
 * instead of button prompts at all). Callers fall back to showing the PC
 * and console directions as separate lines for those, same as before this
 * merge existed.
 */
export function extractConsoleButtons(directions: string | null, xboxDirectionsRaw: string | null): string[] | null {
  if (!directions || !xboxDirectionsRaw) return null;
  const phraseCount = [...directions.matchAll(CLICK_PHRASE_RE)].length;
  if (phraseCount === 0) return null;
  const buttons = extractXboxButtonTokens(xboxDirectionsRaw);
  if (buttons.length !== phraseCount) return null;
  return buttons;
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
  xboxDirections: string | null;
}

/**
 * One unique item's block, parsed from Path of Building Community's
 * `Uniques/*.lua` data (see {@link parsePobUniqueFile}). Keyed by `name` when
 * joined onto a synced unique item, same "first match wins on a name
 * collision" convention as every other by-name join in this file.
 */
export interface PobUniqueEntry {
  name: string;
  baseType: string | null;
  requiresLevel: number | null;
  dropSource: string | null;
  implicitMods: string[];
  explicitMods: string[];
}

/**
 * Strips Path of Building's `word{Display}` cross-reference markup (e.g.
 * `unique{Olroth, Origin of the Fall}`, `normal{Vaal Temple}` in a Source
 * line) down to plain display text. Same idea as {@link stripBracketMarkup}
 * for PoE's own `[Key|Display]` GGPK markup, different source and syntax —
 * PoB's own data, not GGPK's.
 */
export function stripPobSourceMarkup(text: string): string {
  return text.replace(/\w+\{([^}]*)\}/g, '$1');
}

const POB_METADATA_LINE_RE = /^(Source|Variant|Implicits|League|Sockets):|^Requires Level \d+/;
const POB_LEADING_TAG_RE = /^\{([^}]*)\}/;

/** Strips every leading `{tag}` group off a PoB mod line, returning them alongside the remaining display text. */
function stripPobLeadingTags(line: string): { tags: string[]; text: string } {
  const tags: string[] = [];
  let rest = line;
  let match = rest.match(POB_LEADING_TAG_RE);
  while (match) {
    tags.push(match[1]);
    rest = rest.slice(match[0].length);
    match = rest.match(POB_LEADING_TAG_RE);
  }
  return { tags, text: rest };
}

/** The `{variant:N}` / `{variant:N,M}` tag's variant indices (1-based, matching declaration order), or `null` when the line carries no variant tag (applies unconditionally). */
function pobLineVariants(tags: string[]): number[] | null {
  const variantTag = tags.find((t) => t.startsWith('variant:'));
  if (!variantTag) return null;
  return variantTag.slice('variant:'.length).split(',').map(Number);
}

/**
 * Parses one `[[ ... ]]` block from a PoB `Uniques/*.lua` file into a
 * {@link PobUniqueEntry}. Returns `null` for an empty block (shouldn't occur
 * in real data, guarded defensively since this reads a third-party file this
 * project doesn't control the format of).
 *
 * Variant handling: many uniques carry multiple `Variant:` lines (old
 * patch-history revisions of the same item, or - rarely - alternate forms
 * with no single "current" one, e.g. Atziri's Splendour's Helmet/Gloves/
 * Boots/Shield variants). Mod lines tagged `{variant:N}` only apply to that
 * variant; untagged lines apply to all of them. When a `Variant: Current`
 * label exists, only its lines (plus untagged ones) are kept - the normal
 * case. When variants exist but none is labeled "Current" (the alternate-
 * form case), every variant's lines are kept rather than arbitrarily picking
 * one - an honest superset beats a silently wrong guess.
 */
export function parsePobUniqueBlock(block: string): PobUniqueEntry | null {
  const lines = block.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return null;

  const name = lines[0];
  let i = 1;
  let baseType: string | null = null;
  if (i < lines.length && !POB_METADATA_LINE_RE.test(lines[i])) {
    baseType = lines[i];
    i++;
  }

  let requiresLevel: number | null = null;
  let dropSource: string | null = null;
  let implicitsCount = 0;
  const variantLabels: string[] = [];
  const rawModLines: { tags: string[]; text: string; isImplicit: boolean }[] = [];

  for (; i < lines.length; i++) {
    const line = lines[i];
    const sourceMatch = line.match(/^Source:\s*(.+)$/);
    if (sourceMatch) { dropSource = stripPobSourceMarkup(sourceMatch[1]); continue; }
    const variantMatch = line.match(/^Variant:\s*(.+)$/);
    if (variantMatch) { variantLabels.push(variantMatch[1]); continue; }
    const implicitsMatch = line.match(/^Implicits:\s*(\d+)/);
    if (implicitsMatch) { implicitsCount = Number(implicitsMatch[1]); continue; }
    const levelMatch = line.match(/^Requires Level (\d+)/);
    if (levelMatch) { requiresLevel = Number(levelMatch[1]); continue; }
    if (/^(League|Sockets):/.test(line)) continue;
    const { tags, text } = stripPobLeadingTags(line);
    rawModLines.push({ tags, text, isImplicit: rawModLines.length < implicitsCount });
  }

  const currentVariantIndex = variantLabels.indexOf('Current') + 1 || null;

  function keepLine(l: { tags: string[] }): boolean {
    const variants = pobLineVariants(l.tags);
    if (!variants) return true;
    if (currentVariantIndex == null) return true;
    return variants.includes(currentVariantIndex);
  }

  return {
    name,
    baseType,
    requiresLevel,
    dropSource,
    implicitMods: rawModLines.filter((l) => l.isImplicit && keepLine(l)).map((l) => l.text),
    explicitMods: rawModLines.filter((l) => !l.isImplicit && keepLine(l)).map((l) => l.text),
  };
}

/**
 * Parses one PoB `Uniques/<class>.lua` file's full contents (the `[[ ... ]]`
 * blocks between its `return { ... }` wrapper) into {@link PobUniqueEntry}
 * records. Lua comment lines between blocks (e.g. `-- Body: Armour`) live
 * outside the `[[ ]]` regions and are naturally excluded by the split.
 */
export function parsePobUniqueFile(fileText: string): PobUniqueEntry[] {
  const blocks = [...fileText.matchAll(/\[\[([\s\S]*?)\]\]/g)].map((m) => m[1]);
  return blocks.map(parsePobUniqueBlock).filter((e): e is PobUniqueEntry => e !== null);
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
  implicitMods: string[] = [],
  flask: WikiItemFlask | null = null,
  pobUnique: PobUniqueEntry | null = null,
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
    description: currency?.description ? stripBracketMarkup(currency.description) : null,
    directions: currency?.directions ? stripBracketMarkup(currency.directions) : null,
    consoleDirections: currency?.xboxDirections ? stripXboxButtonTokens(currency.xboxDirections) : null,
    consoleButtons: extractConsoleButtons(currency?.directions ?? null, currency?.xboxDirections ?? null),
    stackSize: currency?.stackSize ?? null,
    implicitMods: pobUnique ? pobUnique.implicitMods : implicitMods,
    flask,
    uniqueMods: pobUnique ? {
      baseType: pobUnique.baseType,
      requiresLevel: pobUnique.requiresLevel,
      dropSource: pobUnique.dropSource,
      explicitMods: pobUnique.explicitMods,
    } : null,
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
 * `Mod.domain` falls back to the raw 1-based `ModDomains` enum index
 * (`@poe2-toolkit`'s own `enumName` helper) whenever the schema's own name
 * table has an unnamed slot at that position - not a mapping gap in this
 * project, an actual gap in `poe-tool-dev/dat-schema`'s `ModDomains` table.
 * Verified against a live decode: raw domain `"6"` is exclusively `Map...`-
 * grouped mods (Map Device modifiers - "50% increased Monster Damage" etc.,
 * real player-facing map affixes), and `"8"` is exclusively `Sanctum...`-
 * grouped mods (Sanctum room-effect modifiers). Both are real, populated,
 * player-relevant domains; they just never got a name in the upstream enum.
 */
const MOD_DOMAIN_DISPLAY_NAME: Record<string, string> = {
  '6': 'Map',
  '8': 'Sanctum',
};

function modDomainDisplayName(domain: string): string {
  return MOD_DOMAIN_DISPLAY_NAME[domain] ?? domain;
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
    domain: modDomainDisplayName(mod.domain),
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
