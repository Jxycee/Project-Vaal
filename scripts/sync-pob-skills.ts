/**
 * Writes src/lib/pob/data/skill-stat-map.json and src/lib/pob/data/skills.json
 * from Path of Building 2's generated Lua (MIT):
 *   - Data/SkillStatMap.lua  : GGG stat id -> PoB modifier calls (mod/flag/skill)
 *   - Data/Skills/*.lua      : every skill definition (active gems, supports,
 *                              monster/other skills) with per-level numbers.
 *
 * The Lua is data-shaped (literal tables, plus mod()/flag()/skill() calls and
 * SkillType.X references), so it is read with a small real Lua-subset parser
 * rather than regexes: strings, numbers, tables, field chains, calls, `--`
 * comments. Calls and field chains become inert JSON (never executed).
 *
 * Re-run after PoB2 moves: npx tsx scripts/sync-pob-skills.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = 'https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/dev/src/Data/';
// minion.lua / spectre.lua (monster skills, ~420 KB of Lua) are left out: not
// player-buildable damage sources. other.lua holds weapon attacks and misc.
const SKILL_FILES = ['act_str', 'act_dex', 'act_int', 'sup_str', 'sup_dex', 'sup_int', 'other'];

// ---------------------------------------------------------------- Lua subset
type Tok = { k: 'str' | 'num' | 'id' | 'sym'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }
    if (c === '-' && src[i + 1] === '-') {
      // long comment --[[ ... ]] or line comment
      if (src[i + 2] === '[' && src[i + 3] === '[') {
        const e = src.indexOf(']]', i + 4);
        i = e < 0 ? n : e + 2;
      } else {
        while (i < n && src[i] !== '\n') i++;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let s = '';
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') {
          const nx = src[j + 1];
          s += nx === 'n' ? '\n' : nx === 't' ? '\t' : nx;
          j += 2;
        } else s += src[j++];
      }
      out.push({ k: 'str', v: s });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(0[xX][0-9a-fA-F]+|[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?)/.exec(src.slice(i, i + 40));
      out.push({ k: 'num', v: m![0] });
      i += m![0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ k: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '.' && src[i + 1] === '.') { out.push({ k: 'sym', v: '..' }); i += 2; continue; }
    if ((c === '=' || c === '~' || c === '<' || c === '>') && src[i + 1] === '=') {
      out.push({ k: 'sym', v: c + '=' });
      i += 2;
      continue;
    }
    out.push({ k: 'sym', v: c });
    i++;
  }
  return out;
}

type J = null | boolean | number | string | J[] | { [k: string]: J };

class Parser {
  p = 0;
  readonly t: Tok[];
  constructor(t: Tok[]) {
    this.t = t;
  }
  peek(): Tok | undefined { return this.t[this.p]; }
  isSym(v: string): boolean { const x = this.peek(); return !!x && x.k === 'sym' && x.v === v; }
  eat(v: string): void {
    if (!this.isSym(v)) throw new Error(`expected '${v}' at token ${this.p}, got ${JSON.stringify(this.peek())}`);
    this.p++;
  }

  expr(): J {
    let left = this.unary();
    for (;;) {
      const x = this.peek();
      if (!x) break;
      const isBin =
        (x.k === 'sym' && ['+', '-', '*', '/', '%', '^', '..', '==', '~=', '<', '>', '<=', '>='].includes(x.v)) ||
        (x.k === 'id' && (x.v === 'and' || x.v === 'or'));
      if (!isBin) break;
      this.p++;
      this.unary();
      left = null; // computed values never occur in the data we keep
    }
    return left;
  }

  unary(): J {
    const x = this.peek();
    if (x && x.k === 'sym' && x.v === '-') { this.p++; const v = this.unary(); return typeof v === 'number' ? -v : null; }
    if (x && x.k === 'id' && x.v === 'not') { this.p++; this.unary(); return null; }
    return this.postfix();
  }

  postfix(): J {
    let v: J;
    let name: string | null = null; // dotted identifier chain, if still one
    const x = this.peek();
    if (!x) throw new Error('unexpected end');
    if (x.k === 'num') { this.p++; v = Number(x.v); }
    else if (x.k === 'str') { this.p++; v = x.v; }
    else if (x.k === 'sym' && x.v === '{') v = this.table();
    else if (x.k === 'sym' && x.v === '(') { this.p++; v = this.expr(); this.eat(')'); }
    else if (x.k === 'id') {
      this.p++;
      if (x.v === 'true') v = true;
      else if (x.v === 'false') v = false;
      else if (x.v === 'nil') v = null;
      else if (x.v === 'function') { this.skipFunction(); v = null; }
      else { name = x.v; v = x.v; }
    } else throw new Error(`unexpected token ${JSON.stringify(x)} at ${this.p}`);
    for (;;) {
      if (this.isSym('.') && name !== null) {
        this.p++;
        const f = this.peek()!;
        this.p++;
        name += '.' + f.v;
        v = name;
      } else if (this.isSym('(')) {
        this.p++;
        const args: J[] = [];
        while (!this.isSym(')')) {
          args.push(this.expr());
          if (this.isSym(',')) this.p++;
        }
        this.eat(')');
        v = { call: name ?? '?', args };
        name = null;
      } else if (this.isSym('[') && name !== null) {
        this.p++;
        this.expr();
        this.eat(']');
        v = null;
        name = null;
      } else break;
    }
    return v;
  }

  // Called just after the `function` keyword: skips `(params) body end`.
  // Callbacks (preDamageFunc etc.) are code, not data; they become null.
  skipFunction(): void {
    let depth = 1;
    while (depth > 0) {
      const x = this.peek();
      if (!x) throw new Error('unterminated function');
      this.p++;
      if (x.k !== 'id') continue;
      if (x.v === 'function' || x.v === 'if' || x.v === 'for' || x.v === 'while') depth++;
      else if (x.v === 'end') depth--;
    }
  }

  table(): J {
    this.eat('{');
    const arr: J[] = [];
    const map: Record<string, J> = {};
    let hasMap = false;
    while (!this.isSym('}')) {
      const x = this.peek()!;
      const nx = this.t[this.p + 1];
      if (x.k === 'id' && nx && nx.k === 'sym' && nx.v === '=' ) {
        this.p += 2;
        map[x.v] = this.expr();
        hasMap = true;
      } else if (x.k === 'sym' && x.v === '[') {
        this.p++;
        const key = this.expr();
        this.eat(']');
        this.eat('=');
        map[String(key)] = this.expr();
        hasMap = true;
      } else arr.push(this.expr());
      if (this.isSym(',') || this.isSym(';')) this.p++;
    }
    this.eat('}');
    if (!hasMap) return arr;
    // all-integer keys 1..n => array
    const keys = Object.keys(map);
    if (arr.length === 0 && keys.length && keys.every((k) => /^\d+$/.test(k))) {
      const nums = keys.map(Number).sort((a, b) => a - b);
      if (nums[0] === 1 && nums.every((v, i) => v === i + 1)) return nums.map((k) => map[String(k)]);
    }
    if (arr.length) map._ = arr;
    return map;
  }
}

// ----------------------------------------------------------------- fetching
async function get(file: string): Promise<string> {
  const url = BASE + file;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
}

// ------------------------------------------------------------- stat map file
function parseStatMap(lua: string): Record<string, J> {
  const start = lua.indexOf('return {', lua.indexOf('return function'));
  if (start < 0) throw new Error('SkillStatMap.lua: table start not found');
  const body = lua.slice(start + 'return '.length);
  const parser = new Parser(tokenize(body));
  const tbl = parser.table();
  if (Array.isArray(tbl) || tbl === null || typeof tbl !== 'object') throw new Error('stat map is not a keyed table');
  return tbl as Record<string, J>;
}

// ---------------------------------------------------------------- skill file
const DROP_SKILL_KEYS = new Set(['preDamageFunc', 'flavourText', 'description', 'icon', 'statSets', 'levels', 'skillTypes', 'weaponTypes', 'qualityStats', 'altQualityStats']);

function asObj(v: J): Record<string, J> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, J>) : {};
}
function boolKeys(v: J): string[] {
  return Object.entries(asObj(v)).filter(([, x]) => x === true).map(([k]) => k.replace(/^SkillType\./, ''));
}

// Per-level rows -> columns. `c` holds fields identical on every level (stored
// once), `v` holds fields that vary (one array of n values per field).
// `cost` is flattened to `cost.<Resource>`; a stat set's positional `v` array
// is flattened to `v.0`, `v.1`, ... (order of the stat set's `stats`).
// Floats are rounded to 4 decimals (PoB's source has ~14 digits of noise).
function round(x: J): J {
  if (typeof x === 'number') return Number.isInteger(x) ? x : Math.round(x * 1e4) / 1e4;
  if (Array.isArray(x)) return x.map(round);
  return x;
}
function toColumns(rows: Record<string, J>[]): J {
  const flat = rows.map((r) => {
    const o: Record<string, J> = {};
    for (const [k, x] of Object.entries(r)) {
      if (k === 'cost') for (const [ck, cv] of Object.entries(asObj(x))) o[`cost.${ck}`] = round(cv);
      else if (k === 'v' && Array.isArray(x)) x.forEach((e, i) => { o[`v.${i}`] = round(e); });
      else o[k] = round(x);
    }
    return o;
  });
  const keys = [...new Set(flat.flatMap((r) => Object.keys(r)))];
  const c: Record<string, J> = {};
  const v: Record<string, J> = {};
  for (const k of keys) {
    const col = flat.map((r) => (k in r ? r[k] : null));
    const first = JSON.stringify(col[0]);
    if (flat.every((r) => k in r) && col.every((x) => JSON.stringify(x) === first)) c[k] = col[0];
    else v[k] = col;
  }
  const out: Record<string, J> = { n: rows.length };
  if (Object.keys(c).length) out.c = c;
  if (Object.keys(v).length) out.v = v;
  return out;
}

function shapeStatSet(ss: Record<string, J>): J {
  const out: Record<string, J> = {};
  if (ss.label !== undefined) out.label = ss.label;
  if (ss.baseEffectiveness !== undefined) out.baseEffectiveness = ss.baseEffectiveness;
  if (ss.incrementalEffectiveness !== undefined) out.incrementalEffectiveness = ss.incrementalEffectiveness;
  if (ss.damageIncrementalEffectiveness !== undefined) out.damageIncrementalEffectiveness = ss.damageIncrementalEffectiveness;
  if (ss.statDescriptionScope !== undefined) out.scope = ss.statDescriptionScope;
  if (ss.baseFlags) { const f = boolKeys(ss.baseFlags); if (f.length) out.baseFlags = f; }
  if (ss.notMinionStat) out.notMinionStat = ss.notMinionStat;
  if (Array.isArray(ss.constantStats) && ss.constantStats.length) {
    const cs: Record<string, J> = {};
    for (const e of ss.constantStats) if (Array.isArray(e)) cs[String(e[0])] = e[1] ?? null;
    out.constantStats = cs;
  }
  if (Array.isArray(ss.stats)) out.stats = ss.stats;
  // PoB-side per-stat modifier overrides (support statMap): keep the keys' raw calls.
  if (ss.statMap && Object.keys(asObj(ss.statMap)).length) out.statMap = ss.statMap;
  if (Array.isArray(ss.levels)) {
    out.levels = toColumns(ss.levels.map((row) => {
      const r = asObj(row);
      const o: Record<string, J> = {};
      if (Array.isArray(r._) && r._.length) o.v = r._; // positional values, order of `stats`
      if (r.statInterpolation) o.i = r.statInterpolation;
      if (r.actorLevel !== undefined) o.a = r.actorLevel;
      for (const [k, x] of Object.entries(r)) if (!['_', 'statInterpolation', 'actorLevel'].includes(k)) o[k] = x;
      return o;
    }));
  }
  return out;
}

function shapeSkill(s: Record<string, J>): J {
  const out: Record<string, J> = {};
  out.name = s.name ?? null;
  out.type = s.support ? 'support' : 'active';
  for (const [k, v] of Object.entries(s)) {
    if (DROP_SKILL_KEYS.has(k) || k === 'name' || k === 'support') continue;
    out[k] = v;
  }
  const st = boolKeys(s.skillTypes);
  if (st.length) out.skillTypes = st;
  const wt = boolKeys(s.weaponTypes);
  if (wt.length) out.weaponTypes = wt;
  if (Array.isArray(s.qualityStats) && s.qualityStats.length) out.qualityStats = s.qualityStats;
  if (Array.isArray(s.levels)) {
    out.levels = toColumns(s.levels.map(asObj));
  }
  out.statSets = Array.isArray(s.statSets) ? s.statSets.map((x) => shapeStatSet(asObj(x))) : [];
  return out;
}

function parseSkills(lua: string, file: string): Record<string, J> {
  const out: Record<string, J> = {};
  const re = /^skills\["([^"]+)"\] = /gm;
  let m: RegExpExecArray | null;
  const starts: { id: string; at: number }[] = [];
  while ((m = re.exec(lua))) starts.push({ id: m[1], at: m.index + m[0].length });
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? lua.lastIndexOf('skills["', starts[i + 1].at) : lua.length;
    const parser = new Parser(tokenize(lua.slice(starts[i].at, end)));
    try {
      out[starts[i].id] = shapeSkill(asObj(parser.table()));
    } catch (e) {
      throw new Error(`${file}: skill ${starts[i].id}: ${(e as Error).message}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------- main
const dir = path.join(process.cwd(), 'src', 'lib', 'pob', 'data');
mkdirSync(dir, { recursive: true });

const statMap = parseStatMap(await get('SkillStatMap.lua'));
writeFileSync(path.join(dir, 'skill-stat-map.json'), JSON.stringify(statMap));
console.log(`${Object.keys(statMap).length} stat ids -> skill-stat-map.json`);

const skills: Record<string, J> = {};
for (const f of SKILL_FILES) {
  const got = parseSkills(await get(`Skills/${f}.lua`), f);
  for (const [id, v] of Object.entries(got)) {
    if (id in skills) throw new Error(`duplicate skill id ${id} in ${f}`);
    skills[id] = v;
  }
  console.log(`${f}: ${Object.keys(got).length} skills`);
}
writeFileSync(path.join(dir, 'skills.json'), JSON.stringify(skills));
console.log(`${Object.keys(skills).length} skills -> skills.json`);
