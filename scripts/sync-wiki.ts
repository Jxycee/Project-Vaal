/**
 * Wiki sync script: decodes GGPK tables via `pathofexile-dat`, runs the
 * item/gem/mod extractors from `@poe2-toolkit` against the live PoE2 patch
 * CDN, normalizes the results (see src/lib/wiki/normalize.ts), validates
 * the output isn't truncated, and writes the wiki's static JSON + icon
 * files to public/data/wiki/<WIKI_DATA_VERSION>/.
 *
 * Run for real with: npx tsx scripts/sync-wiki.ts
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';
import { createCdnSource } from '@poe2-toolkit/ggpk';
import { extractItems } from '@poe2-toolkit/item-extractor';
import { extractGems } from '@poe2-toolkit/gem-extractor';
import { extractMods } from '@poe2-toolkit/mod-extractor';
import { normalizeItem, normalizeSkill, normalizeMod, toSearchEntry, slugify, parsePobUniqueFile } from '../src/lib/wiki/normalize';
import type { CurrencyText, PobUniqueEntry } from '../src/lib/wiki/normalize';
import { WIKI_DATA_VERSION, WIKI_PATCH_VERSION } from '../src/lib/wiki/types';
import type { WikiSearchEntry, WikiItemDetail, WikiSkillDetail, WikiModDetail, WikiItemFlask } from '../src/lib/wiki/types';

const WIKI_ROOT = path.join(process.cwd(), 'public', 'data', 'wiki');
const OUT_DIR = path.join(WIKI_ROOT, WIKI_DATA_VERSION);
const EXTRACT_DIR = path.join(process.cwd(), 'scripts', 'wiki', '.extract');
const TABLES_DIR = path.join(EXTRACT_DIR, 'tables', 'English');

/**
 * Longest edge, in pixels, of a published icon. The extractor emits the
 * game's source art at up to 512x1024 (~38KB average, 742KB worst case);
 * every detail page renders it in a 48x48 box. Publishing the source
 * resolution shipped 184MB of art nobody could see: it blew past the
 * mobile-first budget, traced into every ISR route's serverless bundle, and
 * landed in the PWA precache manifest. 128 keeps a 2x buffer over the 48px
 * display box for high-DPI screens without any of that.
 */
const ICON_MAX_EDGE = 128;

/**
 * Waives the >10% drop check for one run. Opt-in per invocation and never
 * set in CI (.github/workflows/sync-wiki.yml runs `npm run sync:wiki` with
 * no flags), so an unattended weekly sync still refuses to publish a
 * truncated extract. Use it when a filter change makes the drop expected —
 * and say so in the sync PR.
 */
const ALLOW_SHRINK = process.argv.includes('--allow-shrink');

export function validateSyncResult(
  entries: WikiSearchEntry[],
  previousCount: number,
  options: { allowShrink?: boolean } = {},
): void {
  if (entries.length === 0) {
    throw new Error('wiki sync: result set is empty — refusing to write');
  }
  const slugs = new Set<string>();
  for (const e of entries) {
    if (slugs.has(e.slug)) {
      throw new Error(`wiki sync: duplicate slug "${e.slug}" (kind: ${e.kind})`);
    }
    slugs.add(e.slug);
  }
  // The empty and duplicate checks above are unconditional. Only the drop
  // check can be waived, and only deliberately: a >10% shrink is either
  // truncation (the failure this guard exists for) or a filter change the
  // operator just made on purpose. Those are indistinguishable from in here,
  // so the caller has to say which, and the default is to refuse.
  if (!options.allowShrink && previousCount > 0 && entries.length < previousCount * 0.9) {
    throw new Error(
      `wiki sync: count dropped from ${previousCount} to ${entries.length} ` +
      `(>10%) — likely truncation or a bad WIKI_PATCH_VERSION, refusing to write. ` +
      `If this drop is intentional (a new filter, say), re-run with --allow-shrink.`,
    );
  }
}

/** Icon PNG results are keyed by "<dds path minus extension>.png" (@poe2-toolkit/ggpk convention). */
export function ddsPathToIconKey(ddsPath: string): string {
  return /\.dds$/i.test(ddsPath) ? ddsPath.replace(/\.dds$/i, '.png') : ddsPath;
}

