// GET /api/builds/[buildId]    — owner or public only (plain RLS read).
//                                 Deliberately does NOT resolve unlisted
//                                 builds for non-owners — that's what
//                                 get_build_by_share_token exists for
//                                 (see the /builds/[shareToken] viewer),
//                                 called by id here would let anyone probe
//                                 for unlisted builds without ever having
//                                 seen the token.
// PATCH /api/builds/[buildId]  — owner only.
// DELETE /api/builds/[buildId] — owner only.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseUpdateBuildInput } from '@/lib/builds/validation'

type RouteContext = { params: Promise<{ buildId: string }> }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { buildId } = await params
  const supabase = await createClient()

  const { data, error } = await supabase.from('builds').select('*').eq('id', buildId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ build: data })
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { buildId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parseUpdateBuildInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('builds')
    .update(parsed.data)
    // .eq('user_id', ...) alongside RLS (not instead of it) so a 0-row
    // result is unambiguous — "not yours or doesn't exist" — rather than
    // possibly meaning RLS silently dropped an update to someone else's row
    // that matched by id alone.
    .eq('id', buildId)
    .eq('user_id', user.id)
    .select()
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ build: data })
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { buildId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

  const { data, error } = await supabase
    .from('builds')
    .delete()
    .eq('id', buildId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
