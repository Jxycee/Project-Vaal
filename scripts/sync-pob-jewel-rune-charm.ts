/**
 * Writes src/lib/pob/data/mod-{jewel,runes,charm,corrupted,veiled}.json from PoB2's
 * generated Data/Mod*.lua (MIT): the mod definitions for jewels, runes / soul cores /
 * idols / abyssal eyes (including their "Bonded:" lines), charms, corrupted implicits
 * and veiled (unveiled) mods.
 *
 * Compact shape. Mod files (jewel, charm, corrupted, veiled) are arrays of
 *   { id, type?, affix?, level, group, text[], statOrder[], trade{hash:[text]}, ranges[[lo,hi]], tags[], weights{key:val} }
 * mod-runes.json is an array of one entry per (item name, slot):
 *   { name, slot, type, limit?, limitId?, local, levelReq, text[], statOrder[], trade{}, ranges[], bonded?{text[],statOrder[],ranges[]}, socketBound? }
 * PoB2 carries no string stat ids here; the tradeHashes keys are the stable ids.
 *
 * Re-run after PoB2 or the game data moves: npx tsx scripts/sync-pob-jewel-rune-charm.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/dev/src/Data/';

// ---- minimal Lua table-literal parser -------------------------------------
type LuaTable = { named: Record<string, LuaValue>; list: LuaValue[] };
type LuaValue = string | number | boolean | null | LuaTable;

export function parseLua(src: string): LuaValue {
  let i = 0;
  const ws = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src.startsWith('--', i)) {
        while (i < src.length && src[i] !== '\n') i++;
      } else return;
    }
  };
  const str = (): string => {
    const q = src[i++];
    let out = '';
    while (src[i] !== q) {
      if (src[i] === '\\') {
        const n = src[i + 1];
        out += n === 'n' ? '\n' : n === 't' ? '\t' : n;
        i += 2;
      } else out += src[i++];
    }
    i++;
    return out;
  };
  const value = (): LuaValue => {
    ws();
    const c = src[i];
    if (c === '"' || c === "'") return str();
    if (c === '{') return table();
    const m = /^(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|true|false|nil)/.exec(src.slice(i, i + 40));
    if (!m) throw new Error(`bad Lua value at ${i}: ${src.slice(i, i + 40)}`);
    i += m[0].length;
    return m[0] === 'true' ? true : m[0] === 'false' ? false : m[0] === 'nil' ? null : Number(m[0]);
  };
  const table = (): LuaTable => {
    i++; // {
    const t: LuaTable = { named: {}, list: [] };
    for (;;) {
      ws();
      if (src[i] === '}') {
        i++;
        return t;
      }
      if (src[i] === ',' || src[i] === ';') {
        i++;
        continue;
      }
      if (src[i] === '[') {
        i++;
        ws();
        const k = src[i] === '"' || src[i] === "'" ? str() : String(value());
        ws();
        i++; // ]
        ws();
        i++; // =
        t.named[k] = value();
        continue;
      }
      const id = /^([A-Za-z_]\w*)\s*=(?!=)/.exec(src.slice(i, i + 80));
      if (id) {
        i += id[0].length;
        t.named[id[1]] = value();
        continue;
      }
      t.list.push(value());
    }
  };
  ws();
  if (!src.startsWith('return', i)) throw new Error('expected `return`');
  i += 6;
  return value();
}

// ---- shaping ---------------------------------------------------------------
const asTable = (v: LuaValue | undefined): LuaTable | undefined => (v && typeof v === 'object' ? v : undefined);
const strs = (t: LuaTable | undefined): string[] => (t ? t.list.filter((x): x is string => typeof x === 'string') : []);
const nums = (v: LuaValue | undefined): number[] =>
  asTable(v)?.list.filter((x): x is number => typeof x === 'number') ?? [];

/** "(5-10)% increased X" -> [[5,10]] across all lines, in order. */
export function rangesOf(lines: string[]): [number, number][] {
  const out: [number, number][] = [];
  for (const line of lines) {
    for (const m of line.matchAll(/\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)/g)) out.push([Number(m[1]), Number(m[2])]);
  }
  return out;
}

