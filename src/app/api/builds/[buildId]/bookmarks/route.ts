// POST/DELETE /api/builds/[buildId]/bookmarks — toggle a bookmark. Private
// signal: a bookmark stays a personal "save for later" for the bookmarker,
// and its aggregate count is visible only to the build's owner (research
// doc §9.1 — see the second SELECT policy on build_bookmarks in
// supabase/schema.sql). Auth required.

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

  const { error } = await supabase.from('build_bookmarks').insert({ build_id: buildId, user_id: user.id })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Already bookmarked' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
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

  const { error } = await supabase.from('build_bookmarks').delete().eq('build_id', buildId).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
