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
 * Mod names are only included when they're 2+ words. Verified against a live
 * decode: single-word mod names collide constantly with the game's own
 * status-effect/lore vocabulary in unrelated prose - e.g. the mod "Vaal"
 * against flavour text's "Atziri, Queen of the Vaal", or the mod "Bleeding"
 * against "Bleeding you inflict deals Damage faster" (describing the
 * mechanic, not naming that mod). Measured 2,055 false-positive-shaped
 * matches across real prose fields with no such guard. Item/skill names
 * don't share this problem - they're not single common English words - and
 * are always included regardless of word count.
 */
export function buildMentionIndex(entryGroups: WikiSearchEntry[][]): MentionIndex {
  const targets = new Map<string, MentionTarget>();
  for (const entries of entryGroups) {
    for (const e of entries) {
      if (e.kind === 'mod' && !e.name.includes(' ')) continue;
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
  cached ??= Promise.all([readSearchIndex('skill'), readSearchIndex('item'), readSearchIndex('mod')])
    .then(([skills, items, mods]) => buildMentionIndex([skills, items, mods]));
  return cached;
}
