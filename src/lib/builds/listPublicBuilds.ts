// src/lib/builds/listPublicBuilds.ts
// =============================================================================
// Server-side discovery list. Runs the pure spec from ./discovery against the
// caller's own Supabase client (cookie session, RLS applies; NEVER the service
// client, which would bypass the visibility policy this depends on).
//
// FAILURE MODES: signed-out caller gets an empty result, not data (/builds is
// auth-protected and so is this); a tag lookup failure fails the whole call
// rather than returning an unfiltered list; an owner-name lookup failure only
// blanks the names; errors are logged and surfaced as `error`, never thrown
// raw to the UI. Only `visibility = 'public'` builds are ever returned
// (applyDiscoverySpec), whatever the filter says.
//
// Not wired to any page or route yet, by decision (board item 21: foundations
// first, filters later).
// =============================================================================

import { createClient, getCachedUser } from '@/lib/supabase/server';
import {
  DISCOVERY_SELECT,
  applyDiscoverySpec,
  buildIdsWithAllTags,
  normalizeDiscoveryRequest,
  toDiscoveryPage,
  type BuildFilter,
  type BuildPage,
  type DiscoveryCard,
  type DiscoveryQuery,
  type DiscoveryRow,
} from './discovery';

export interface DiscoveryResult {
  cards: DiscoveryCard[];
  hasMore: boolean;
  /** 0-based page actually served (after clamping). */
  page: number;
  error: string | null;
}

/**
 * Upper bound on build_tags rows read for a tag filter. A tag shared by more
 * builds than this is truncated (the oldest-listed rows win), which can hide
 * matches; the facet doc lists the fix (a tag-aware RPC or a denormalised
 * array column).
 */
const TAG_ROW_LIMIT = 2000;

export async function listPublicBuilds(filter: BuildFilter = {}, page: BuildPage = {}): Promise<DiscoveryResult> {
  const spec = normalizeDiscoveryRequest(filter, page);
  const empty = (error: string | null): DiscoveryResult => ({ cards: [], hasMore: false, page: spec.page, error });

  const { data: userData } = await getCachedUser();
  if (!userData.user) return empty(null);

  const supabase = await createClient();

  let tagBuildIds: string[] | undefined;
  if (spec.tags.length > 0) {
    const { data: tagRows, error } = await supabase
      .from('build_tags')
      .select('build_id, tag')
      .in('tag', spec.tags)
      .limit(TAG_ROW_LIMIT);
    if (error) {
      console.error('listPublicBuilds: tag lookup failed:', error);
      return empty("Couldn't load builds.");
    }
    tagBuildIds = buildIdsWithAllTags(tagRows ?? [], spec.tags);
    if (tagBuildIds.length === 0) return empty(null);
  }

  const base = supabase.from('builds').select(DISCOVERY_SELECT);
  const q = applyDiscoverySpec(base as unknown as DiscoveryQuery & PromiseLike<{ data: unknown; error: unknown }>, spec, tagBuildIds);
  const { data, error } = (await q) as { data: DiscoveryRow[] | null; error: unknown };
  if (error) {
    console.error('listPublicBuilds: query failed:', error);
    return empty("Couldn't load builds.");
  }
  const rows = data ?? [];

  const owners: Record<string, string | null> = {};
  if (rows.length > 0) {
    const { data: authorRows, error: authorError } = await supabase.rpc('get_public_build_authors', {
      p_build_ids: rows.map((r) => r.id),
    });
    if (authorError) console.error('listPublicBuilds: owner lookup failed:', authorError);
    for (const a of authorRows ?? []) owners[a.build_id] = a.display_name;
  }

  return { ...toDiscoveryPage(rows, owners, spec.pageSize), page: spec.page, error: null };
}
