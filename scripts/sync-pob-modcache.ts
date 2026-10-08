/**
 * Writes src/lib/pob/data/modcache.json (+ modcache.meta.json): Path of Building 2's
 * own mod-line cache (Data/ModCache.lua, MIT) trimmed to defence + attribute mods.
 * PoB parses item text ("+25 to maximum Life") into modifiers with a hand-written
 * parser and caches the result; the cache is the key for turning item/unique/jewel
 * text into stat contributions without writing a parser of our own.
 *
 * LUA TABLE SHAPE FOUND (one entry per line, inside a few `(function() ... end)();`
 * chunks that all fill `local c = {}`; file ends `return c`):
 *
 *   c["<line text>"]={ <mods|nil>, <leftover|nil> }
 *
 *   - element 1: nil (line unparsed) or an array of mod tables
 *       {flags=0, keywordFlags=0, name="Life", type="BASE", value=25}
 *       type: BASE | INC | MORE | FLAG | LIST | OVERRIDE ...
 *       value: number, string, boolean or a nested table (LIST / FLAG mods)
 *       numbered keys [1]=.. [2]=.. on a mod are its tags, e.g.
 *       {type="Multiplier", var="BlueSupportGems", div=3} (per-X scaling) or
 *       {type="MultiplierThreshold", var=..., threshold=..} / {type="Condition", var=..}
 *     An empty `{}` means "recognised, contributes nothing".
 *   - element 2: nil (whole line consumed) or the leftover text PoB could not parse.
 *
 * Output: { [line]: { mods: [{name,type,value,flags?,kw?,tagType?,tagVar?,tagDiv?,tagThreshold?}], rest? } }
 * Only entries with at least one mod whose name matches KEEP are written; mods that
 * do not match are dropped from kept entries too. `rest` marks partly-parsed lines.
 * modcache.meta.json carries the totals of everything dropped.
 *
 * Re-run after PoB2 moves: npx tsx scripts/sync-pob-modcache.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const URL = 'https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/dev/src/Data/ModCache.lua';

// Defence + attributes + spirit. Resist names in PoB: FireResist, FireResistMax, ElementalResist...
// The derived defence stats (engine.ts: movement speed, charges, regen, ES recharge, deflection, ward, blind, flat
// physical reduction, armour applying to elemental damage) are kept too, so a quest reward or unique line that PoB
// parses into them is readable (lineMods.ts POOLS says which of these the engine models).
export const KEEP =
  /^(Life|Mana|EnergyShield|Armour|Evasion|Spirit|Str|Dex|Int|Deflection|Ward|AllAttributes|(Fire|Cold|Lightning|Chaos|Elemental)Resist(Max)?|(Fire|Cold|Lightning|Chaos|Elemental)?MaxResist|MaxElementalResist|MovementSpeed|LifeRegen|LifeRegenPercent|EnergyShieldRecharge|EnergyShieldRechargeFaster|(Power|Frenzy|Endurance)ChargesMax|DeflectionRating|EvasionGainAsDeflection|ArmourGainAsDeflection|DeflectEffect|BlindEffect|PhysicalDamageReduction|ArmourDefense|ArmourAppliesTo(Physical|Fire|Cold|Lightning|Chaos)DamageTaken|SurroundedMinimum|SurroundedArea)$/;

type Lua = null | boolean | number | string | Lua[] | { [k: string]: Lua };

/** Minimal Lua table-constructor parser: enough for ModCache values. */
export function parseLuaValue(src: string, start: number): [Lua, number] {
  let i = start;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const str = (): string => {
    const q = src[i++];
    let out = '';
    while (src[i] !== q) {
      if (src[i] === '\\') {
        const n = src[++i];
        out += n === 'n' ? '\n' : n === 't' ? '\t' : n;
        i++;
      } else out += src[i++];
    }
    i++;
    return out;
  };
  const val = (): Lua => {
    ws();
    const ch = src[i];
    if (ch === '{') {
      i++;
      const arr: Lua[] = [];
      const obj: { [k: string]: Lua } = {};
      let isObj = false;
      let next = 1;
      for (;;) {
        ws();
        if (src[i] === '}') { i++; break; }
        let key: string | number | null = null;
        if (src[i] === '[') {
          i++; ws();
          key = src[i] === '"' || src[i] === "'" ? str() : (() => { const m = /^-?\d+(\.\d+)?/.exec(src.slice(i))!; i += m[0].length; return Number(m[0]); })();
          ws(); i++; // ]
          ws(); i++; // =
        } else {
          const m = /^([A-Za-z_]\w*)\s*=(?!=)/.exec(src.slice(i, i + 80));
          if (m) { key = m[1]; i += m[0].length; }
        }
        const v = val();
        if (key === null) { arr[next++ - 1] = v; if (isObj) obj[String(next - 1)] = v; }
        else if (typeof key === 'number') { arr[key - 1] = v; obj[String(key)] = v; isObj = true; }
        else { obj[key] = v; isObj = true; }
        ws();
        if (src[i] === ',' || src[i] === ';') i++;
      }
      if (!isObj) return arr;
      for (let k = 0; k < arr.length; k++) if (arr[k] !== undefined) obj[String(k + 1)] = arr[k];
      return obj;
    }
    if (ch === '"' || ch === "'") return str();
    const m = /^(nil|true|false|-?math\.huge|-?\d+(\.\d+)?([eE][-+]?\d+)?)/.exec(src.slice(i, i + 40));
    if (!m) throw new Error(`bad Lua token at ${i}: ${src.slice(i, i + 40)}`);
    i += m[0].length;
    // JSON cannot hold Infinity; math.huge ("no limit") becomes a 1e9 sentinel.
    if (m[1].endsWith('math.huge')) return m[1].startsWith('-') ? -1e9 : 1e9;
    return m[1] === 'nil' ? null : m[1] === 'true' ? true : m[1] === 'false' ? false : Number(m[1]);
  };
  const v = val();
  return [v, i];
}

