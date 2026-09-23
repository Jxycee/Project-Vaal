// /builds/[shareToken] — the static, read-only shared-build page.
//
// Server Component. RPC -> author name -> view count -> static view. Reads
// cookies (via createClient()/getCachedUser()) itself, on top of AppShell
// (the (dashboard) layout) doing the same — so, same reasoning as
// src/app/wiki/items/[slug]/page.tsx's header comment (2026-08-22 production
// crash): a dynamic segment under a layout that calls a dynamic API
// (AppShell's `headers()`) must opt OUT of Next's on-demand static-generation
// path explicitly, or a first request for a never-seen shareToken throws
// DYNAMIC_SERVER_USAGE instead of just rendering. `force-dynamic` is
// required here regardless of Task 4's own auth requirement — this route
// can never be cached across visitors anyway, since the RPC result and the
// isOwner-derived "Edit" link both depend on per-request auth state.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient, getCachedUser } from '@/lib/supabase/server';
import { SHARE_TOKEN_RE } from '@/lib/build/constants';
import type { SharedBuildRow } from '@/lib/build/types';
import SharedBuildView from '@/components/builds/SharedBuildView';

export const dynamicParams = true;
export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ shareToken: string }>;
}

/**
 * Shared by generateMetadata and the page body so both read the exact same
 * row shape — but each calls this independently (no per-request cache()
 * memoisation across the two), which is deliberate: Next may invoke
 * generateMetadata and the page component for the same request, and the
 * view-count increment below must fire in exactly one of them. Keeping this
 * loader free of any side effect (it only reads) and confining the counter
 * call to the page body alone is what makes that true regardless of whether
 * the two call sites happen to be deduped.
 */
async function loadSharedBuild(shareToken: string): Promise<SharedBuildRow | null> {
  if (!SHARE_TOKEN_RE.test(shareToken)) return null; // shape-check before querying — see SHARE_TOKEN_RE's doc comment
  const supabase = await createClient(); // anon-capable, cookie-scoped. NEVER createServiceClient().
  const { data, error } = await supabase.rpc('get_build_by_share_token', { p_token: shareToken }).maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shareToken } = await params;
  const row = await loadSharedBuild(shareToken);
  if (!row) return { title: 'Build not found' };
  return { title: `${row.name} — Project Vaal` };
}

export default async function SharedBuildPage({ params }: PageProps) {
  const { shareToken } = await params;
  const row = await loadSharedBuild(shareToken);
  // notFound() for a bad token, an RPC error, and a `private` build alike —
  // the RPC's own `visibility IN ('public','private')` filter is what turns
  // "private" into "not found" server-side, with no client cooperation. Same
  // deliberate indistinguishability builds/actions.ts and /tree already use.
  if (!row) notFound();

  const { data: userData } = await getCachedUser(); // memoised per request — AppShell already calls this
  const user = userData.user;
  const isOwner = user?.id === row.user_id;

  const supabase = await createClient();

  // build_tags' SELECT policy covers only own-or-public (see SharedBuildView's `tags`
  // prop doc comment) — only ever query it for a `public` build, so a
  // non-public one never depends on RLS silently handing back zero rows.
  const tagsQuery =
    row.visibility === 'public' ? supabase.from('build_tags').select('tag').eq('build_id', row.id) : null;

  // Author name and the view-count increment run alongside each other, not
  // sequentially — the increment is a pure side effect for the OWNER-EXCLUDED
  // case only (an author refreshing their own share link must not inflate
  // their own count), and author name is otherwise already necessary for the
  // header, so running the counter in parallel with it adds no extra latency
  // of its own. Promise.allSettled means a failure in either never fails the
  // page — the counter especially must never do that.
  const [authorResult, tagsResult, viewCountResult] = await Promise.allSettled([
    supabase.rpc('get_build_author_name', { p_build_id: row.id }),
    tagsQuery ?? Promise.resolve(null),
    // Public builds only, by product decision (2026-09-23): a build shared
    // privately by link is not a published thing and keeps no public view
    // count. increment_build_view_count enforces the same rule server-side —
    // this check just avoids a round trip that would do nothing.
    isOwner || row.visibility !== 'public'
      ? Promise.resolve(null)
      : supabase.rpc('increment_build_view_count', { p_build_id: row.id }),
  ]);

  // display_name is nullable with no write path in the app (see Task 4
  // plan's "Claims I could NOT verify") — null is the likely common case.
  // Never fall back to the viewer's own email (AppShell has one in a request
  // header; putting it on a public page would be a real leak).
  const authorName =
    authorResult.status === 'fulfilled' && !authorResult.value.error && authorResult.value.data
      ? authorResult.value.data
      : 'Anonymous';
  if (authorResult.status === 'rejected' || (authorResult.status === 'fulfilled' && authorResult.value.error)) {
    console.error(
      'Failed to load build author name:',
      authorResult.status === 'rejected' ? authorResult.reason : authorResult.value.error,
    );
  }

  let tags: string[] | null = null;
  if (row.visibility === 'public') {
    if (tagsResult.status === 'fulfilled' && tagsResult.value && !tagsResult.value.error) {
      tags = tagsResult.value.data.map((r: { tag: string }) => r.tag);
    } else {
      tags = []; // query failed — render "no tags" rather than blocking the page on it
      console.error(
        'Failed to load build tags:',
        tagsResult.status === 'rejected' ? tagsResult.reason : tagsResult.value?.error,
      );
    }
  }

  if (viewCountResult.status === 'rejected') {
    console.error('Failed to increment build view count:', viewCountResult.reason);
  } else if (viewCountResult.value && 'error' in viewCountResult.value && viewCountResult.value.error) {
    console.error('Failed to increment build view count:', viewCountResult.value.error);
  }

  return <SharedBuildView row={row} authorName={authorName} isOwner={isOwner} tags={tags} />;
}
