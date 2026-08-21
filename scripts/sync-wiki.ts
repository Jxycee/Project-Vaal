/**
 * Wiki sync script: decodes GGPK tables via `pathofexile-dat`, runs the
 * item/gem/mod extractors from `@poe2-toolkit` against the live PoE2 patch
 * CDN, normalizes the results (see src/lib/wiki/normalize.ts), validates
 * the output isn't truncated, and writes the wiki's static JSON + icon
 * files to public/data/wiki/<WIKI_DATA_VERSION>/.
 *
 * Run for real with: npx tsx scripts/sync-wiki.ts
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, cpSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createCdnSource } from '@poe2-toolkit/ggpk';
import { extractItems } from '@poe2-toolkit/item-extractor';
import { extractGems } from '@poe2-toolkit/gem-extractor';
import { extractMods } from '@poe2-toolkit/mod-extractor';
import { normalizeItem, normalizeSkill, normalizeMod, toSearchEntry, slugify } from '../src/lib/wiki/normalize';
import { WIKI_DATA_VERSION, WIKI_PATCH_VERSION } from '../src/lib/wiki/types';
import type { WikiSearchEntry, WikiItemDetail, WikiSkillDetail, WikiModDetail } from '../src/lib/wiki/types';

const WIKI_ROOT = path.join(process.cwd(), 'public', 'data', 'wiki');
const OUT_DIR = path.join(WIKI_ROOT, WIKI_DATA_VERSION);
const EXTRACT_DIR = path.join(process.cwd(), 'scripts', 'wiki', '.extract');
const TABLES_DIR = path.join(EXTRACT_DIR, 'tables', 'English');

export function validateSyncResult(
  entries: WikiSearchEntry[],
  previousCount: number,
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
  if (previousCount > 0 && entries.length < previousCount * 0.9) {
    throw new Error(
      `wiki sync: count dropped from ${previousCount} to ${entries.length} ` +
      `(>10%) — likely truncation or a bad WIKI_PATCH_VERSION, refusing to write`,
    );
  }
}

/** Icon PNG results are keyed by "<dds path minus extension>.png" (@poe2-toolkit/ggpk convention). */
export function ddsPathToIconKey(ddsPath: string): string {
  return /\.dds$/i.test(ddsPath) ? ddsPath.replace(/\.dds$/i, '.png') : ddsPath;
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

/** Entry count from `<kind>-index.json` in the most recent prior sync's directory, or 0 if there is none. */
export function findPreviousCount(wikiRoot: string, currentVersion: string, kind: string): number {
  const dir = findPreviousVersionDir(wikiRoot, currentVersion);
  if (!dir) return 0;
  try {
    const raw = readFileSync(path.join(dir, `${kind}-index.json`), 'utf8');
    return (JSON.parse(raw).entries as unknown[]).length;
  } catch {
    return 0;
  }
}

function previousCount(kind: string): number {
  return findPreviousCount(WIKI_ROOT, WIKI_DATA_VERSION, kind);
}

function writeIcon(slug: string, iconKey: string | null, icons: Record<string, Buffer>): string | null {
  if (!iconKey) return null;
  const buf = icons[iconKey];
  if (!buf) return null;
  mkdirSync(path.join(OUT_DIR, 'icons'), { recursive: true });
  writeFileSync(path.join(OUT_DIR, 'icons', `${slug}.png`), buf);
  return `/data/wiki/${WIKI_DATA_VERSION}/icons/${slug}.png`;
}

async function syncItems(): Promise<number> {
  const source = await createCdnSource({ patch: WIKI_PATCH_VERSION, cacheDir: path.join(EXTRACT_DIR, '.cache'), tablesDir: TABLES_DIR });
  const { data, icons } = await extractItems(source);
  const usedSlugs = new Set<string>();
  const details: WikiItemDetail[] = Object.entries(data).map(([name, item]) => {
    // `name` doubles as both the base-slug input and the disambiguator: real
    // data currently has zero item slug collisions (ItemData is already keyed
    // by name, so two entries can only collide if two *different* names
    // slugify to the same string - not observed in a real extract). Passing
    // `name` again is a no-op disambiguator in that edge case, but the
    // numeric fallback in dedupeSlug still guarantees uniqueness either way.
    const slug = dedupeSlug(slugify(name), name, usedSlugs);
    const iconUrl = item.icon ? writeIcon(slug, ddsPathToIconKey(item.icon), icons.icons) : null;
    return { ...normalizeItem(name, item, iconUrl), slug };
  });
  return writeKind('item', details);
}

async function syncSkills(): Promise<number> {
  const source = await createCdnSource({ patch: WIKI_PATCH_VERSION, cacheDir: path.join(EXTRACT_DIR, '.cache'), tablesDir: TABLES_DIR });
  const { data, icons } = await extractGems(source);
  const usedSlugs = new Set<string>();
  const details: WikiSkillDetail[] = Object.entries(data.gems)
    // "Coming Soon" is GGG's own placeholder name for dozens of unreleased,
    // content-free gem slots (verified against a live extract: 45 distinct
    // keys, all sharing this exact name) - not real wiki content.
    .filter(([, gem]) => gem.name !== 'Coming Soon')
    .map(([key, gem]) => {
      const slug = dedupeSlug(slugify(gem.name), key, usedSlugs);
      const iconUrl = gem.icon ? writeIcon(slug, ddsPathToIconKey(gem.icon), icons.icons) : null;
      return { ...normalizeSkill(key, gem, data.requirements[key] ?? null, data.scaling[key] ?? null, iconUrl), slug };
    });
  return writeKind('skill', details);
}

async function syncMods(): Promise<number> {
  const source = await createCdnSource({ patch: WIKI_PATCH_VERSION, cacheDir: path.join(EXTRACT_DIR, '.cache'), tablesDir: TABLES_DIR });
  const { data } = await extractMods(source);
  const usedSlugs = new Set<string>();
  const details: WikiModDetail[] = Object.entries(data).map(([id, mod]) => {
    const slug = dedupeSlug(slugify(id), id, usedSlugs);
    return { ...normalizeMod(id, mod), slug };
  });
  return writeKind('mod', details);
}

function writeKind(
  kind: 'item' | 'skill' | 'mod',
  details: Array<WikiItemDetail | WikiSkillDetail | WikiModDetail>,
): number {
  const entries = details.map(toSearchEntry);
  validateSyncResult(entries, previousCount(kind));

  mkdirSync(path.join(OUT_DIR, `${kind}s`), { recursive: true });
  writeFileSync(
    path.join(OUT_DIR, `${kind}-index.json`),
    JSON.stringify({ version: WIKI_DATA_VERSION, generatedAt: new Date().toISOString(), entries }),
  );
  for (const detail of details) {
    writeFileSync(path.join(OUT_DIR, `${kind}s`, `${detail.slug}.json`), JSON.stringify(detail));
  }
  return entries.length;
}

async function main(): Promise<void> {
  ensureTablesDecoded();
  const items = await syncItems();
  const skills = await syncSkills();
  const mods = await syncMods();
  console.log(`wiki sync complete: ${items} items, ${skills} skills, ${mods} mods -> ${OUT_DIR}`);
}

if (process.argv[1]?.includes('sync-wiki')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