/**
 * Joins PoE2's `CurrencyItems` table to `BaseItemTypes` by row index — the
 * same `BaseItemType`-keyed join `@poe2-toolkit/item-extractor`'s own
 * `buildItems.js` already uses internally for `AttributeRequirements`/
 * `ArmourTypes`/`WeaponTypes`/`ItemSpirit` — then re-keys the result by
 * display `Name` so it lines up with `extractItems()`'s `ItemData` keys
 * (item-extractor exposes no row index on its own `Item` type, so `Name`
 * is the only join key available on the consuming side).
 *
 * Reads the tables directly off disk rather than through `GgpkSource`:
 * `item-extractor` doesn't read this table at all, so there's no extractor
 * API to ask for it — `pathofexile-dat` already decoded it to
 * `<tablesDir>/CurrencyItems.json` as a flat JSON array (same place/shape
 * every other table in `scripts/wiki/pathofexile-dat.config.json` lands),
 * so a plain read is the whole job.
 *
 * Verified against a live decode (2026-08-21): 1,518 CurrencyItems rows /
 * 1,007 distinct names, covering StackableCurrency (437/437), SoulCore
 * (260/295), MapFragment (125/132), Omen (49/50), Incubator (30/30),
 * Breachstone (26/26), the three UncutXGemStackable classes, and several
 * smaller categories. Does not cover QuestItem, Jewel, flasks, or gear —
 * consistent with those genuinely carrying no in-game use-text. Of those
 * 1,518 rows, 683 also have a populated `XBoxDirections` (console button
 * prompts, e.g. "<<xbox_button_x>> to use...") — the other 835 have none in
 * the game's own data, not a gap in this join.
 */
export function joinCurrencyByName(tablesDir: string): Map<string, CurrencyText> {
  const baseRows: { _index: number; Name: string }[] =
    JSON.parse(readFileSync(path.join(tablesDir, 'BaseItemTypes.json'), 'utf8'));
  const currencyRows: { BaseItemType: number; StackSize: number; Description: string | null; Directions: string | null; XBoxDirections: string | null }[] =
    JSON.parse(readFileSync(path.join(tablesDir, 'CurrencyItems.json'), 'utf8'));

  const nameByIndex = new Map(baseRows.map((r) => [r._index, r.Name]));
  const result = new Map<string, CurrencyText>();
  for (const row of currencyRows) {
    const name = nameByIndex.get(row.BaseItemType);
    // First row wins on a name collision — same convention `extractItems()`
    // itself uses for ItemData (verified in @poe2-toolkit/item-extractor's
    // own buildItems.js: "First displayable base seen for a name wins").
    if (name && !result.has(name)) {
      result.set(name, {
        stackSize: row.StackSize,
        description: row.Description,
        directions: row.Directions,
        xboxDirections: row.XBoxDirections,
      });
    }
  }
  return result;
}

/**
 * Joins each base item's `BaseItemTypes.Implicit_Mods` (an array of row
 * indices into `Mods`) to that mod's rendered stat text, keyed by display
 * name so it lines up with `extractItems()`'s `ItemData` keys — the same
 * join shape as {@link joinCurrencyByName}.
 *
 * Unlike currency text, this covers gear: 519/5,476 real `BaseItemTypes`
 * rows (2026-08-22 live decode) have at least one implicit mod — e.g.
 * "Barbed Spear" carries `SpearImplicitFasterBleed1`, which
 * `@poe2-toolkit/mod-extractor`'s raw (pre-filter) `ModData` renders as
 * "Bleeding you inflict deals Damage (10-20)% faster". `modData` is the
 * caller's own `extractMods(source)` result, passed in rather than
 * re-extracted here, so `syncItems` and `syncMods` share one extraction
 * pass instead of paying for it twice per sync run.
 *
 * Some implicits carry no player-facing stat line at all (e.g.
 * `SpearImplicitDisplaySpearThrow1`, which just flags that the base grants
 * a skill — `stats: []`, verified against a live decode) — those are
 * dropped rather than rendered as an empty row. A base whose implicits are
 * ALL like that (or that has none) is simply absent from the returned map,
 * same "no entry, not an empty array" convention as `joinCurrencyByName`.
 */
