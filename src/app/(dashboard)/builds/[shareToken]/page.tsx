// /builds/[shareToken] — the build's page, for its owner and for readers.
//
// Server Component. Signed-in check -> owner or reader load (load.ts) ->
// checkpoint choice -> BuildPage. force-dynamic for the reason the previous
// version gave: a dynamic segment under a layout that calls headers() must
// opt out of on-demand static generation, and the result is per-viewer anyway.
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCachedUser } from '@/lib/supabase/server';
import { activeCheckpoint } from '@/lib/build/checkpointState';
import { patchQuery } from '@/lib/build/buildPage';
import type { SharedBuildRow } from '@/lib/build/types';
import type { Json } from '@/types/database';
import BuildPage from '@/components/buildpage/BuildPage';
import { loadBuildForViewer } from './load';

export const dynamicParams = true;
export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ shareToken: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shareToken } = await params;
  const { data } = await getCachedUser();
  if (!data.user) return { title: 'Build not found' };
  const loaded = await loadBuildForViewer(shareToken, data.user.id, { countView: false });
  return loaded ? { title: `${loaded.row.name} — Project Vaal` } : { title: 'Build not found' };
}

/** searchParams -> a plain query string, keeping single string values only. */
function toQuery(sp: { [key: string]: string | string[] | undefined }): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === 'string') params.set(k, v);
  return params.toString();
}

export default async function BuildRoutePage({ params, searchParams }: PageProps) {
  const { shareToken } = await params;
  const sp = await searchParams;

  // Checked before any load, so every query below runs as a signed-in user
  // (anon holds no EXECUTE on the share-token RPCs). proxy.ts also guards
  // /builds, but its matcher is documented as not airtight.
  const { data: userData } = await getCachedUser();
  const user = userData.user;
  if (!user) redirect('/login');

  const loaded = await loadBuildForViewer(shareToken, user.id, { countView: true });
  if (!loaded) notFound();

  const checkpointParam = typeof sp.checkpoint === 'string' ? sp.checkpoint : null;
  const { checkpoints } = loaded;

  // Owner URLs always name their checkpoint (the rule /tree has used since
  // 2026-09-26): "the first by position" moves when checkpoints are
  // reordered. An unknown id (e.g. one just deleted) is replaced the same way.
  // Readers are not redirected: the view count above has already run, and a
  // redirect would run the page, and the count, a second time.
  if (loaded.mode === 'owner' && checkpoints.length > 0 && !checkpoints.some((c) => c.id === checkpointParam)) {
    const target = activeCheckpoint(checkpoints, checkpointParam)!;
    redirect(`/builds/${shareToken}${patchQuery(toQuery(sp), { checkpoint: target.id })}`);
  }

  const active = activeCheckpoint(checkpoints, checkpointParam);
  const row: SharedBuildRow = active
    ? {
        ...loaded.row,
        level: active.level,
        passive_state: active.passive_state as unknown as Json,
        gear_state: active.gear_state as Json,
        gem_state: active.gem_state as Json,
      }
    : loaded.row;

  return (
    <BuildPage
      // Keyed by checkpoint so no stage's state (tree export use, stats,
      // open menus) outlives a switch to another stage.
      key={active?.id ?? 'none'}
      mode={loaded.mode}
      row={row}
      authorName={loaded.authorName}
      tags={loaded.tags}
      shareToken={shareToken}
      checkpoints={checkpoints.map(({ id, name, level }) => ({ id, name, level }))}
      activeCheckpointId={active?.id}
      fullCheckpoints={loaded.mode === 'owner' ? checkpoints : []}
    />
  );
}
