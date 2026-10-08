/**
 * Writes src/lib/pob/data/{bases,quest-rewards,misc-constants}.json from Path of
 * Building 2's generated Data/Bases/*.lua, Data/QuestRewards.lua, Data/Misc.lua
 * and Data/Global.lua (MIT).
 *
 *  - bases.json           every item base: type, subType, socketLimit, tags, implicit
 *                         lines, the armour/weapon/flask/charm stat block, requirements
 *  - quest-rewards.json   PoB's campaign reward list (act, area, boss/NPC, stat text)
 *  - misc-constants.json  Misc.lua tables + game/character constants, plus Global.lua's
 *                         colour codes and ModFlag / KeywordFlag / SkillType enums
 *
 * Re-run after PoB2 moves: npm run sync:pob-bases
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const RAW = 'https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/dev/src/Data';
const BASE_FILES = [
  'amulet', 'axe', 'belt', 'body', 'boots', 'bow', 'claw', 'crossbow', 'dagger', 'fishing', 'flail', 'flask',
  'focus', 'gloves', 'helmet', 'incursionlimb', 'jewel', 'mace', 'quiver', 'ring', 'sceptre', 'shield', 'spear',
  'staff', 'sword', 'talisman', 'traptool', 'wand',
];

async function get(file: string): Promise<string> {
  const url = `${RAW}/${file}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
}

// ---- minimal Lua data-literal parser (tables, strings, numbers, booleans, nil) ----

type Lua = string | number | boolean | null | Lua[] | { [k: string]: Lua };

class Parser {
  constructor(private s: string, public i = 0) {}

  private ws() {
    for (;;) {
      while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
      if (this.s.startsWith('--', this.i)) {
        while (this.i < this.s.length && this.s[this.i] !== '\n') this.i++;
      } else return;
    }
  }

  value(): Lua {
    this.ws();
    const c = this.s[this.i];
    if (c === '{') return this.table();
    if (c === '"' || c === "'") return this.str();
    const m = /^(?:-?0[xX][0-9a-fA-F]+|-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|true|false|nil)/.exec(this.s.slice(this.i, this.i + 40));
    if (!m) throw new Error(`unparsable Lua value at ${this.i}: ${this.s.slice(this.i, this.i + 40)}`);
    this.i += m[0].length;
    if (m[0] === 'true') return true;
    if (m[0] === 'false') return false;
    if (m[0] === 'nil') return null;
    return Number(m[0]);
  }

  private str(): string {
    const q = this.s[this.i++];
    let out = '';
    while (this.s[this.i] !== q) {
      let ch = this.s[this.i++];
      if (ch === '\\') {
        const e = this.s[this.i++];
        ch = e === 'n' ? '\n' : e === 't' ? '\t' : e;
      }
      out += ch;
    }
    this.i++;
    return out;
  }

  table(): Lua {
    this.i++; // {
    const arr: Lua[] = [];
    const obj: { [k: string]: Lua } = {};
    for (;;) {
      this.ws();
      if (this.s[this.i] === '}') { this.i++; break; }
      let key: string | null = null;
      if (this.s[this.i] === '[') {
        this.i++;
        const k = this.value();
        this.ws();
        this.i++; // ]
        key = String(k);
      } else {
        const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/.exec(this.s.slice(this.i, this.i + 120));
        if (m) { key = m[1]; this.i += m[0].length; }
      }
      if (key !== null) {
        this.ws();
        if (this.s[this.i] === '=') this.i++;
        obj[key] = this.value();
      } else arr.push(this.value());
      this.ws();
      if (this.s[this.i] === ',' || this.s[this.i] === ';') this.i++;
    }
    return Object.keys(obj).length === 0 ? arr : arr.length === 0 ? obj : { ...obj, _: arr };
  }
}

const parseAt = (src: string, at: number): { v: Lua; end: number } => {
  const p = new Parser(src, at);
  const v = p.value();
  return { v, end: p.i };
};

// ---- bases ----

const trueKeys = (t: Lua): string[] =>
  t && typeof t === 'object' && !Array.isArray(t) ? Object.keys(t).filter((k) => (t as Record<string, Lua>)[k] === true).sort() : [];

const bases: Record<string, Record<string, Lua>> = {};
for (const f of BASE_FILES) {
  const src = await get(`Bases/${f}.lua`);
  const re = /itemBases\["((?:[^"\\]|\\.)*)"\]\s*=\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const { v, end } = parseAt(src, m.index + m[0].length - 1);
    re.lastIndex = end;
    const t = v as Record<string, Lua>;
    const out: Record<string, Lua> = { type: t.type };
    if (t.subType) out.subType = t.subType;
    if (t.socketLimit !== undefined) out.socketLimit = t.socketLimit;
    out.tags = trueKeys(t.tags);
    if (typeof t.implicit === 'string') out.implicit = t.implicit.split('\n');
    for (const k of ['armour', 'weapon', 'flask', 'charm']) if (t[k]) out[k] = t[k];
    out.req = t.req ?? {};
    // Anything else PoB keeps on a base (influence tags, hidden flags...) rides along untouched.
    for (const k of Object.keys(t)) {
      if (!(k in out) && !['quality', 'implicitModTypes', 'tags', 'implicit', 'req', 'name'].includes(k)) out[k] = t[k];
    }
    bases[m[1]] = out;
  }
}

// ---- quest rewards ----

const qsrc = await get('QuestRewards.lua');
const qr = parseAt(qsrc, qsrc.indexOf('{')).v as Array<Record<string, Lua>>;

// ---- misc + global ----

const msrc = await get('Misc.lua');
const misc: Record<string, Lua> = {};
const mre = /^data\.(\w+)\s*=\s*\{/gm;
let mm: RegExpExecArray | null;
while ((mm = mre.exec(msrc))) {
  const { v, end } = parseAt(msrc, mm.index + mm[0].length - 1);
  mre.lastIndex = end;
  misc[mm[1]] = v;
}

const gsrc = await get('Global.lua');
const hexFlags = (name: string): Record<string, string> => {
  const o: Record<string, string> = {};
  for (const m of gsrc.matchAll(new RegExp(`^${name}\\.(\\w+)\\s*=\\s*0x([0-9A-Fa-f]+)`, 'gm'))) o[m[1]] = m[2].toUpperCase().replace(/^0+(?=.)/, '');
  return o;
};
const colorStart = gsrc.indexOf('colorCodes = {');
const skillStart = gsrc.indexOf('SkillType = {');
const global = {
  colorCodes: parseAt(gsrc, gsrc.indexOf('{', colorStart)).v,
  modFlag: hexFlags('ModFlag'),
  keywordFlag: hexFlags('KeywordFlag'),
  skillType: parseAt(gsrc, gsrc.indexOf('{', skillStart)).v,
};

const dir = path.join(process.cwd(), 'src', 'lib', 'pob', 'data');
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, 'bases.json'), JSON.stringify(bases));
// The movement-speed penalty of the armour bases that carry one (3%, 4%, 5%...): the engine's movement speed
// (engine.ts) needs only this, and bases.json is too large to ship to the browser for it.
const penalties: Record<string, number> = {};
for (const [name, b] of Object.entries(bases)) {
  const armour = b.armour as { MovementPenalty?: number } | undefined;
  if (armour && typeof armour.MovementPenalty === 'number' && armour.MovementPenalty > 0) penalties[name] = armour.MovementPenalty;
}
writeFileSync(path.join(dir, 'base-movement-penalty.json'), JSON.stringify(penalties));
writeFileSync(path.join(dir, 'quest-rewards.json'), JSON.stringify(qr));
writeFileSync(path.join(dir, 'misc-constants.json'), JSON.stringify({ ...misc, global }));
console.log(`${Object.keys(bases).length} bases, ${qr.length} quest rewards, ${Object.keys(misc).length} misc tables -> ${dir}`);
