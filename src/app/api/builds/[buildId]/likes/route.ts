// POST/DELETE /api/builds/[buildId]/likes — toggle a like. Public signal,
// unlike bookmarks (research doc §9.1). Auth required; the RLS INSERT
// policy on build_likes also enforces the build being public-or-owned and
// the liking account being 1+ day old — this route's 401/403 are the
// friendlier surface in front of that, not a substitute for it.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ buildId: string }> }

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const { buildId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const { error } = await supabase.from('build_likes').insert({ build_id: buildId, user_id: user.id })
  if (error) {
    // PK is (user_id, build_id), so a repeat like is a unique-violation
    // (23505) — worth telling apart from a genuine RLS denial (build not
    // public/owned, or account under 1 day old), which Postgres otherwise
    // reports the same way as any other policy failure.
    if (error.code === '23505') return NextResponse.json({ error: 'Already liked' }, { status: 409 })
    return NextResponse.json(
      { error: 'Not allowed — the build must be public (or your own), and your account must be at least 1 day old' },
      { status: 403 }
    )
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { buildId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const { error } = await supabase.from('build_likes').delete().eq('build_id', buildId).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
