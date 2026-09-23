// /builds — the signed-in user's own builds, plus (Task 4) a Public tab
// listing every `visibility = 'public'` build across all accounts.
//
// Server Component. As of Task 4, `/builds` is in PROTECTED_PREFIXES
// (src/proxy.ts) — a signed-out visitor never reaches here in practice; the
// redirect() below is defence in depth, not the rendered path (see the Task
// 4 plan's AMENDMENT, item 5). Both tabs are driven by `searchParams`
// (`?tab=`, plus the finder's own filter keys), not client state, so every
// view — including a filtered finder — is a shareable URL and the Back
// button works.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, getCachedUser } from '@/lib/supabase/server';
import type { PublicBuildRow, SavedBuild } from '@/lib/build/types';
import { normalizeTag } from '@/lib/build/tags';
import { parseFinderFilters, type BuildFinderFilters } from '@/lib/build/finderFilters';
import MyBuildsList from '@/components/builds/MyBuildsList';
import BuildFinder from '@/components/builds/BuildFinder';
import { renameBuild, deleteBuild, setBuildVisibility, addBuildTag, removeBuildTag } from './actions';

export const metadata = { title: 'Builds' };

const PUBLIC_PAGE_SIZE = 30;
// Facet vocabulary (the chip options on the Public tab) is read off the
// public set itself, capped, and deduped in JS — NOT parsed from the tree
// export. The plan floated sourcing class names from the tree export (the
// same eight PassiveTree filters to), but that's a 5.1MB fetch+parse for a
// filter facet list on a page that otherwise needs none — the same class of
// cost SharedTreePanel exists specifically to defer. builds.class is already
// constrained to real class names in practice (nothing but the tree editor's
// reported className ever writes it), so deriving the facet from what's
// actually been saved is both cheaper and can never offer a filter chip with
// zero results behind it.
const FACET_SCAN_LIMIT = 500;

function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b));
}

async function loadPublicBuilds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: BuildFinderFilters,
): Promise<{ builds: PublicBuildRow[] | null; loadError: string | null }> {
  let buildIds: string[] | null = null;
  if (filters.tag) {
    // Tag filtering goes build_tags (indexed on `tag`) -> build ids ->
    // builds, in that direction — build_tags carries no visibility of its
    // own to filter on directly.
    const { data: tagRows, error: tagError } = await supabase
      .from('build_tags')
      .select('build_id')
      // normalizeTag, because addBuildTag normalised on the way IN (lowercase,
      // whitespace-collapsed — see tags.ts). Querying the raw user string made
      // the filter miss every tag that was not already lowercase: typing
      // "Minion" found nothing, while the stored tag was "minion".
      .eq('tag', normalizeTag(filters.tag) ?? filters.tag);
    if (tagError) {
      console.error('Failed to look up build_tags for finder:', tagError);
      return { builds: null, loadError: "Couldn't load public builds." };
    }
    buildIds = (tagRows ?? []).map((r) => r.build_id);
    if (buildIds.length === 0) return { builds: [], loadError: null };
  }

  // Named columns only, never `*` — the finder doesn't need
  // passive_state/gear_state/gem_state, and those are the three large jsonb
  // columns; shipping them for every row of a list is the difference
  // between a fast page and a slow one.
  //
  // .eq('visibility', 'public') is load-bearing, NOT belt-and-braces: the
  // owner policy is `ALL` for role `public` with `auth.uid() = user_id`, and
  // Postgres ORs permissive policies together — so for a signed-in viewer (as
  // of Task 4, every viewer) a bare select would return every public build
  // PLUS all of the viewer's own private ones, listed under a tab labelled
  // "Public". Mirror image of the comment on the Mine-tab query below.
  //
  // Index reality (read off the live index defs, not an EXPLAIN — see the
  // Task 4 plan): `class`, and `class`+`league` together, are prefix matches
  // on builds_visibility_idx (visibility, class, league) WHERE
  // visibility='public' (visibility is constant inside the partial index, so
  // it behaves as (class, league)). `league` ALONE is NOT a prefix match and
  // is not index-backed. `main_skill` has its own partial index
  // (builds_main_skill_idx). Nothing indexes updated_at/created_at/
  // view_count — any ordering is a sort over the whole public set, which is
  // exactly why this always carries an explicit .limit().
  let q = supabase
    .from('builds')
    .select('id, name, class, ascendancy, level, league, main_skill, share_token, view_count, updated_at')
    .eq('visibility', 'public')
    .order('updated_at', { ascending: false })
    .limit(PUBLIC_PAGE_SIZE);

  if (filters.class) q = q.eq('class', filters.class);
  if (filters.league) q = q.eq('league', filters.league);
  if (filters.skill) q = q.eq('main_skill', filters.skill);
  if (buildIds) q = q.in('id', buildIds);

  const { data, error } = await q;
  if (error) {
    console.error('Failed to load public builds:', error);
    return { builds: null, loadError: "Couldn't load public builds." };
  }
  return { builds: (data ?? []) as unknown as PublicBuildRow[], loadError: null };
}

