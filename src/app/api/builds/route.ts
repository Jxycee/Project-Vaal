// POST /api/builds — create a build. Auth required; RLS also enforces
// user_id = auth.uid() on insert, this is just the friendlier 401 in front
// of it.
//
// GET (list/filter, for the build finder) deliberately isn't here yet — it
// belongs with the finder page itself (docs/superpowers/specs/2026-08-28-
// builds-feature-research.md task list), so param shapes and sort semantics
// get designed against the real UI instead of guessed in isolation.

import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createClient } from '@/lib/supabase/server'
import { parseCreateBuildInput } from '@/lib/builds/validation'

export async function POST(request: Request) {
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

  const parsed = parseCreateBuildInput(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { data, error } = await supabase
    .from('builds')
    .insert({
      ...parsed.data,
      user_id: user.id,
      // Generated on first save regardless of visibility — never
      // regenerated afterward, so a build's link stays stable across
      // visibility changes (see get_build_by_share_token's comment in
      // supabase/schema.sql for why this matters for unlisted builds).
      share_token: nanoid(21),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ build: data }, { status: 201 })
}