export function joinImplicitModsByName(
  tablesDir: string,
  modData: Record<string, { stats: string[] }>
): Map<string, string[]> {
  const baseRows: { _index: number; Name: string; Implicit_Mods: number[] }[] =
    JSON.parse(readFileSync(path.join(tablesDir, 'BaseItemTypes.json'), 'utf8'));
  const modRows: { _index: number; Id: string }[] =
    JSON.parse(readFileSync(path.join(tablesDir, 'Mods.json'), 'utf8'));

  const modIdByIndex = new Map(modRows.map((r) => [r._index, r.Id]));
  const result = new Map<string, string[]>();
  for (const row of baseRows) {
    if (!row.Implicit_Mods || row.Implicit_Mods.length === 0) continue;
    const stats: string[] = [];
    for (const modIndex of row.Implicit_Mods) {
      const modId = modIdByIndex.get(modIndex);
      const mod = modId ? modData[modId] : undefined;
      if (mod) stats.push(...mod.stats);
    }
    // First base wins on a name collision — same convention as joinCurrencyByName.
    if (stats.length > 0 && !result.has(row.Name)) {
      result.set(row.Name, stats);
    }
  }
  return result;
}

/**
 * Joins `Flasks` (life/mana recovery, recovery time) to display name, same
 * join shape as {@link joinCurrencyByName}. `CurrencyItems` doesn't cover
 * flasks at all — flasks are `ModDomain: 'Flask'`, not currency — so this
 * is what fills in the "what does this flask actually do" gap for
 * LifeFlask/ManaFlask/UtilityFlask bases specifically, e.g. "Transcendent
 * Mana Flask" (verified against a live decode: 31 real Flasks rows, 100%
 * of the flask-domain bases).
 *
 * `Flasks.RecoveryTime` is in tenths of a second (schema's own inline
 * comment, confirmed against real values — a Lesser Life Flask's
 * `RecoveryTime: 30` matches its well-known 3-second recovery). Divided by
 * 10 here so `WikiItemFlask.duration` is real seconds, not a raw game unit
 * a page would have to know to reinterpret. `Flasks.RecoveryTime2` is not
 * read at all: every sampled row has `RecoveryTime2 === RecoveryTime`
 * (verified against a live decode), so it carries no information this
 * join doesn't already have.
 */
export function joinFlaskStatsByName(tablesDir: string): Map<string, WikiItemFlask> {
  const baseRows: { _index: number; Name: string }[] =
    JSON.parse(readFileSync(path.join(tablesDir, 'BaseItemTypes.json'), 'utf8'));
  const flaskRows: { BaseItemType: number; LifePerUse: number; ManaPerUse: number; RecoveryTime: number }[] =
    JSON.parse(readFileSync(path.join(tablesDir, 'Flasks.json'), 'utf8'));

  const nameByIndex = new Map(baseRows.map((r) => [r._index, r.Name]));
  const result = new Map<string, WikiItemFlask>();
  for (const row of flaskRows) {
    const name = nameByIndex.get(row.BaseItemType);
    // First row wins on a name collision — same convention as joinCurrencyByName.
    if (name && !result.has(name)) {
      result.set(name, {
        lifeRecovery: row.LifePerUse,
        manaRecovery: row.ManaPerUse,
        duration: row.RecoveryTime / 10,
      });
    }
  }
  return result;
}

/**
 * Commit pinned for {@link fetchPobUniquesByName}, not `dev`'s moving HEAD -
 * same reproducibility reasoning as `WIKI_PATCH_VERSION`: a sync re-run
 * should only change when this file's data actually changes, not on every
 * unrelated commit landing in the upstream repo between two of our syncs.
 * Bump by hand when the sync PR shows stale/missing unique data, same
 * workflow as bumping the GGPK patch.
 */
const POB_COMMIT = '5d173cbf8c9cf394a975cbb813f19d0b6dc67ea6';

