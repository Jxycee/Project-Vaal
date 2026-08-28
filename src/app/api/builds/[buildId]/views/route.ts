// POST /api/builds/[buildId]/views — increments view_count via the
// SECURITY DEFINER RPC (see supabase/schema.sql). No auth required — the
// RPC itself only counts public/unlisted builds and silently no-ops for a
// private build or bad id, so there's nothing to gate here beyond what the
// RPC already enforces.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ buildId: string }> }) {
  const { buildId } = await params
  const supabase = await createClient()

  const { error } = await supabase.rpc('increment_build_view_count', { p_build_id: buildId })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
