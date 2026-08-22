import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { WIKI_DATA_VERSION } from './types';
import type { WikiEntryKind, WikiSearchEntry } from './types';

export interface MentionTarget {
  kind: WikiEntryKind;
  slug: string;
}

export interface MentionIndex {
  targets: Map<string, MentionTarget>;
  /** Single capturing group wrapping the whole alternation, so `text.split(pattern)` returns alternating [text, match, text, match, ...] — same convention as `ConsoleButtonBadge.tsx`'s `CLICK_PHRASE_RE`. */
  pattern: RegExp;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
 */
export function buildMentionIndex(entryGroups: WikiSearchEntry[][]): MentionIndex {
  const targets = new Map<string, MentionTarget>();
  for (const entries of entryGroups) {
    for (const e of entries) {
      if (!e.name.includes(' ')) continue;
      if (!targets.has(e.name)) targets.set(e.name, { kind: e.kind, slug: e.slug });
    }
  }
  // Longest name first so "Scroll of Wisdom" wins over a hypothetical shorter
  // overlapping "Scroll" entry rather than the alternation matching whichever
  // happens to come first.
  const names = [...targets.keys()].sort((a, b) => b.length - a.length);
  const pattern = names.length > 0
    ? new RegExp(`\\b(${names.map(escapeRegExp).join('|')})\\b`, 'g')
    : /(?!)/g;
  return { targets, pattern };
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
