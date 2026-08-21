import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { WIKI_DATA_VERSION } from './types';
import type { WikiItemDetail, WikiSkillDetail, WikiModDetail } from './types';

const ROOT = path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION);
const SAFE_SLUG = /^[a-z0-9-]+$/;

export async function loadDetail(kind: 'item', slug: string): Promise<WikiItemDetail | null>;
export async function loadDetail(kind: 'skill', slug: string): Promise<WikiSkillDetail | null>;
export async function loadDetail(kind: 'mod', slug: string): Promise<WikiModDetail | null>;
export async function loadDetail(
  kind: 'item' | 'skill' | 'mod',
  slug: string,
): Promise<WikiItemDetail | WikiSkillDetail | WikiModDetail | null> {
  if (!SAFE_SLUG.test(slug)) return null;
  try {
    const raw = await readFile(path.join(ROOT, `${kind}s`, `${slug}.json`), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function loadAllSlugs(kind: 'item' | 'skill' | 'mod'): Promise<string[]> {
  try {
    const files = await readdir(path.join(ROOT, `${kind}s`));
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}
