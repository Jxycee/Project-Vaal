// src/lib/builds/discovery.ts
// =============================================================================
// Build discovery foundations — a typed filter, sort and page spec, and the
// pure function that applies one to a Supabase query over `public.builds`.
// No React, no fetch, no Supabase import: the query is reached through the
// structural `DiscoveryQuery` interface, so a recording fake can test it.
//
// FAILURE MODES (written before the code; discovery.test.ts pins each):
//
//  1. Injection via the text query. PostgREST filters are URL operators, and
//     `.or('name.ilike.%x%,...')` splices a string into a mini-language: a
//     query like `a,visibility.eq.public` would add a clause. So this module
//     never calls `.or()` or any string-spliced filter; every user value goes
//     through a single-column operator as a parameter. Inside the ilike
//     pattern, `%`, `_`, `\` (LIKE wildcards/escape) and `*` (PostgREST's
//     alias for `%`) are escaped or stripped so "100%" matches literally and
//     "%" cannot turn into "match everything".
//  2. Huge page size / deep offset. `pageSize` is clamped to MAX_PAGE_SIZE and
//     `page` to MAX_PAGE; NaN, floats, negatives, strings fall back to the
//     defaults. A caller can never ask for the whole table or an unbounded
//     OFFSET scan.
//  3. A filter on a field a reader should not filter by. `BuildFilter` has no
//     `visibility`, `user_id`, `share_token`, `notes`, `description` or the
//     jsonb state columns, and `normalizeDiscoveryRequest` takes `unknown` and
//     copies only the named keys, so a hostile `?visibility=unlisted` or
//     `{ user_id }` is dropped, never forwarded. Sort keys are an allow-list.
//  4. Empty filter must still return only visible builds. Visibility is not
//     part of the spec at all: `applyDiscoverySpec` hard-codes
//     `.eq('visibility', 'public')` as its FIRST call. The vocabulary is
//     deliberate (see build/visibility.ts): `private` = link-shareable and
//     `unlisted` = owner-only, so neither is ever discoverable. Only `public`
//     is. The `builds` owner RLS policy ORs in the caller's own rows, but those
//     are all non-public here because of that same `.eq`.
//  5. Stable ordering with ties. Every sort is followed by `id` descending, a
//     unique column, so equal `updated_at`/`level`/`view_count` values cannot
//     shuffle between pages and drop or repeat a row.
//  6. A tag filter silently ignored. Tags live in `build_tags`, not on
//     `builds`, so they arrive as a resolved id list. If the spec has tags and
//     no id list is supplied, `applyDiscoverySpec` THROWS rather than return
//     an unfiltered list that looks filtered.
//  7. Inverted or out-of-range levels. Clamped to 1..100 and swapped if
//     min > max, rather than quietly returning nothing.
//  8. Control characters / giant strings in any text field: stripped and capped
//     at MAX_TEXT_LENGTH, and an empty-after-cleaning value means "no filter".
// =============================================================================

import { MAX_TAGS_PER_BUILD, normalizeTag } from '@/lib/build/tags';

/** Hard ceilings. Both are deliberate and enforced in the normaliser, not left to callers. */
export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 50;
/** 0-based page index cap: with MAX_PAGE_SIZE this bounds OFFSET at 10,000 rows. */
export const MAX_PAGE = 200;
export const MAX_TEXT_LENGTH = 64;
export const MAX_FILTER_TAGS = 4;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 100;

/**
 * Everything a reader may filter by. All optional; an absent, empty or
 * whitespace-only field is ignored. Exact (case-sensitive) matches for class,
 * ascendancy, mainSkill and league because those values come from the facet
 * lists, not free typing; `query` is the only fuzzy field.
 */
export interface BuildFilter {
  class?: string;
  ascendancy?: string;
  minLevel?: number;
  maxLevel?: number;
  mainSkill?: string;
  league?: string;
  /** Build must carry ALL of these tags (normalised like tags.ts). */
  tags?: string[];
  /** Case-insensitive substring match on the build name. */
  query?: string;
}

export type DiscoverySortKey = 'updated' | 'created' | 'views' | 'level' | 'name';