function trade(v: LuaValue | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [h, t] of Object.entries(asTable(v)?.named ?? {})) out[h] = strs(asTable(t));
  return out;
}

function shapeMod(id: string, t: LuaTable) {
  const n = t.named;
  const text = strs(t);
  const keys = strs(asTable(n.weightKey));
  const vals = nums(n.weightVal);
  const weights: Record<string, number> = {};
  keys.forEach((k, ix) => {
    weights[k] = vals[ix] ?? 0;
  });
  const o: Record<string, unknown> = { id };
  if (typeof n.type === 'string') o.type = n.type;
  if (typeof n.affix === 'string' && n.affix) o.affix = n.affix;
  if (typeof n.level === 'number') o.level = n.level;
  if (typeof n.group === 'string') o.group = n.group;
  o.text = text;
  o.statOrder = nums(n.statOrder);
  o.trade = trade(n.tradeHashes);
  o.ranges = rangesOf(text);
  const tags = strs(asTable(n.modTags));
  if (tags.length) o.tags = tags;
  if (keys.length) o.weights = weights;
  return o;
}

function shapeRunes(root: LuaTable) {
  const out: Record<string, unknown>[] = [];
  for (const [name, slots] of Object.entries(root.named)) {
    for (const [slot, e] of Object.entries(asTable(slots)?.named ?? {})) {
      const t = asTable(e);
      if (!t) continue;
      const n = t.named;
      const text = strs(t);
      const o: Record<string, unknown> = { name, slot, type: n.type };
      if (typeof n.limit === 'number') o.limit = n.limit;
      if (typeof n.limitId === 'string') o.limitId = n.limitId;
      o.local = n.localMod === true;
      o.levelReq = n.levelReq ?? 0;
      o.text = text;
      o.statOrder = nums(n.statOrder);
      o.trade = trade(n.tradeHashes);
      o.ranges = rangesOf(text);
      const b = asTable(n.bonded);
      if (b) {
        const bt = strs(b);
        o.bonded = { text: bt, statOrder: nums(b.named.statOrder), ranges: rangesOf(bt) };
      }
      if (n.isSocketBound === true) o.socketBound = true;
      out.push(o);
    }
  }
  return out;
}

const dir = path.join(process.cwd(), 'src', 'lib', 'pob', 'data');
mkdirSync(dir, { recursive: true });

const files: [string, string][] = [
  ['ModJewel', 'mod-jewel'],
  ['ModRunes', 'mod-runes'],
  ['ModCharm', 'mod-charm'],
  ['ModCorrupted', 'mod-corrupted'],
  ['ModVeiled', 'mod-veiled'],
];
const allText: Record<string, string[]> = {};
for (const [src, out] of files) {
  const url = `${BASE}${src}.lua`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  const root = parseLua(await res.text()) as LuaTable;
  const rows =
    src === 'ModRunes'
      ? shapeRunes(root)
      : Object.entries(root.named).map(([id, t]) => shapeMod(id, asTable(t) as LuaTable));
  const file = path.join(dir, `${out}.json`);
  writeFileSync(file, JSON.stringify(rows));
  allText[src] = rows.flatMap((r) => [
    ...((r.text as string[]) ?? []),
    ...(((r.bonded as { text: string[] } | undefined)?.text) ?? []),
  ]);
  console.log(`${rows.length} entries -> ${file}`);
}

// Known import gaps: where do these lines live?
const gaps = [/increased Effect of Prefixes/i, /Charm Slots?\b/i, /Socketed Augment/i, /to Level of all Spell Skills/i];
for (const g of gaps) {
  for (const [src, lines] of Object.entries(allText)) {
    const hits = lines.filter((l) => g.test(l));
    if (hits.length) console.log(`gap ${g}: ${src} x${hits.length} e.g. ${hits[0]}`);
  }
}
