// /tree — "Quick plan" (the scratch planner) and the old-link redirect.
//
// Server Component. With no ?build= it renders the scratch planner: the build
// page shell in edit mode with no saved row (ScratchBuildPage, spec 7.3).
// With ?build=<uuid> it awaits and VERIFIES the row, and for its owner
// redirects to the build page's Tree tab in edit mode (old links, bookmarks
// and the dashboard's recent-builds links keep working). Anything else — a
// malformed id, a build that does not exist, one that is not ours — renders
// the scratch planner under "That build could not be found.".
import { redirect } from 'next/navigation';
import { createClient, getCachedUser } from '@/lib/supabase/server';
import type { SavedBuild } from '@/lib/build/types';
import { UUID_RE } from '@/lib/build/constants';
import { activeCheckpoint, parseCheckpoints, type BuildCheckpoint } from '@/lib/build/checkpointState';
import { patchQuery } from '@/lib/build/buildPage';
import ScratchBuildPage from '@/components/buildpage/ScratchBuildPage';

export const metadata = { title: 'Quick plan' };

const NOT_FOUND = 'That build could not be found.';

export default async function TreePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = params.build;
  const buildId = typeof raw === 'string' ? raw : undefined;
  // An unknown or malformed ?checkpoint= is not an error: activeCheckpoint
  // (checkpointState.ts) falls back to the first checkpoint.
  const checkpointParam = typeof params.checkpoint === 'string' ? params.checkpoint : null;

  let build: SavedBuild | null = null;
  let checkpoints: BuildCheckpoint[] = [];
  let loadError: string | null = null;

  if (buildId) {
    if (!UUID_RE.test(buildId)) {
      loadError = NOT_FOUND;
    } else {
      const supabase = await createClient();
      // All three alongside each other so neither the ownership check nor the
      // checkpoints add latency over an RLS-only row fetch.
      const [{ data: userData }, { data, error }, { data: checkpointRows, error: checkpointError }] =
        await Promise.all([
          getCachedUser(),
          supabase.from('builds').select('*').eq('id', buildId).maybeSingle(),
          supabase.from('build_checkpoints').select('*').eq('build_id', buildId).order('position'),
        ]);
      if (error) {
        console.error('Failed to load build:', error);
        loadError = NOT_FOUND;
      } else if (!data || data.user_id !== userData.user?.id) {
        // A row can come back that is NOT ours: the "Public builds are
        // readable by signed-in users" RLS policy is permissive and applies to
        // role `authenticated`, which this user has. Postgres ORs it with
        // the owner policy. So ownership is checked here, on the server.
        // "Exists but not ours" and "does not exist" deliberately produce the
        // same message so the UI cannot be used to probe which build ids
        // exist. The checkpoints fetched alongside are discarded with it.
        loadError = NOT_FOUND;
      } else {
        build = data as unknown as SavedBuild;
        if (checkpointError) {
          // Degrade rather than fail: the redirect below simply names no
          // checkpoint, and the build page falls back to the first.
          console.error('Failed to load checkpoints:', checkpointError);
        } else {
          checkpoints = parseCheckpoints(checkpointRows);
        }
      }
    }
  }

  if (build) {
    // "Ours" is already established above (any row that came back but is not
    // ours set loadError instead of `build`). Only a build with a share token
    // has a page to go to; one without (data predating share links, a state
    // this codebase does not otherwise produce) has nowhere left to be edited
    // now that the old editor is gone, so it reads as not found.
    if (build.share_token) {
      const target = checkpoints.length > 0 ? activeCheckpoint(checkpoints, checkpointParam) : null;
      redirect(
        `/builds/${encodeURIComponent(build.share_token)}${patchQuery('', {
          tab: 'tree',
          edit: '1',
          checkpoint: target?.id ?? null,
        })}`,
      );
    }
    loadError = NOT_FOUND;
  }

  // Quick plan opens on the Tree tab, as the tree editor always did. The tab
  // is a URL parameter (BuildTabs pushes it), so the default is a redirect
  // rather than a special case in the client: Overview stays "no ?tab=" on
  // every other page, and choosing it here must not bounce back to Tree.
  if (typeof params.tab !== 'string') {
    redirect(`/tree${patchQuery('', { build: buildId ?? null, checkpoint: checkpointParam, tab: 'tree' })}`);
  }

  // Scratch mode (no ?build=) makes zero database calls above — buildId is
  // undefined, so the `if (buildId)` block never runs.
  return <ScratchBuildPage notice={loadError} />;
}
