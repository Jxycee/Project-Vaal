// Loading /builds/[shareToken] for one signed-in viewer. Owner first, then reader.
//
// OWNER: a plain select scoped by share_token AND user_id. It goes through
// the owner's own RLS policies, and it is the only way an owner can open an
// `unlisted` build here: get_build_by_share_token filters
// visibility IN ('public','private') and would 404 it.
//
// READER: exactly the pre-redesign path. Only the share-token RPCs, author
// name, tags for public builds only, and the view count for public builds only.
// Never a plain select keyed off anything the client sent besides the token.
import { createClient } from '@/lib/supabase/server';
import { SHARE_TOKEN_RE } from '@/lib/build/constants';
import { parseCheckpoints, type BuildCheckpoint } from '@/lib/build/checkpointState';
import type { SharedBuildRow } from '@/lib/build/types';

export interface LoadedBuild {
  mode: 'owner' | 'reader';
  row: SharedBuildRow;
  checkpoints: BuildCheckpoint[];
  authorName: string;
  /** null = this viewer cannot see tags (a link-shared build); the page omits the section. */
  tags: string[] | null;
}

async function loadAsOwner(shareToken: string, userId: string): Promise<LoadedBuild | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from('builds')
    .select('*')
    .eq('share_token', shareToken)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) console.error('Failed to load own build by share token:', error);
  if (error || !row) return null;

  const [checkpointsResult, tagsResult] = await Promise.all([
    supabase.from('build_checkpoints').select('*').eq('build_id', row.id).order('position'),
    supabase.from('build_tags').select('tag').eq('build_id', row.id),
  ]);
  if (checkpointsResult.error) console.error('Failed to load build checkpoints:', checkpointsResult.error);
  if (tagsResult.error) console.error('Failed to load build tags:', tagsResult.error);

  return {
    mode: 'owner',
    row: row as SharedBuildRow,
    checkpoints: checkpointsResult.error ? [] : parseCheckpoints(checkpointsResult.data),
    authorName: 'You',
    tags: tagsResult.error ? [] : tagsResult.data.map((r: { tag: string }) => r.tag),
  };
}

async function loadAsReader(shareToken: string, userId: string, countView: boolean): Promise<LoadedBuild | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase.rpc('get_build_by_share_token', { p_token: shareToken }).maybeSingle();
  if (error || !row) return null;

  const [authorResult, tagsResult, viewCountResult, checkpointsResult] = await Promise.allSettled([
    supabase.rpc('get_build_author_name', { p_build_id: row.id }),
    row.visibility === 'public' ? supabase.from('build_tags').select('tag').eq('build_id', row.id) : Promise.resolve(null),
    countView && row.user_id !== userId && row.visibility === 'public'
      ? supabase.rpc('increment_build_view_count', { p_build_id: row.id })
      : Promise.resolve(null),
    supabase.rpc('get_build_checkpoints_by_share_token', { p_token: shareToken }),
  ]);

  // display_name has no write path in the app, so null is common. Never fall
  // back to anything identifying (the viewer's email is in a request header).
  const authorName =
    authorResult.status === 'fulfilled' && !authorResult.value.error && authorResult.value.data ? authorResult.value.data : 'Anonymous';
  if (authorResult.status === 'rejected' || (authorResult.status === 'fulfilled' && authorResult.value.error)) {
    console.error('Failed to load build author name:', authorResult.status === 'rejected' ? authorResult.reason : authorResult.value.error);
  }

  let tags: string[] | null = null;
  if (row.visibility === 'public') {
    if (tagsResult.status === 'fulfilled' && tagsResult.value && !tagsResult.value.error) {
      tags = tagsResult.value.data.map((r: { tag: string }) => r.tag);
    } else {
      tags = [];
      console.error('Failed to load build tags:', tagsResult.status === 'rejected' ? tagsResult.reason : tagsResult.value?.error);
    }
  }

  if (viewCountResult.status === 'rejected') {
    console.error('Failed to increment build view count:', viewCountResult.reason);
  } else if (viewCountResult.value && 'error' in viewCountResult.value && viewCountResult.value.error) {
    console.error('Failed to increment build view count:', viewCountResult.value.error);
  }

  let checkpoints: BuildCheckpoint[] = [];
  if (checkpointsResult.status === 'fulfilled' && !checkpointsResult.value.error) {
    checkpoints = parseCheckpoints(checkpointsResult.value.data);
  } else {
    console.error('Failed to load build checkpoints:', checkpointsResult.status === 'rejected' ? checkpointsResult.reason : checkpointsResult.value.error);
  }

  return { mode: 'reader', row, checkpoints, authorName, tags };
}

/**
 * Owner, else reader, else null (-> notFound). "Unlisted and not yours", a bad
 * token and a missing build all return null alike.
 * `countView: false` for callers that must not count (generateMetadata).
 */
export async function loadBuildForViewer(shareToken: string, userId: string, opts: { countView: boolean }): Promise<LoadedBuild | null> {
  if (!SHARE_TOKEN_RE.test(shareToken)) return null;
  return (await loadAsOwner(shareToken, userId)) ?? (await loadAsReader(shareToken, userId, opts.countView));
}
