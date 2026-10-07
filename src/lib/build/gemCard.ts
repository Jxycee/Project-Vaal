// Pure builder for the reader's gem card: what a skill gem and each of its
// supports DO, from the wiki's per-gem JSON (public/data/wiki/<v>/skills/*.json).
// No React and no fetch. Every raw field is untrusted: a missing or malformed
// file degrades that part of the card (a support keeps its name, loses its
// text), it never throws and never prints "undefined".
import type { GearItem } from './gearSlots';
import type { GemLoadout } from './gemState';

export type GemColor = 'r' | 'g' | 'b' | 'w';

export interface GemCardSupport {
  slug: string;
  name: string;
  iconUrl: string | null;
  /** One short paragraph, or null when the wiki file is missing or has none. */
  description: string | null;
  /** Stat lines the support grants (cleaned), empty when unknown. */
  stats: string[];
}

export interface GemCard {
  name: string;
  /** Null for an empty group. */
  slug: string | null;
  color: GemColor;
  level: number;
  quality: number;
  tags: string[];
  description: string | null;
  /** e.g. "Cost 40", "Reserves 30 Spirit", in one line; empty when the wiki has no figure. */
  figures: string[];
  /** Stat lines at the build's gem level (cleaned). */
  stats: string[];
  /** The wiki's quality bonuses, stated at full (20%) quality. */
  qualityStats: string[];
  supports: GemCardSupport[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter((s): s is string => s !== null) : []);

/**
 * The wiki marks a headline figure as "Label@80%". Show it as "Label: 80%".
 * Anything else passes through; a stray "@" is dropped rather than shown raw.
 */
export function cleanStatText(text: string): string {
  const at = /^(.*?)@(.+)$/.exec(text);
  if (at) return `${at[1].trim()}: ${at[2].trim()}`;
  return text.replace(/@/g, '').trim();
}

function statLines(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((s) => (isObject(s) ? str(s.text) : null))
    .filter((s): s is string => s !== null)
    .map(cleanStatText);
}

/** The scaling entry for `level`: exact, else the nearest lower, else the first. Null when there is none. */
export function scalingAt(raw: unknown, level: number): Record<string, unknown> | null {
  const entries = (isObject(raw) && Array.isArray(raw.scaling) ? raw.scaling : []).filter(
    (e): e is Record<string, unknown> => isObject(e) && isNum(e.level),
  );
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => (a.level as number) - (b.level as number));
  let pick = sorted[0];
  for (const e of sorted) if ((e.level as number) <= level) pick = e;
  return pick;
}

const COLOR: Record<string, GemColor> = { r: 'r', g: 'g', b: 'b' };

export function buildGemCard(loadout: GemLoadout, raws: { skill: unknown; supports: Map<string, unknown> }): GemCard {
  const skillRaw = isObject(raws.skill) ? raws.skill : {};
  const at = scalingAt(skillRaw, loadout.level);
  const figures: string[] = [];
  if (at) {
    if (isNum(at.cost)) figures.push(`Cost ${at.cost}`);
    if (isNum(at.reservation)) figures.push(`Reserves ${at.reservation} Spirit`);
    if (isNum(at.cooldown)) figures.push(`Cooldown ${at.cooldown}s`);
  }
  return {
    name: loadout.skill?.name ?? 'Empty group',
    slug: loadout.skill?.slug ?? null,
    color: COLOR[String(skillRaw.color)] ?? 'w',
    level: loadout.level,
    quality: loadout.quality,
    tags: strings(skillRaw.tags),
    description: str(skillRaw.description),
    figures,
    stats: at ? statLines(at.stats) : [],
    qualityStats: statLines(skillRaw.qualityStats),
    supports: loadout.supports.map((s: GearItem) => {
      const raw = raws.supports.get(s.slug);
      const r = isObject(raw) ? raw : {};
      const sat = scalingAt(r, 1);
      return {
        slug: s.slug,
        name: s.name,
        iconUrl: s.iconUrl ?? null,
        description: str(r.description),
        stats: sat ? statLines(sat.stats) : [],
      };
    }),
  };
}
