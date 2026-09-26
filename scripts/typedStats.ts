// scripts/typedStats.ts
// =============================================================================
// Decoded GGPK rows -> the typed (stat, value) data the Slice 5 defence engine
// reads (plans/2026-09-25-slice5-defence-engine.md). Pure; scripts/sync-stats.ts
// does the I/O.
//
// Every stat is a `Stats.Id` — the same vocabulary our mod files' `rolls[].stat`
// already use — so the tree, implicits and affixes sum in one namespace, with
// no display text parsed. Anything that does not resolve throws, naming the
// row: silently dropping a stat would make a Life total quietly wrong.
// =============================================================================

type StatRow = { _index: number; Id: string };

type PassiveRow = {
  PassiveSkillGraphId: number;
  Stats: number[] | null;
  Stat1Value: number;
  Stat2Value: number;
  Stat3Value: number;
  Stat4Value: number;
  Stat5Value: number;
  Stat6Value: number;
  Stat7Value: number;
};

type ModRow = { _index: number; Id: string } & Record<string, unknown>;
type BaseRow = { _index: number; Name: string; Implicit_Mods: number[] | null };

/** `[statId, value]` */
export type NodeStat = [string, number];
/** `[statId, min, max]` */
export type RolledStat = [string, number, number];

// PoE2's schema (dat-schema poe2/_Core.gql, PassiveSkills) declares Stat1-5Value
// together and Stat6Value/Stat7Value at the END of the struct; node 51546
// "Way of the Mountain" carries 7 stats.
const VALUE_SLOTS = ['Stat1Value', 'Stat2Value', 'Stat3Value', 'Stat4Value', 'Stat5Value', 'Stat6Value', 'Stat7Value'] as const;
const MOD_STAT_SLOTS = 6;

function statIds(stats: StatRow[]): Map<number, string> {
  return new Map(stats.map((s) => [s._index, s.Id]));
}

/**
 * Each tree node's typed stats, keyed by our node id (= PassiveSkillGraphId,
 * verified: every one of the 0.5.2 tree's 5,150 nodes joins). Only nodes in
 * `treeNodeIds` are kept; the first row wins when two share an id.
 */
export function buildNodeStats(passives: PassiveRow[], stats: StatRow[], treeNodeIds: number[]): Record<string, NodeStat[]> {
  const ids = statIds(stats);
  const wanted = new Set(treeNodeIds);
  const out: Record<string, NodeStat[]> = {};
  for (const row of passives) {
    const id = row.PassiveSkillGraphId;
    if (!wanted.has(id) || Object.hasOwn(out, String(id))) continue;
    const list = row.Stats ?? [];
    if (list.length > VALUE_SLOTS.length) throw new Error(`PassiveSkills node ${id} has ${list.length} stats but only ${VALUE_SLOTS.length} value slots`);
    out[String(id)] = list.map((statIndex, i) => {
      const stat = ids.get(statIndex);
      if (stat === undefined) throw new Error(`PassiveSkills node ${id}: stat index ${statIndex} is not in the Stats table`);
      return [stat, row[VALUE_SLOTS[i]]];
    });
  }
  return out;
}

/**
 * Each base's implicit mods as typed rolls, keyed by base NAME (how stored
 * gear identifies a base). One entry per implicit mod, in order — a mod with
 * no stat (e.g. one that only grants a skill) is an empty entry, so entry i
 * always means implicit mod i. First base wins on a name clash, the same
 * convention as sync-wiki.ts's joinImplicitModsByName.
 */