/**
 * One entry per file in Path of Building Community's `src/Data/Uniques/`
 * (verified against a live directory listing at {@link POB_COMMIT}): the 30
 * equippable item-class files, plus the three `Special/` files (event/race
 * items and generated specials) - harmless to include even if none of their
 * entries ever match a real synced item name.
 */
const POB_UNIQUE_FILES = [
  'Special/Generated', 'Special/New', 'Special/race',
  'amulet', 'axe', 'belt', 'body', 'boots', 'bow', 'claw', 'crossbow', 'dagger',
  'fishing', 'flail', 'flask', 'focus', 'gloves', 'helmet', 'incursionlimb',
  'jewel', 'mace', 'quiver', 'ring', 'sceptre', 'shield', 'soulcore', 'spear',
  'staff', 'sword', 'talisman', 'tincture', 'traptool', 'wand',
];

/**
 * Fetches and parses every {@link POB_UNIQUE_FILES} entry, joining into one
 * name-keyed map (first match wins on a name collision, same convention as
 * every other by-name join in this file). Item data (c) Grinding Gear Games,
 * per PoB's own file headers; PoB itself is MIT licensed (its `LICENSE.md`) -
 * see the wiki footer's credit line.
 *
 * A network failure here degrades gracefully rather than aborting the whole
 * sync: this is a supplementary enrichment layer over GGPK data, not part of
 * the core item/skill/mod extraction `validateSyncResult` guards against
 * truncation for. A file that fails to fetch just means its uniques keep
 * `uniqueMods: null`, same as before this join existed.
 */
async function fetchPobUniquesByName(): Promise<Map<string, PobUniqueEntry>> {
  const result = new Map<string, PobUniqueEntry>();
  const files = await Promise.all(POB_UNIQUE_FILES.map(async (file) => {
    const url = `https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/${POB_COMMIT}/src/Data/Uniques/${file}.lua`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      console.warn(`wiki sync: failed to fetch PoB unique data "${file}.lua" (${(err as Error).message}) — its uniques will have no explicit mods this sync.`);
      return null;
    }
  }));
  for (const text of files) {
    if (!text) continue;
    for (const entry of parsePobUniqueFile(text)) {
      if (!result.has(entry.name)) result.set(entry.name, entry);
    }
  }
  return result;
}

/**
 * Real GGPK data has legitimate slug collisions that a single Task-1-style
 * fixture never exercised: distinct gems sharing a display name (e.g. a
 * unique-item-triggered "Herald of Ash" alongside the ordinary skill gem, or
 * the per-weapon-type "Sword Slash" / "Axe Slash" default-attack gems), and
 * at least one raw mod id pair whose punctuation collapses to the same slug
 * (`GrantCursePillarSkillUnique` vs `GrantCursePillarSkillUnique__`). None of
 * this is truncation - `validateSyncResult`'s duplicate-slug check exists to
 * catch a *bug* producing colliding output, not to reject real data - so the
 * sync script (not `normalize.ts`, whose slug is a pure function of one
 * record) is responsible for making every written slug unique: the first
 * record to claim a base slug keeps it, later collisions get a stable
 * disambiguator appended (derived from the record's own already-unique key,
 * camelCase-split for readability), with a numeric fallback for the
 * vanishingly unlikely case where even that collides.
 */