export interface OutMod {
  name: string;
  type: string;
  value: Lua;
  flags?: number;
  kw?: number;
  tagType?: string;
  tagVar?: string;
  tagDiv?: number;
  tagThreshold?: number;
}
export interface OutEntry { mods: OutMod[]; rest?: string }

export function convert(lua: string) {
  const out: Record<string, OutEntry> = {};
  const dropped = { entries: 0, unparsed: 0, noRelevantMod: 0, modsNotKept: 0, totalEntries: 0 };
  for (const raw of lua.split('\n')) {
    if (!raw.startsWith('c["')) continue;
    dropped.totalEntries++;
    const [line, end] = parseLuaValue(raw, 2); // after `c[`; parses the string key
    const eq = raw.indexOf('=', end);
    const [val] = parseLuaValue(raw, eq + 1);
    const [mods, rest] = val as [Lua, Lua];
    if (!Array.isArray(mods) && !(mods && typeof mods === 'object')) { dropped.unparsed++; dropped.entries++; continue; }
    const list = (Array.isArray(mods) ? mods : Object.keys(mods).filter((k) => /^\d+$/.test(k)).map((k) => (mods as Record<string, Lua>)[k])) as Record<string, Lua>[];
    const kept: OutMod[] = [];
    for (const m of list) {
      if (typeof m.name !== 'string' || !KEEP.test(m.name)) { dropped.modsNotKept++; continue; }
      const o: OutMod = { name: m.name, type: String(m.type), value: m.value as Lua };
      if (m.flags) o.flags = m.flags as number;
      if (m.keywordFlags) o.kw = m.keywordFlags as number;
      const tag = m['1'] as Record<string, Lua> | undefined;
      if (tag && typeof tag === 'object') {
        if (typeof tag.type === 'string') o.tagType = tag.type;
        if (typeof tag.var === 'string') o.tagVar = tag.var;
        if (typeof tag.div === 'number') o.tagDiv = tag.div;
        if (typeof tag.threshold === 'number') o.tagThreshold = tag.threshold;
      }
      kept.push(o);
    }
    if (!kept.length) { dropped.noRelevantMod++; dropped.entries++; continue; }
    // mods dropped inside kept entries were counted above only for kept entries; fix tally below
    const e: OutEntry = { mods: kept };
    if (typeof rest === 'string' && rest.trim()) e.rest = rest.trim();
    out[line as string] = e;
  }
  return { out, dropped };
}

async function main() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`${URL} answered ${res.status}`);
  const { out, dropped } = convert(await res.text());
  const dir = path.join(process.cwd(), 'src', 'lib', 'pob', 'data');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'modcache.json'), JSON.stringify(out));
  const meta = { source: URL, keptEntries: Object.keys(out).length, ...dropped };
  writeFileSync(path.join(dir, 'modcache.meta.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log(meta);
}

if (process.argv[1]?.includes('sync-pob-modcache')) await main();