export function buildImplicitStats(bases: BaseRow[], mods: ModRow[], stats: StatRow[]): Record<string, RolledStat[][]> {
  const ids = statIds(stats);
  const modByIndex = new Map(mods.map((m) => [m._index, m]));
  const out: Record<string, RolledStat[][]> = {};
  for (const base of bases) {
    const implicits = base.Implicit_Mods ?? [];
    if (implicits.length === 0 || Object.hasOwn(out, base.Name)) continue;
    out[base.Name] = implicits.map((modIndex) => {
      const mod = modByIndex.get(modIndex);
      if (!mod) throw new Error(`BaseItemTypes ${base.Name}: implicit mod index ${modIndex} is not in the Mods table`);
      const rolls: RolledStat[] = [];
      for (let slot = 1; slot <= MOD_STAT_SLOTS; slot++) {
        const statIndex = mod[`Stat${slot}`];
        if (typeof statIndex !== 'number') continue;
        const stat = ids.get(statIndex);
        if (stat === undefined) throw new Error(`BaseItemTypes ${base.Name}: mod ${mod.Id} stat index ${statIndex} is not in the Stats table`);
        const value = mod[`Stat${slot}Value`];
        const [min, max] = Array.isArray(value) ? (value as number[]) : [0, 0];
        rolls.push([stat, min, max]);
      }
      return rolls;
    });
  }
  return out;
}

// ---- Uniques (from our own wiki data, no GGPK) --------------------------------
//
// A unique's lines are display text (`uniqueMods.explicitMods`), and our
// typed `Unique` mods do not cover them (14 of 2,068 lines match, 2026-09-25).
// But a unique line is usually worded exactly like an ordinary item mod, so it
// is matched by WORDING — numbers and ranges ignored — against single-line
// Item/Flask mods, whose rolls give the stat ids. Measured 2026-09-25: 641 of
// 1,048 defence-related unique lines match one stat set; 106 more are only
// ambiguous between a local_ and a global id, settled by where the item is
// worn (armour pieces and weapons carry local stats; jewellery does not —
// the same rule the defence stat table verified on affixes). The rest are null.

type WikiModLike = { stats?: string[]; rolls?: { stat: string }[]; domain?: string };
type WikiUniqueLike = { name: string; category: string; rarity: string; uniqueMods?: { baseType?: string; explicitMods?: string[] } | null };

/** Categories whose unique's local_ stats apply to the item itself. */
const LOCAL_CATEGORIES = new Set([
  'Helmet', 'Body Armour', 'Gloves', 'Boots', 'Shield', 'Buckler', 'Focus', 'Focii',
  'One Hand Sword', 'Two Hand Sword', 'One Hand Axe', 'Two Hand Axe', 'One Hand Mace', 'Two Hand Mace', 'Mace',
  'Bow', 'Crossbow', 'Claw', 'Dagger', 'Flail', 'Spear', 'Sceptre', 'Wand', 'Staff', 'Warstaff', 'Talisman',
]);

const wording = (line: string) => line.replace(/\(-?\d+(\.\d+)?--?\d+(\.\d+)?\)/g, '#').replace(/-?\d+(\.\d+)?/g, '#');

export interface UniqueStats {
  baseType: string;
  /** Per explicit line: its stat ids in roll order, or null when no item mod words it the same way. */
  lines: (string[] | null)[];
}

export function buildUniqueStats(items: WikiUniqueLike[], mods: WikiModLike[]): Record<string, UniqueStats> {
  const byWording = new Map<string, string[][]>();
  for (const m of mods) {
    if ((m.domain !== 'Item' && m.domain !== 'Flask') || (m.stats ?? []).length !== 1 || (m.rolls ?? []).length === 0) continue;
    const key = wording(m.stats![0]);
    const ids = m.rolls!.map((r) => r.stat);
    const known = byWording.get(key) ?? [];
    if (!known.some((k) => k.join('+') === ids.join('+'))) known.push(ids);
    byWording.set(key, known);
  }

  const out: Record<string, UniqueStats> = {};
  for (const item of items) {
    if (item.rarity !== 'unique' || !item.uniqueMods || Object.hasOwn(out, item.name)) continue;
    const local = LOCAL_CATEGORIES.has(item.category);
    out[item.name] = {
      baseType: (item.uniqueMods.baseType ?? '').replace(/^\{[^}]*\}/, ''),
      lines: (item.uniqueMods.explicitMods ?? []).map((line) => {
        const candidates = byWording.get(wording(line)) ?? [];
        if (candidates.length === 1) return candidates[0];
        const bySide = candidates.filter((ids) => ids.every((id) => id.startsWith('local_') === local));
        return bySide.length === 1 ? bySide[0] : null;
      }),
    };
  }
  return out;
}
