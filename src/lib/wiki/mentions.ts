import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { WIKI_DATA_VERSION } from './types';
import type { WikiEntryKind, WikiSearchEntry } from './types';

/** A single concrete entry — links straight to its detail page. */
export interface MentionEntryTarget {
  kind: WikiEntryKind;
  slug: string;
}

/**
 * A tiered-item family with no bare/untiered entry of its own (e.g.
 * "Jeweller's Orb" — only Lesser/Greater/Perfect/Tainted exist, so there's
 * no single correct detail page to send a generic mention to). Links to a
 * pre-filled search on the kind's browse page instead of guessing a tier.
 */
export interface MentionSearchTarget {
  kind: WikiEntryKind;
  query: string;
}

export type MentionTarget = MentionEntryTarget | MentionSearchTarget;

export interface MentionIndex {
  targets: Map<string, MentionTarget>;
  /** Single capturing group wrapping the whole alternation, so `text.split(pattern)` returns alternating [text, match, text, match, ...] — same convention as `ConsoleButtonBadge.tsx`'s `CLICK_PHRASE_RE`. */
  pattern: RegExp;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Recognized tier-adjective prefixes for stackable currency (Lesser/Greater/
 * Perfect Jeweller's Orb, Lesser/Greater Eldritch Ember, ...) and the
 * "(Tier N)" suffix used by Waystones and Shaper's/Maven's Orbs. Returns the
 * stripped base name, or `null` when `name` carries neither shape (nothing
 * to strip — most names).
 */
const TIER_PREFIXES = ['Lesser', 'Greater', 'Perfect', 'Superior', 'Tainted'];

function familyBaseName(name: string): string | null {
  const suffixStripped = name.replace(/\s+\(Tier \d+\)$/, '');
  if (suffixStripped !== name) return suffixStripped;

  const words = name.split(' ');
  if (words.length > 1 && TIER_PREFIXES.includes(words[0])) {
    return words.slice(1).join(' ');
  }
  return null;
}

/**
 * Builds the name -> target lookup and matching regex from already-loaded
 * search index entries. `entryGroups` order sets collision priority: earlier
 * groups win a shared name (pass skills before items before mods — a skill
 * gem's own drop-item entry shares its name, e.g. "Ice Nova", and the skill
 * page is the more useful landing spot).
 *
 * A name is only included when it's 2+ words, for every kind. Verified
 * against a live decode: single-word names collide constantly with the
 * game's own status-effect/mechanic vocabulary in unrelated prose - not
 * just mods (the mod "Vaal" against flavour text's "Atziri, Queen of the
 * Vaal", the mod "Bleeding" against "Bleeding you inflict deals Damage
 * faster") but skills and items too, since a skill/support gem is very
 * often named directly after the ailment/mechanic it applies - e.g. the
 * support gem "Maim" linked from a mod's "chance to Maim on Hit" line,
 * which is naming the ailment, not that specific gem (real user report:
 * every single-word skill/item mention checked was this same wrong-link
 * shape). 190/1,118 skill names and 341/4,975 item names are single words -
 * this isn't a small edge case for either kind. Measured 2,055 false-
 * positive-shaped matches across real prose fields for mods alone with no
 * guard; skills/items share the exact same failure mode, just previously
 * un-measured.
 *
 * After the exact-name pass, a second pass looks for tiered-item families
 * with no bare entry of their own (see {@link familyBaseName}) and, when
 * 2+ concrete entries share a base and no real entry already owns that
 * exact name, registers the base as a {@link MentionSearchTarget}. Exempt
 * from the 2+-word rule above — these are manufactured PoE proper nouns
 * ("Waystone"), not overloaded ailment/mechanic vocabulary, so the
 * single-word collision risk that guard exists for doesn't apply here.
 */
export function buildMentionIndex(entryGroups: WikiSearchEntry[][]): MentionIndex {
  const targets = new Map<string, MentionTarget>();
  for (const entries of entryGroups) {
    for (const e of entries) {
      if (!e.name.includes(' ')) continue;
      if (!targets.has(e.name)) targets.set(e.name, { kind: e.kind, slug: e.slug });
    }
  }

  const familyCounts = new Map<string, { kind: WikiEntryKind; count: number }>();
  for (const entries of entryGroups) {
    for (const e of entries) {
      const base = familyBaseName(e.name);
      if (!base || targets.has(base)) continue;
      const existing = familyCounts.get(base);
      if (existing) existing.count += 1;
      else familyCounts.set(base, { kind: e.kind, count: 1 });
    }
  }
  for (const [base, { kind, count }] of familyCounts) {
    if (count >= 2 && !targets.has(base)) targets.set(base, { kind, query: base });
  }

  // Longest name first so "Scroll of Wisdom" wins over a hypothetical shorter
  // overlapping "Scroll" entry rather than the alternation matching whichever
  // happens to come first.
  const names = [...targets.keys()].sort((a, b) => b.length - a.length);
  // `s?` inside the capturing group (not appended after it) so a plural
  // mention ("Jeweller's Orbs") is captured whole, including the trailing s
  // - String.prototype.split only keeps captured text in its output, so an
  // `s?` outside the group would silently eat that letter from the
  // surrounding prose. resolveMentionTarget below strips it back off before
  // the targets lookup, since `targets` is keyed by the singular name only.
  const pattern = names.length > 0
    ? new RegExp(`\\b((?:${names.map(escapeRegExp).join('|')})s?)\\b`, 'g')
    : /(?!)/g;
  return { targets, pattern };
}

/**
 * Resolves matched text from {@link MentionIndex.pattern} to its target,
 * falling back to the singular form when `matchedText` is the exact name
 * plus a trailing plural "s" the pattern permits but `targets` isn't keyed
 * by. Returns `undefined` for a `pattern` match that isn't a real target -
 * `split` also returns the fixed, un-captured text between matches, which
 * has no entry either.
 */
export function resolveMentionTarget(matchedText: string, index: MentionIndex): MentionTarget | undefined {
  const exact = index.targets.get(matchedText);
  if (exact) return exact;
  if (!matchedText.endsWith('s')) return undefined;
  return index.targets.get(matchedText.slice(0, -1));
}

async function readSearchIndex(kind: WikiEntryKind): Promise<WikiSearchEntry[]> {
  const root = path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION);
  const raw = await readFile(path.join(root, `${kind}-index.json`), 'utf8');
  return (JSON.parse(raw) as { entries: WikiSearchEntry[] }).entries;
}

let cached: Promise<MentionIndex> | null = null;

/**
 * Loads and caches the cross-page mention index for the server process's
 * lifetime - the underlying index files only change on a redeploy (a new
 * sync), which restarts the process anyway, so there's no staleness window
 * worth guarding against here.
 */
export function loadMentionIndex(): Promise<MentionIndex> {
  cached ??= Promise
    .all([readSearchIndex('skill'), readSearchIndex('item'), readSearchIndex('mod'), readSearchIndex('effect')])
    .then(([skills, items, mods, effects]) => buildMentionIndex([skills, items, mods, effects]));
  return cached;
}
