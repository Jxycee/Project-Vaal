/**
 * Normalization layer: turns raw @poe2-toolkit extractor output (Item, Gem,
 * Mod) into this wiki's own detail/search types (see ./types). Keeps the
 * wiki's shape stable even if the extractor packages' shapes shift, and is
 * the single place that decides how extractor fields map onto wiki fields.
 */
import type { Item } from '@poe2-toolkit/item-extractor';
import type { Gem, GemRequirement, GemScaling } from '@poe2-toolkit/gem-extractor';
import type { Mod } from '@poe2-toolkit/mod-extractor';
import { humanizeCategory } from './humanizeCategory';
import type {
  WikiItemDetail,
  WikiSkillDetail,
  WikiModDetail,
  WikiEffectDetail,
  WikiMapDetail,
  WikiSearchEntry,
  WikiItemFlask,
  WikiSoulCoreEffect,
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

/**
 * Lines the `{variant:N}`/`Variant:`-labeled system above doesn't cover: a
 * second, independent "alt variant" axis PoB uses for items with more than
 * one simultaneously-randomized mod slot (e.g. Mageblood's four independent
 * "Legacy of X" lines, Morior Invictus's era + stat-focus axes). These are
 * PoB's own UI/selection bookkeeping ("which one is my build planner
 * currently showing"), never real mod text - verified against a live decode:
 * every unique carrying any of these lines also carries the real mod text
 * separately, tagged with its own `{variant:N}`.
 */
const POB_METADATA_LINE_RE = /^(Source|Variant|Implicits|League|Sockets|Has Alt Variant( (Two|Three))?|Selected( Alt)? Variant( (Two|Three))?|Allow Duplicate Variants):|^Requires Level \d+/;
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
    // Source/Variant/Implicits/Requires-Level already matched and `continue`d
    // above; this catches the rest POB_METADATA_LINE_RE recognizes (League,
    // Sockets, the alt-variant bookkeeping lines) with one shared pattern
    // rather than duplicating it.
    if (POB_METADATA_LINE_RE.test(line)) continue;
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
 * Appends GGG's own in-game explanation to a mod line that's just a bare
 * named-mechanic reference with no numbers of its own - e.g. Mageblood's
 * "Legacy of Gold" line, which is otherwise meaningless on its own (see
 * `readKeywordDefinitions` in scripts/sync-wiki.ts for where
 * `keywordDefinitions` comes from: GGG's own `KeywordPopups` tooltip
 * glossary, keyed by the term's exact display text).
 *
 * Matches the whole line exactly, not a substring - a numeric mod line like
 * "+(40-60) to Strength" doesn't equal the bare term "Strength", so this
 * only ever fires on lines that are already just a name and nothing else.
 * Lines with no matching term pass through unchanged.
 */
export function enrichKeywordLines(lines: string[], keywordDefinitions: Map<string, string>): string[] {
  return lines.map((line) => {
    const definition = keywordDefinitions.get(line);
    return definition ? `${line} — ${stripBracketMarkup(definition)}` : line;
  });
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
  keywordDefinitions: Map<string, string> = new Map(),
  soulCoreEffects: WikiSoulCoreEffect[] | null = null,
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
    iconWidth: null,
    iconHeight: null,
    description: currency?.description ? stripBracketMarkup(currency.description) : null,
    directions: currency?.directions ? stripBracketMarkup(currency.directions) : null,
    consoleDirections: currency?.xboxDirections ? stripBracketMarkup(stripXboxButtonTokens(currency.xboxDirections)) : null,
    consoleButtons: extractConsoleButtons(currency?.directions ?? null, currency?.xboxDirections ?? null),
    stackSize: currency?.stackSize ?? null,
    implicitMods: pobUnique ? pobUnique.implicitMods : implicitMods,
    flask,
    uniqueMods: pobUnique ? {
      baseType: pobUnique.baseType,
      requiresLevel: pobUnique.requiresLevel,
      dropSource: pobUnique.dropSource,
      explicitMods: enrichKeywordLines(pobUnique.explicitMods, keywordDefinitions),
    } : null,
    soulCoreEffects,
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
    iconWidth: null,
    iconHeight: null,
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
 *
 * `keywordDefinitions` enriches `stats` lines the same way
 * {@link enrichKeywordLines} does for a unique item's `explicitMods` (e.g.
 * a bare "Atziri's Influence"-shaped line with a real glossary term) -
 * deliberately NOT the whole-entry `keywordDefinition` attachment
 * `attachKeywordDefinitions` (sync-wiki.ts) does for item/skill/effect
 * pages. A mod's own `name` is a shared flavor label reused across many
 * structurally-different mods (71 different mods are all named "Lucky" in
 * a live decode) - it names a *theme*, not the mod's actual identity the
 * way an item/skill/effect name does, so matching the whole entry by name
 * produces misleading pairings (a mod named "Frozen" that only adds Cold
 * damage would get the Freeze-ailment glossary text). Per-line exact
 * matching doesn't have this problem: it only fires when a stat line IS
 * literally just the bare term already.
 */
export function normalizeMod(id: string, mod: Mod, lastSynced: string, keywordDefinitions: Map<string, string> = new Map()): WikiModDetail {
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
    stats: enrichKeywordLines(mod.stats, keywordDefinitions),
    rolls: mod.rolls,
    families: mod.families,
    spawnWeights: mod.spawnWeights,
    lastSynced,
  };
}

/**
 * One `BuffDefinitions` row this project cares about - `Id`/`Name`/
 * `Description`/`BuffCategory`. Read and filtered by `scripts/sync-wiki.ts`
 * directly from the decoded table (not through a @poe2-toolkit extractor
 * package, same as `CurrencyText` above); this type is just the shape it
 * hands off to {@link normalizeEffect}.
 */
export interface EffectRow {
  id: string;
  name: string;
  description: string;
  /** GGPK's own `BuffCategory` - an undocumented raw enum, no reference table ships with it. Reverse-mapped in `BUFF_CATEGORY_TAG` below by cross-referencing known effects (Bleeding/Ignited/... all = 2, Onslaught/Righteous Fire/... all = 1, etc). `null` when the row had no value at all. */
  buffCategory: number | null;
}

/**
 * Maps GGPK's raw `BuffCategory` enum to a short quick-filter label,
 * reverse-engineered by cross-referencing known effects against a live
 * decode (2026-08-25) - there is no reference table for this enum anywhere
 * in the schema. Several raw values are folded into one label where the
 * underlying split reads as an implementation detail rather than a
 * distinction a wiki reader would care about (e.g. 1/4/6/13/15/16 are all
 * "positive effect currently applied to you" in different internal
 * bookkeeping shapes - Onslaught, an "Increased Armour" stat buff, a
 * mid-channel skill marker, a Herald, Headhunter's steal-a-mod mechanic,
 * and a party Link all read the same way to a reader: "Buff"). The four
 * smallest/least legible values (8, 10, 11, 14 - 11 rows total, mostly PvP
 * team/flag markers) are deliberately left unmapped rather than guessed.
 */
const BUFF_CATEGORY_TAG: Record<number, string> = {
  1: 'Buff', 4: 'Buff', 6: 'Buff', 13: 'Buff', 15: 'Buff', 16: 'Buff',
  2: 'Debuff',
  3: 'Charge',
  5: 'Curse',
  7: 'Shrine', 9: 'Shrine',
  17: 'Charm',
  18: 'Immunity',
};

/**
 * The canonical Ailments, per GGPK's own `KeywordPopups` glossary entry for
 * the term "Ailments": "The list of Ailments is: Bleeding, Ignite, Chill,
 * Freeze, Shock, Electrocute, and Poison." Matched against our own effect
 * names, which use the adjective/past-tense form ("Ignited" not "Ignite")
 * - "Electrocuted" has no matching effect entry in a live decode (not
 * implemented as its own buff in this patch), so the set is 6, not 7.
 */
const AILMENT_NAMES = new Set(['Bleeding', 'Ignited', 'Chilled', 'Frozen', 'Shocked', 'Poisoned']);

/**
 * Quick-filter tags for one effect: its `BuffCategory`-derived tag (see
 * {@link BUFF_CATEGORY_TAG}), "Ailment" for the canonical set above
 * (layered on top of - not instead of - the "Debuff" every one of them
 * already gets from its `BuffCategory`), and "Aura" when the name itself
 * ends that way - `BuffCategory` doesn't distinguish auras from other
 * buffs (both "Speed Aura" and "Onslaught" are category 1), so this is a
 * name-shape check layered on top, not a `BuffCategory` value of its own.
 */
function effectTags(row: EffectRow): string[] {
  const tags: string[] = [];
  const categoryTag = row.buffCategory != null ? BUFF_CATEGORY_TAG[row.buffCategory] : undefined;
  if (categoryTag) tags.push(categoryTag);
  if (AILMENT_NAMES.has(row.name)) tags.push('Ailment');
  if (row.name.endsWith(' Aura')) tags.push('Aura');
  return tags;
}

/**
 * Normalizes one filtered {@link EffectRow} into a {@link WikiEffectDetail}.
 * Slugged from `name`, not `id` - unlike mods, effects are pre-filtered to
 * rows with a real name before this ever runs (see `syncEffects`), so
 * there's no `id`-fallback case to cover.
 */
export function normalizeEffect(row: EffectRow, lastSynced: string): WikiEffectDetail {
  return {
    kind: 'effect',
    slug: slugify(row.name),
    name: row.name,
    category: 'Effect',
    description: stripBracketMarkup(row.description),
    tags: effectTags(row),
    lastSynced,
  };
}

/**
 * One `EndgameMaps` row joined to its `WorldAreas.Name` - see
 * `readMapRows` in scripts/sync-wiki.ts, which does the join. This module
 * only shapes it onto `WikiMapDetail`, same split as {@link CurrencyText}.
 */
export interface MapRow {
  name: string;
  flavourText: string;
}

/** Normalizes one {@link MapRow} into a {@link WikiMapDetail}. */
export function normalizeMap(row: MapRow, lastSynced: string): WikiMapDetail {
  return {
    kind: 'map',
    slug: slugify(row.name),
    name: row.name,
    category: 'Map',
    description: stripBracketMarkup(row.flavourText),
    lastSynced,
  };
}

/**
 * Matches an entry whose own display name marks it as GGG's internal dev
 * content rather than real player-facing wiki content - a literal
 * "[DNT-UNUSED]"/"[DNT]"/"[UNUSED]" prefix (Do Not Translate / unused,
 * GGG's own QA conventions - both prefix shapes appear in real data, e.g.
 * "[UNUSED] Heist Test Weapon" carries no "DNT") or an exact "Removed
 * Skill" name. Verified against a live decode: 87 items, 44 skills, 37
 * effects, 0 mods carry one of these.
 */
export const UNUSED_OR_REMOVED_NAME_RE = /^\[(DNT|UNUSED)\b|^Removed Skill$/i;

/**
 * Effect names that mark internal engine/QA state rather than a real
 * ailment or buff a player would look up - not name-marked the way
 * {@link UNUSED_OR_REMOVED_NAME_RE} entries are, so listed explicitly.
 * Effect-only: the equivalent "Test"-shaped pattern on *items* has real
 * player-facing false positives ("Test of Strength Barya" - a real Trial
 * of the Sekhemas room, not internal content), so this isn't a general
 * cross-kind regex.
 */
const UNUSED_EFFECT_NAMES = new Set([
  'Grace Period', 'Cutscene in Progress', 'Block Test', 'Minion Test',
  'Projectile Test', 'Duration Test', 'Totem Test', 'Trap Test',
  'Mine and Trap Test', 'Spiral Test Cheat',
]);

/** The search-index category every unused/removed entry gets reassigned to, regardless of its real one - see {@link toSearchEntry}. */
export const UNUSED_OR_REMOVED_CATEGORY = 'Unused / Removed';

/**
 * True for an entry that should browse under {@link UNUSED_OR_REMOVED_CATEGORY}
 * instead of its real category - name-marked (see
 * {@link UNUSED_OR_REMOVED_NAME_RE}, every kind), an explicitly-listed
 * internal-state effect (see {@link UNUSED_EFFECT_NAMES}), or, for items
 * only, one of GGPK's own `_OLD`-suffixed legacy item classes
 * (`PinnacleKey_OLD`, `UncutSkillGem_OLD`, `UncutReservationGem_OLD`,
 * `UncutSupportGem_OLD`) - the same "superseded, kept only for history"
 * situation, just marked at the class level instead of in the display name.
 */
function isUnusedOrRemoved(detail: WikiItemDetail | WikiSkillDetail | WikiModDetail | WikiEffectDetail | WikiMapDetail): boolean {
  if (UNUSED_OR_REMOVED_NAME_RE.test(detail.name)) return true;
  if (detail.kind === 'effect' && UNUSED_EFFECT_NAMES.has(detail.name)) return true;
  return detail.kind === 'item' && detail.category.endsWith('_OLD');
}

/**
 * Slims a detail record down to the {@link WikiSearchEntry} shape shipped to
 * the browser for search. Mods have no `tags` field of their own; their
 * mutual-exclusion `families` (the closest analog - what determines which
 * other mods they compete with) stand in for search tags.
 *
 * An unused/removed entry (see {@link isUnusedOrRemoved}) gets its *search
 * index* category reassigned to {@link UNUSED_OR_REMOVED_CATEGORY} so it
 * groups into its own clearly-labeled section on the browse page instead of
 * sitting mixed into a normal category ("Axe Chop" next to real skill
 * gems) - still fully browsable (a "history" of what GGG cut), without
 * polluting the categories a normal reader browses. The detail record
 * itself (and its own page, if visited directly) keeps its real category -
 * only the browse-page grouping changes.
 */
/**
 * Raw item categories the currency-specific rules below apply to - the two
 * literal Currency-named raw itemClasses (`StackableCurrency`, `Currency`),
 * not the broader "Currency" *taxonomy group* in categoryTaxonomy.ts (which
 * also covers SoulCore/Omen/VaultKey/etc - their own tags carry real
 * information, e.g. SoulCore's `rune`/`idol` distinction, and are left
 * alone). This is deliberately the narrower of the two "currency" meanings.
 */
const CURRENCY_RAW_CATEGORIES = new Set(['StackableCurrency', 'Currency']);

/**
 * The category an Essence-tagged currency item (82 in a live decode - the
 * `essence` tag) gets promoted to, instead of carrying `essence` as just
 * another tag lost among quality_currency/catalyst/socket_currency noise.
 */
export const ESSENCE_CATEGORY = 'Essence';

/**
 * True for a tag that duplicates information the row already shows some
 * other way: it reads identically to the entry's own category ("dagger" on
 * a `Dagger`-categorized item), or it's the bare "onehand"/"twohand" half
 * of a pair that also carries the fuller "one_hand_weapon"/"two_hand_weapon"
 * tag - the same fact stated twice (342 items in a live decode carry both
 * halves of one of these pairs).
 */
function isRedundantTag(tag: string, category: string, allTags: string[]): boolean {
  if (humanizeCategory(tag).toLowerCase() === humanizeCategory(category).toLowerCase()) return true;
  if (tag === 'onehand' && allTags.includes('one_hand_weapon')) return true;
  if (tag === 'twohand' && allTags.includes('two_hand_weapon')) return true;
  return false;
}

export function toSearchEntry(
  detail: WikiItemDetail | WikiSkillDetail | WikiModDetail | WikiEffectDetail | WikiMapDetail,
): WikiSearchEntry {
  let category = isUnusedOrRemoved(detail) ? UNUSED_OR_REMOVED_CATEGORY : detail.category;
  let tags: string[];

  if (detail.kind === 'mod') {
    tags = detail.families;
  } else if (detail.kind === 'effect') {
    tags = detail.tags;
  } else if (detail.kind === 'map') {
    tags = [];
  } else if (detail.kind === 'item' && CURRENCY_RAW_CATEGORIES.has(category)) {
    // Currency rows carry a long tail of internal grouping tags
    // (quality_currency, catalyst, socket_currency, mushrune, ...) that add
    // clutter, not information, for a wiki reader - Jaycee's call: strip
    // all of it except incursion_currency (a real, useful distinction -
    // "this only drops/works inside Incursion"), and promote the `essence`
    // tag to its own category instead of leaving it buried as just another
    // tag among the noise.
    if (detail.tags.includes('essence')) category = ESSENCE_CATEGORY;
    tags = detail.tags.includes('incursion_currency') ? ['incursion_currency'] : [];
  } else {
    // "default" carries no information - it's GGPK's own catch-all/base-
    // variant tag, present on 4,535 of 4,975 items (91% in a live decode)
    // versus 0 skills.
    tags = detail.tags.filter((t) => t !== 'default' && !isRedundantTag(t, category, detail.tags));
  }

  return {
    slug: detail.slug,
    name: detail.name,
    kind: detail.kind,
    category,
    tags,
  };
}