export default async function BuildsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const tab = params.tab === 'public' ? 'public' : 'mine';

  const { data: userData } = await getCachedUser();
  const user = userData.user;
  if (!user) {
    redirect('/login');
  }

  const supabase = await createClient();

  const tabsNav = (
    <div className="flex gap-1.5 border-b border-border pb-px">
      <Link
        href="/builds"
        className={
          tab === 'mine'
            ? 'flex h-11 items-center border-b-2 border-primary px-3 text-sm font-medium text-foreground'
            : 'flex h-11 items-center border-b-2 border-transparent px-3 text-sm text-muted-foreground'
        }
      >
        Mine
      </Link>
      <Link
        href="/builds?tab=public"
        className={
          tab === 'public'
            ? 'flex h-11 items-center border-b-2 border-primary px-3 text-sm font-medium text-foreground'
            : 'flex h-11 items-center border-b-2 border-transparent px-3 text-sm text-muted-foreground'
        }
      >
        Public
      </Link>
    </div>
  );

  if (tab === 'public') {
    const filters = parseFinderFilters(params);

    const [{ builds, loadError }, { data: facetRows, error: facetError }] = await Promise.all([
      loadPublicBuilds(supabase, filters),
      supabase.from('builds').select('class, league, main_skill').eq('visibility', 'public').limit(FACET_SCAN_LIMIT),
    ]);
    if (facetError) {
      console.error('Failed to load finder facet vocabulary:', facetError);
    }
    const facets = facetRows ?? [];

    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Builds</h1>
        {tabsNav}
        <BuildFinder
          filters={filters}
          classes={uniqueSorted(facets.map((r) => r.class))}
          leagues={uniqueSorted(facets.map((r) => r.league))}
          skills={uniqueSorted(facets.map((r) => r.main_skill))}
          builds={builds}
          loadError={loadError}
        />
      </div>
    );
  }

  // Mine tab — unchanged from pre-Task-4 behaviour.
  // .eq('user_id', ...) is DISPLAY SCOPING, not the security boundary: the
  // "Public builds are readable by signed-in users" RLS policy is a permissive
  // SELECT policy for role `authenticated`, which this user has, and
  // Postgres OR's it together with the owner policy. Without this filter, a
  // bare select would return this user's rows PLUS every other user's public
  // builds, rendered here with Rename/Delete controls that would silently
  // hit zero rows for anything not actually owned. RLS is still what
  // enforces every write (see actions.ts) — this filter only keeps
  // strangers' builds off a page headed "Your builds".
  const { data, error } = await supabase
    .from('builds')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  const builds = error ? null : ((data ?? []) as unknown as SavedBuild[]);
  const loadError = error ? "Couldn't load your builds." : null;
  if (error) {
    console.error('Failed to load builds:', error);
  }

  // Tags for the user's own builds — queried by id, not by a broader
  // ownership filter: build_tags' SELECT policy is `own OR
  // builds.visibility='public'`, but every id passed in here already came
  // from the `.eq('user_id', user.id)` query above, so this can never
  // surface a stranger's tags regardless of that policy's OR.
  let tagsByBuildId: Record<string, string[]> = {};
  if (builds && builds.length > 0) {
    const { data: tagRows, error: tagsError } = await supabase
      .from('build_tags')
      .select('build_id, tag')
      .in('build_id', builds.map((b) => b.id));
    if (tagsError) {
      console.error('Failed to load build tags:', tagsError);
    } else {
      const grouped: Record<string, string[]> = {};
      for (const r of tagRows ?? []) {
        (grouped[r.build_id] ??= []).push(r.tag);
      }
      tagsByBuildId = grouped;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Your builds</h1>
      {tabsNav}
      <MyBuildsList
        builds={builds}
        loadError={loadError}
        tagsByBuildId={tagsByBuildId}
        renameAction={renameBuild}
        deleteAction={deleteBuild}
        setVisibilityAction={setBuildVisibility}
        addTagAction={addBuildTag}
        removeTagAction={removeBuildTag}
      />
    </div>
  );
}