/** Allow-list: sort key -> real column. Anything not here is rejected. */
const SORT_COLUMNS: Record<DiscoverySortKey, string> = {
  updated: 'updated_at',
  created: 'created_at',
  views: 'view_count',
  level: 'level',
  name: 'name',
};

export interface BuildSort {
  key: DiscoverySortKey;
  direction: 'asc' | 'desc';
}

export const DEFAULT_SORT: BuildSort = { key: 'updated', direction: 'desc' };

/** Offset pagination. `page` is 0-based. */
export interface BuildPage {
  page?: number;
  pageSize?: number;
  sort?: BuildSort;
}

/** The cleaned, fully-defaulted request. Only this shape ever reaches a query. */
export interface DiscoverySpec {
  class: string | null;
  ascendancy: string | null;
  minLevel: number | null;
  maxLevel: number | null;
  mainSkill: string | null;
  league: string | null;
  tags: string[];
  /** The raw cleaned text (for display/echo); the pattern is derived from it. */
  query: string | null;
  sort: BuildSort;
  page: number;
  pageSize: number;
}

// Matches the characters a text field may not contain: C0/C1 controls.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

function cleanText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH).trim();
  return cleaned.length > 0 ? cleaned : null;
}

function cleanLevel(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(raw)));
}

function cleanInt(raw: unknown, fallback: number, min: number, max: number): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

function cleanSort(raw: unknown): BuildSort {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SORT;
  const { key, direction } = raw as Record<string, unknown>;
  if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(SORT_COLUMNS, key)) return DEFAULT_SORT;
  return { key: key as DiscoverySortKey, direction: direction === 'asc' ? 'asc' : 'desc' };
}

function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const tag = typeof item === 'string' ? normalizeTag(item) : null;
    if (tag !== null && !out.includes(tag)) out.push(tag);
    if (out.length >= Math.min(MAX_FILTER_TAGS, MAX_TAGS_PER_BUILD)) break;
  }
  return out;
}

/**
 * Untrusted `filter` / `page` (URL params, a JSON body) -> the one cleaned
 * shape. Copies only the keys named in `BuildFilter` / `BuildPage`; everything
 * else, including `visibility` and `user_id`, is never read.
 */
export function normalizeDiscoveryRequest(filter: unknown, page: unknown): DiscoverySpec {
  const f = (typeof filter === 'object' && filter !== null ? filter : {}) as Record<string, unknown>;
  const p = (typeof page === 'object' && page !== null ? page : {}) as Record<string, unknown>;

  let minLevel = cleanLevel(f.minLevel);
  let maxLevel = cleanLevel(f.maxLevel);
  if (minLevel !== null && maxLevel !== null && minLevel > maxLevel) [minLevel, maxLevel] = [maxLevel, minLevel];

  return {
    class: cleanText(f.class),
    ascendancy: cleanText(f.ascendancy),
    minLevel,
    maxLevel,
    mainSkill: cleanText(f.mainSkill),
    league: cleanText(f.league),
    tags: cleanTags(f.tags),
    // `*` is PostgREST's alias for `%`; a query of only stars would match everything, so it is dropped here too.
    query: cleanText(typeof f.query === 'string' ? f.query.replace(/\*/g, ' ') : null),
    sort: cleanSort(p.sort),
    page: cleanInt(p.page, 0, 0, MAX_PAGE),
    pageSize: cleanInt(p.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE),
  };
}

/**
 * Text -> an ilike pattern that matches it literally as a substring. Escapes
 * the LIKE specials with a backslash and drops `*`, which PostgREST rewrites
 * to `%` inside like/ilike values.
 */
export function ilikeContains(text: string): string {
  const escaped = text.replace(/[\\%_]/g, (c) => '\\' + c).replace(/\*/g, '');
  return `%${escaped}%`;
}

/**
 * The columns a discovery card reads, and nothing else — no jsonb state, no
 * notes/description, no user_id. `id` is selected only to look up the owner
 * name; listPublicBuilds drops it from the card.
 */
export const DISCOVERY_SELECT = 'id, name, class, ascendancy, level, league, main_skill, share_token, updated_at';