export function dedupeSlug(baseSlug: string, disambiguator: string, used: Set<string>): string {
  if (!used.has(baseSlug)) {
    used.add(baseSlug);
    return baseSlug;
  }
  const suffix = slugify(disambiguator.replace(/([a-z0-9])([A-Z])/g, '$1-$2'));
  let candidate = `${baseSlug}-${suffix}`;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${baseSlug}-${suffix}-${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

function ensureTablesDecoded(): void {
  if (existsSync(TABLES_DIR)) return;
  mkdirSync(EXTRACT_DIR, { recursive: true });
  cpSync(
    path.join(process.cwd(), 'scripts', 'wiki', 'pathofexile-dat.config.json'),
    path.join(EXTRACT_DIR, 'config.json'),
  );
  // Windows: npx resolves to npx.cmd, which execFileSync cannot spawn without
  // shell: true (it is not a real PE executable).
  execFileSync('npx', ['pathofexile-dat'], { cwd: EXTRACT_DIR, stdio: 'inherit', shell: true });
}

/**
 * The most recent prior sync's output directory, or `null` on a first-ever
 * sync. Deliberately excludes `currentVersion`: that directory is the
 * in-progress run's own `OUT_DIR`, which is always empty/nonexistent at the
 * point the truncation guard runs (`WIKI_DATA_VERSION` is bumped once per
 * weekly sync PR, so "compare against the current version's own directory"
 * - the plan's original sample code, and this script's first draft - would
 * never find a previous count in the real workflow it exists to protect).
 * Version directories are named `YYYY-MM-DD`, so a plain string sort orders
 * them chronologically.
 */
export function findPreviousVersionDir(wikiRoot: string, currentVersion: string): string | null {
  let names: string[];
  try {
    names = readdirSync(wikiRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== currentVersion)
      .map((e) => e.name);
  } catch {
    return null;
  }
  if (names.length === 0) return null;
  names.sort();
  return path.join(wikiRoot, names[names.length - 1]);
}

/** Entry count in one directory's `<kind>-index.json`, or 0 if it is absent or unreadable. */
function readIndexCount(dir: string, kind: string): number {
  try {
    const raw = readFileSync(path.join(dir, `${kind}-index.json`), 'utf8');
    return (JSON.parse(raw).entries as unknown[]).length;
  } catch {
    return 0;
  }
}

/**
 * The count this run's output is checked against: the larger of
 *
 *   (a) the current version directory's own existing index, and
 *   (b) the most recent *prior* version directory's index.
 *
 * Both are needed because `WIKI_DATA_VERSION` is bumped by hand, not by the
 * sync, and each case is the only one that works in one of the two real
 * workflows:
 *
 *   - Weekly CI (.github/workflows/sync-wiki.yml) re-runs against an
 *     unbumped version, so it overwrites the current directory in place.
 *     Only (a) has a count; (b) is null. This is the common case, and the
 *     one an earlier revision of this function missed entirely - it excluded
 *     the current directory on the assumption the version was always bumped,
 *     which left the guard permanently inert in CI.
 *   - A hand-bumped version writes to a fresh, empty directory. Only (b) has
 *     a count; (a) is 0.
 *
 * Reading (a) is safe despite pointing at this run's own output directory:
 * `writeKind` calls `validateSyncResult` before it writes anything, so the
 * index on disk at that moment is still the previous run's.
 */
export function findPreviousCount(wikiRoot: string, currentVersion: string, kind: string): number {
  const currentDirCount = readIndexCount(path.join(wikiRoot, currentVersion), kind);
  const priorDir = findPreviousVersionDir(wikiRoot, currentVersion);
  const priorDirCount = priorDir ? readIndexCount(priorDir, kind) : 0;
  return Math.max(currentDirCount, priorDirCount);
}

function previousCount(kind: string): number {
  return findPreviousCount(WIKI_ROOT, WIKI_DATA_VERSION, kind);
}

/**
 * Publishes one icon, downscaled to {@link ICON_MAX_EDGE}, and returns its
 * public URL (or `null` when the extractor had no art for this record).
 *
 * Icons are namespaced per kind. `dedupeSlug` only guarantees uniqueness
 * *within* a kind, and a flat `icons/<slug>.png` therefore let kinds collide:
 * a real extract has 1,097 slugs shared between items and skills (every skill
 * gem also exists as a gem *item*), so whichever kind synced last silently
 * overwrote the other's art. That happened to be harmless - the colliding
 * pairs were all gem-item/skill pairs sharing the same source art - but it
 * was one differently-named collision away from a page showing the wrong
 * icon with nothing to catch it.
 *
 * `fit: 'inside'` preserves aspect ratio (source art is not square - weapons
 * run 512x1024), and `withoutEnlargement` leaves already-small art untouched
 * rather than upscaling it.
 *
 * `palette: true` writes PNG-8 (quantized to <=256 colours) instead of
 * PNG-24. Measured over a 61-icon spread of the real set that is 37% of the
 * PNG-24 size - 88.7MB down to ~33MB across the item art - and is
 * indistinguishable at the 48px these are drawn at. WebP would be smaller
 * again (~23MB) but the PNG output format is a settled decision; this keeps
 * it and takes the compression instead.
 */
/**
 * Clears the whole icon tree once per run, before any kind writes into it.
 * Whole-tree rather than per-kind so a layout change cleans up after itself:
 * icons were published flat as `icons/<slug>.png` before they were
 * namespaced per kind, and a per-kind reset would have left all ~5k of those
 * orphaned files sitting in the deployment forever.
 */
function resetIconRoot(): void {
  rmSync(path.join(OUT_DIR, 'icons'), { recursive: true, force: true });
}

async function writeIcon(
  kind: 'item' | 'skill',
  slug: string,
  iconKey: string | null,
  icons: Record<string, Buffer>,
): Promise<string | null> {
  if (!iconKey) return null;
  const buf = icons[iconKey];
  if (!buf) return null;
  const dir = path.join(OUT_DIR, 'icons', `${kind}s`);
  mkdirSync(dir, { recursive: true });
  const resized = await sharp(buf)
    .resize({
      width: ICON_MAX_EDGE,
      height: ICON_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png({ palette: true, quality: 90, effort: 7, compressionLevel: 9 })
    .toBuffer();
  writeFileSync(path.join(dir, `${slug}.png`), resized);
  return `/data/wiki/${WIKI_DATA_VERSION}/icons/${kind}s/${slug}.png`;
}

async function syncItems(lastSynced: string): Promise<number> {
  const source = await createCdnSource({ patch: WIKI_PATCH_VERSION, cacheDir: path.join(EXTRACT_DIR, '.cache'), tablesDir: TABLES_DIR });
  const { data, icons } = await extractItems(source);
  const currencyByName = joinCurrencyByName(TABLES_DIR);
  // syncMods() also calls extractMods() on its own separately-created
  // source — same repeated-but-cheap pattern this file already uses for
  // createCdnSource itself across syncItems/syncSkills/syncMods (each
  // points fresh readers at the already-downloaded local cache, not a
  // network re-fetch). joinImplicitModsByName needs the raw (pre-name-
  // filter) ModData to resolve implicit-mod stat text, which syncMods()'s
  // own filtered copy wouldn't have.
  const { data: modData } = await extractMods(source);
  const implicitModsByName = joinImplicitModsByName(TABLES_DIR, modData);
  const flaskStatsByName = joinFlaskStatsByName(TABLES_DIR);
  const pobUniquesByName = await fetchPobUniquesByName();
  const usedSlugs = new Set<string>();
  const details: WikiItemDetail[] = [];
  for (const [name, item] of Object.entries(data)) {
    // `name` doubles as both the base-slug input and the disambiguator: real
    // data currently has zero item slug collisions (ItemData is already keyed
    // by name, so two entries can only collide if two *different* names
    // slugify to the same string - not observed in a real extract). Passing
    // `name` again is a no-op disambiguator in that edge case, but the
    // numeric fallback in dedupeSlug still guarantees uniqueness either way.
    const slug = dedupeSlug(slugify(name), name, usedSlugs);
    const iconUrl = item.icon
      ? await writeIcon('item', slug, ddsPathToIconKey(item.icon), icons.icons)
      : null;
    details.push({
      ...normalizeItem(
        name, item, iconUrl, lastSynced,
        currencyByName.get(name) ?? null,
        implicitModsByName.get(name) ?? [],
        flaskStatsByName.get(name) ?? null,
        item.rarity === 'unique' ? pobUniquesByName.get(name) ?? null : null,
      ),
      slug,
    });
  }
  return writeKind('item', details);
}

async function syncSkills(lastSynced: string): Promise<number> {
  const source = await createCdnSource({ patch: WIKI_PATCH_VERSION, cacheDir: path.join(EXTRACT_DIR, '.cache'), tablesDir: TABLES_DIR });
  const { data, icons } = await extractGems(source);
  const usedSlugs = new Set<string>();
  const details: WikiSkillDetail[] = [];
  for (const [key, gem] of Object.entries(data.gems)) {
    // "Coming Soon" is GGG's own placeholder name for dozens of unreleased,
    // content-free gem slots (verified against a live extract: 45 distinct
    // keys, all sharing this exact name) - not real wiki content.
    if (gem.name === 'Coming Soon') continue;
    const slug = dedupeSlug(slugify(gem.name), key, usedSlugs);
    const iconUrl = gem.icon
      ? await writeIcon('skill', slug, ddsPathToIconKey(gem.icon), icons.icons)
      : null;
    details.push({
      ...normalizeSkill(key, gem, data.requirements[key] ?? null, data.scaling[key] ?? null, iconUrl, lastSynced),
      slug,
    });
  }
  return writeKind('skill', details);
}

/**
 * Mods with no display name are excluded. `Mod.name` is null for the bulk of
 * `ModData` - per-unique-item mods, internal/`UNUSED` rows, and other
 * generated entries - and `normalizeMod` falls back to the raw `Mods.Id` for
 * those, so they surfaced in the browse list as identifiers like
 * `UniqueAttackCriticalStrikeChance1UNUSED`. On a real extract that was
 * 13,354 of 16,679 entries: 80% of the section, and most of the weight of
 * the slim index every phone downloads, none of it searchable content. The
 * named remainder is the actual player-facing affix pool. Same reasoning and
 * shape as the "Coming Soon" gem filter above.
 */
async function syncMods(lastSynced: string): Promise<number> {
  const source = await createCdnSource({ patch: WIKI_PATCH_VERSION, cacheDir: path.join(EXTRACT_DIR, '.cache'), tablesDir: TABLES_DIR });
  const { data } = await extractMods(source);
  const usedSlugs = new Set<string>();
  const details: WikiModDetail[] = Object.entries(data)
    .filter(([, mod]) => mod.name !== null && mod.name !== '')
    .map(([id, mod]) => {
      const slug = dedupeSlug(slugify(id), id, usedSlugs);
      return { ...normalizeMod(id, mod, lastSynced), slug };
    });
  return writeKind('mod', details);
}

function writeKind(
  kind: 'item' | 'skill' | 'mod',
  details: Array<WikiItemDetail | WikiSkillDetail | WikiModDetail>,
): number {
  const entries = details.map(toSearchEntry);
  validateSyncResult(entries, previousCount(kind), { allowShrink: ALLOW_SHRINK });

  // Rebuild the detail directory from empty rather than writing over it.
  // Overwriting in place leaks: an entity dropped upstream (or one whose
  // slug changed, or a whole class of records newly filtered out) left its
  // old <slug>.json behind forever, still loadable by `loadDetail` and still
  // counted in the deployment. Safe to do here because `validateSyncResult`
  // has already run and the index it read lives at OUT_DIR's root, not
  // inside this directory.
  rmSync(path.join(OUT_DIR, `${kind}s`), { recursive: true, force: true });
  mkdirSync(path.join(OUT_DIR, `${kind}s`), { recursive: true });
  // `generatedAt` is the one field that is expected to change on every run:
  // it records when the sync ran, in the three index files, rather than in
  // all ~9k detail files (see normalizeItem's note on lastSynced).
  writeFileSync(
    path.join(OUT_DIR, `${kind}-index.json`),
    JSON.stringify({
      version: WIKI_DATA_VERSION,
      generatedAt: details[0]?.lastSynced ?? new Date().toISOString(),
      entries,
    }),
  );
  for (const detail of details) {
    writeFileSync(path.join(OUT_DIR, `${kind}s`, `${detail.slug}.json`), JSON.stringify(detail));
  }
  return entries.length;
}

async function main(): Promise<void> {
  ensureTablesDecoded();
  // One instant for the whole run: see normalizeItem's note on why every
  // record in a run shares a timestamp rather than reading the clock itself.
  const lastSynced = new Date().toISOString();
  resetIconRoot();
  const items = await syncItems(lastSynced);
  const skills = await syncSkills(lastSynced);
  const mods = await syncMods(lastSynced);
  console.log(`wiki sync complete: ${items} items, ${skills} skills, ${mods} mods -> ${OUT_DIR}`);
}

if (process.argv[1]?.includes('sync-wiki')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
