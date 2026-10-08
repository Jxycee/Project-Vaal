/**
 * Writes src/lib/pob/data/uniques.json: every unique item Path of Building 2
 * knows, from its src/Data/Uniques/*.lua (MIT). Our wiki data lists only SOME
 * of a unique's mods (Morior Invictus: 1 of 4); PoB carries the full list.
 *
 * Source format: each unique is a `[[ ... ]]` text block:
 *   name / base type / header lines (League:, Variant:, Requires Level N,
 *   Sockets:, Grants Skill:, ...) / `Implicits: N` / N implicit lines / the
 *   explicit lines. A mod line may start with `{tags:..}`, `{variant:1,2}`,
 *   `{range:0.5}`, `{group:1}` etc.; those are stripped from the text.
 *
 * Output keyed by unique name:
 *   { base, level?, league?, implicits, explicits, variants?, iv?, ev?, grants? }
 * `variants` is the ordered Variant: list; `iv` / `ev` map an implicit /
 * explicit line index to the 1-based variant numbers the line applies to (a
 * line absent from the map applies to every variant). Where two blocks share
 * a name (Grand Spectrum on three bases), the first keeps the plain name and
 * the rest are keyed "Name (Base)".
 *
 * Re-run after PoB2 moves: npx tsx scripts/sync-pob-uniques.ts
 * Also prints how many PoB uniques are absent from our wiki data.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/dev/src/Data/Uniques/';
const FILES = (
  'amulet axe belt body boots bow claw crossbow dagger fishing flail flask focus gloves helmet incursionlimb jewel ' +
  'mace quiver ring sceptre shield soulcore spear staff sword talisman tincture traptool wand ' +
  'Special/Generated Special/New Special/race'
).split(' ');

export type PobUnique = {
  base: string;
  /** Per-variant base types in variant order, when the base differs between variants. */
  bases?: string[];
  level?: number;
  league?: string;
  implicits: string[];
  explicits: string[];
  variants?: string[];
  iv?: Record<number, number[]>;
  ev?: Record<number, number[]>;
  grants?: string[];
};

const HEADER = /^(Variant|League|Requires Level|Sockets|Source|Version|Limited to|Radius|Grants Skill|Selected Variant|Selected Alt Variant|Selected Alt Variant Two|Selected Alt Variant Three|Has Alt Variant|Has Alt Variant Two|Has Alt Variant Three|Allow Duplicate Variants|Crafted|Right ring slot|Left ring slot|Implicits)\b/;

function parseLine(raw: string): { text: string; variants?: number[] } {
  let variants: number[] | undefined;
  let s = raw.trim();
  for (;;) {
    const m = /^\{([^}]*)\}/.exec(s);
    if (!m) break;
    const v = /^variant:([\d,]+)$/.exec(m[1]);
    if (v) variants = v[1].split(',').map(Number);
    s = s.slice(m[0].length);
  }
  return { text: s, variants };
}

export function parseBlock(block: string): { name: string; unique: PobUnique } | null {
  const lines = block.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) return null;
  const name = lines[0];
  // The base line may be split per variant ("{variant:1}Ironclad Vestments" /
  // "{variant:2}Plated Vestments"): base is the last listed (newest), bases all.
  // Header lines may come before the base line too (Oaksworn lists Variant:
  // lines first), so base and header lines are read in one pass.
  const u: PobUnique = { base: '', implicits: [], explicits: [] };
  const bases: string[] = [];
  let baseDone = false;
  const variants: string[] = [];
  const grants: string[] = [];
  let implicitCount = 0;
  let i = 1;
  // Header: every line up to and including `Implicits: N`; with no such line,
  // the leading run of base and known header lines.
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (!HEADER.test(l)) {
      if (baseDone) break;
      const p = parseLine(l);
      bases.push(p.text);
      if (!p.variants) baseDone = true;
      continue;
    }
    // A header after the base line(s) ends the base: later variant-tagged lines are mods.
    if (bases.length > 0) baseDone = true;
    if (l.startsWith('Implicits:')) {
      implicitCount = Number(l.slice('Implicits:'.length)) || 0;
      i++;
      break;
    }
    const lv = /^Requires Level (\d+)/.exec(l);
    if (lv) u.level = Number(lv[1]);
    else if (l.startsWith('Variant:')) variants.push(l.slice(8).trim());
    else if (l.startsWith('League:')) u.league = l.slice(7).trim();
    else if (l.startsWith('Grants Skill:')) grants.push(l.slice(13).trim());
  }
  if (bases.length === 0) return null;
  u.base = bases[bases.length - 1];
  if (bases.length > 1) u.bases = bases;
  let n = 0;
  for (; i < lines.length; i++, n++) {
    const { text, variants: vs } = parseLine(lines[i]);
    if (!text) continue;
    // "Grants Skill:" sits among the implicit lines (and counts toward N) but is a skill grant, not a mod.
    if (text.startsWith('Grants Skill:')) {
      grants.push(text.slice(13).trim());
      continue;
    }
    const isImplicit = n < implicitCount;
    const list = isImplicit ? u.implicits : u.explicits;
    if (vs) {
      const key = isImplicit ? 'iv' : 'ev';
      (u[key] ??= {})[list.length] = vs;
    }
    list.push(text);
  }
  if (variants.length) u.variants = variants;
  if (grants.length) u.grants = grants;
  return { name, unique: u };
}

export function parseFile(lua: string): { name: string; unique: PobUnique }[] {
  const out: { name: string; unique: PobUnique }[] = [];
  for (const m of lua.matchAll(/\[\[\r?\n([\s\S]*?)\r?\n\]\]/g)) {
    const p = parseBlock(m[1]);
    if (p) out.push(p);
  }
  return out;
}

async function main() {
  const all: Record<string, PobUnique> = {};
  const clashes: string[] = [];
  for (const f of FILES) {
    const url = BASE + f + '.lua';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    for (const { name, unique } of parseFile(await res.text())) {
      if (name in all) {
        // Same name on different bases (Grand Spectrum comes in three): later ones are keyed "Name (Base)".
        const key = `${name} (${unique.base})`;
        clashes.push(key);
        all[key] = unique;
      } else all[name] = unique;
    }
  }
  const dir = path.join(process.cwd(), 'src', 'lib', 'pob', 'data');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'uniques.json');
  writeFileSync(file, JSON.stringify(all));

  const itemsDir = path.join(process.cwd(), 'public', 'data', 'wiki', '2026-08-25', 'items');
  const slug = (n: string) => n.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const names = Object.keys(all);
  const missing = names.filter((n) => !existsSync(path.join(itemsDir, slug(n) + '.json')));
  console.log(`${names.length} uniques -> ${file}`);
  if (clashes.length) console.log(`name clashes (first kept): ${clashes.join(', ')}`);
  console.log(`${missing.length} of ${names.length} not in wiki items dir: ${missing.join(' | ')}`);
}

if (process.argv[1] && /sync-pob-uniques/.test(process.argv[1])) await main();
