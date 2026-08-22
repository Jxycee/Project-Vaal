import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { WIKI_DATA_VERSION, isWikiSearchEntry } from './types';
import type { WikiItemDetail, WikiSkillDetail, WikiModDetail, WikiEffectDetail } from './types';

const ROOT = path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION);
const SAFE_SLUG = /^[a-z0-9-]+$/;

/**
 * Shape check at the parse boundary. The data is our own sync output, so
 * this is not defending against a hostile file - it catches a half-written
 * or wrong-version artifact, which would otherwise sail through `JSON.parse`
 * and surface as a render crash on a field that isn't there.
 *
 * Detail records share slug/name/kind/category with `WikiSearchEntry`, so
 * `isWikiSearchEntry` validates those four. It also requires `tags`, which
 * only item and skill details carry (mods have `families` instead), so the
 * probe supplies a placeholder for that one field rather than duplicating
 * the four checks here. `kind` is then matched against the kind actually
 * requested — that is what catches a file sitting in the wrong directory.
 */
function isDetailFor(kind: 'item' | 'skill' | 'mod' | 'effect', value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const probe = {
    slug: v.slug,
    name: v.name,
    kind: v.kind,
    category: v.category,
    tags: [] as string[],
  };
  return isWikiSearchEntry(probe) && v.kind === kind && typeof v.lastSynced === 'string';
}

export async function loadDetail(kind: 'item', slug: string): Promise<WikiItemDetail | null>;
export async function loadDetail(kind: 'skill', slug: string): Promise<WikiSkillDetail | null>;
export async function loadDetail(kind: 'mod', slug: string): Promise<WikiModDetail | null>;
export async function loadDetail(kind: 'effect', slug: string): Promise<WikiEffectDetail | null>;
export async function loadDetail(
  kind: 'item' | 'skill' | 'mod' | 'effect',
  slug: string,
): Promise<WikiItemDetail | WikiSkillDetail | WikiModDetail | WikiEffectDetail | null> {
  if (!SAFE_SLUG.test(slug)) return null;
  try {
    const raw = await readFile(path.join(ROOT, `${kind}s`, `${slug}.json`), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isDetailFor(kind, parsed)) return null;
    return parsed as WikiItemDetail | WikiSkillDetail | WikiModDetail | WikiEffectDetail;
  } catch {
    return null;
  }
}

/**
 * Every `generateStaticParams` currently returns `[]` — the real entity
 * counts make prebuilding all detail pages too slow, so they are ISR-only.
 * Kept rather than deleted: it is part of this module's planned interface
 * and is what a later milestone would call to prebuild a top-N subset.
 */
export async function loadAllSlugs(kind: 'item' | 'skill' | 'mod' | 'effect'): Promise<string[]> {
  try {
    const files = await readdir(path.join(ROOT, `${kind}s`));
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}
