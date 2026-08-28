// POST /api/builds/[buildId]/fork — "Copy to my builds" (research doc §9.1).
// Deep-copies build state into a brand-new row owned by the caller;
// independent from that point on, never a live link back to the source.

import { NextResponse, type NextRequest } from 'next/server'
import { nanoid } from 'nanoid'
import { createClient } from '@/lib/supabase/server'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ buildId: string }> }) {
  const { buildId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  // RLS already scopes this read to "owner OR visibility = public" — a
  // private/unlisted build owned by someone else simply doesn't come back,
  // same as a nonexistent id. Forking an unlisted build reached only via
  // its share_token isn't supported by this endpoint yet — same documented
  // limitation as liking one (see build_likes' INSERT policy comment in
  // supabase/schema.sql): no RLS-visible session context to check the token
  // against without a dedicated fork-by-token RPC, which doesn't exist yet.
  const { data: source, error: sourceError } = await supabase
    .from('builds')
    .select('*')
    .eq('id', buildId)
    .maybeSingle()

  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 })
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: authorName }, { data: sourceTags }] = await Promise.all([
    supabase.rpc('get_build_author_name', { p_build_id: source.id }),
    supabase.from('build_tags').select('tag').eq('build_id', source.id),
  ])

  const { data: copy, error: insertError } = await supabase
    .from('builds')
    .insert({
      user_id: user.id,
      name: `${source.name} (copy)`,
      class: source.class,
      ascendancy: source.ascendancy,
      level: source.level,
      league: source.league,
      game_version: source.game_version,
      description: source.description,
      notes: source.notes,
      passive_state: source.passive_state,
      gear_state: source.gear_state,
      gem_state: source.gem_state,
      main_skill: source.main_skill,
      forked_from: source.id,
      forked_from_name: source.name,
      forked_from_user: authorName ?? null,
      // visibility/share_token/view_count are left at their column
      // defaults — private, then a fresh token below, and 0. A copy is
      // never public until its new owner explicitly publishes it: every
      // precedent researched defaults a copy public into a spam problem
      // in the finder (research doc §9.1/§6.2).
      share_token: nanoid(21),
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  if (sourceTags && sourceTags.length > 0) {
    const { error: tagsError } = await supabase
      .from('build_tags')
      .insert(sourceTags.map((t) => ({ build_id: copy.id, tag: t.tag })))
    // Soft-fail: the build itself copied successfully. Losing tags on the
    // copy is a real but non-fatal gap — not worth unwinding the whole fork.
    if (tagsError) {
      console.error(`fork ${buildId} -> ${copy.id}: tag copy failed:`, tagsError.message)
    }
  }

  return NextResponse.json({ build: copy }, { status: 201 })
}