/** Just the PostgREST builder methods this module uses; each returns the builder. */
export interface DiscoveryQuery {
  eq(column: string, value: string | number): this;
  gte(column: string, value: number): this;
  lte(column: string, value: number): this;
  ilike(column: string, pattern: string): this;
  in(column: string, values: readonly string[]): this;
  not(column: string, operator: string, value: unknown): this;
  order(column: string, options: { ascending: boolean }): this;
  range(from: number, to: number): this;
}

/**
 * Applies a cleaned spec. `tagBuildIds` is the id list `build_tags` resolved
 * for `spec.tags` (builds carrying every tag); required exactly when the spec
 * has tags. Fetches one row past the page (`pageSize + 1`) so the caller can
 * tell whether another page exists without a count query.
 */
export function applyDiscoverySpec<Q extends DiscoveryQuery>(
  query: Q,
  spec: DiscoverySpec,
  tagBuildIds?: readonly string[],
): Q {
  if (spec.tags.length > 0 && tagBuildIds === undefined) {
    throw new Error('applyDiscoverySpec: spec has tags but no resolved build ids; refusing to drop the tag filter');
  }

  // Visibility first and unconditional. NOT a spec field: see failure mode 4.
  let q = query.eq('visibility', 'public').not('share_token', 'is', null);

  if (spec.class) q = q.eq('class', spec.class);
  if (spec.ascendancy) q = q.eq('ascendancy', spec.ascendancy);
  if (spec.league) q = q.eq('league', spec.league);
  if (spec.mainSkill) q = q.eq('main_skill', spec.mainSkill);
  if (spec.minLevel !== null) q = q.gte('level', spec.minLevel);
  if (spec.maxLevel !== null) q = q.lte('level', spec.maxLevel);
  if (spec.query) q = q.ilike('name', ilikeContains(spec.query));
  if (spec.tags.length > 0) q = q.in('id', tagBuildIds ?? []);

  // Sort, then the unique tiebreak (failure mode 5).
  q = q
    .order(SORT_COLUMNS[spec.sort.key], { ascending: spec.sort.direction === 'asc' })
    .order('id', { ascending: false });

  const from = spec.page * spec.pageSize;
  return q.range(from, from + spec.pageSize); // inclusive: pageSize + 1 rows
}

/**
 * `build_tags` rows (build_id, tag) for a tag-in-list lookup -> ids of builds
 * that carry EVERY wanted tag.
 */
export function buildIdsWithAllTags(rows: readonly { build_id: string; tag: string }[], wanted: readonly string[]): string[] {
  if (wanted.length === 0) return [];
  const seen = new Map<string, Set<string>>();
  for (const { build_id, tag } of rows) {
    if (!wanted.includes(tag)) continue;
    let set = seen.get(build_id);
    if (!set) seen.set(build_id, (set = new Set()));
    set.add(tag);
  }
  return [...seen].filter(([, tags]) => tags.size === wanted.length).map(([id]) => id);
}

/** One discovery card: the columns the list needs and nothing else. */
export interface DiscoveryCard {
  name: string;
  class: string;
  ascendancy: string | null;
  level: number;
  mainSkill: string | null;
  league: string;
  updatedAt: string;
  shareToken: string;
  ownerUsername: string | null;
}

export interface DiscoveryRow {
  id: string;
  name: string;
  class: string;
  ascendancy: string | null;
  level: number;
  league: string;
  main_skill: string | null;
  share_token: string | null;
  updated_at: string;
}

/** Raw rows (pageSize + 1 of them at most) -> the page's cards plus `hasMore`. */
export function toDiscoveryPage(
  rows: readonly DiscoveryRow[],
  owners: Readonly<Record<string, string | null>>,
  pageSize: number,
): { cards: DiscoveryCard[]; hasMore: boolean } {
  const cards: DiscoveryCard[] = [];
  for (const r of rows.slice(0, pageSize)) {
    if (!r.share_token) continue; // defence in depth; the query already excludes these
    cards.push({
      name: r.name,
      class: r.class,
      ascendancy: r.ascendancy,
      level: r.level,
      mainSkill: r.main_skill,
      league: r.league,
      updatedAt: r.updated_at,
      shareToken: r.share_token,
      ownerUsername: owners[r.id] ?? null,
    });
  }
  return { cards, hasMore: rows.length > pageSize };
}
