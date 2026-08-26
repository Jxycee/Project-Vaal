import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { Database } from '@/types/database'

/**
 * Creates a Supabase client for use in:
 *   - Server Components
 *   - Route Handlers (app/api/...)
 *   - Server Actions
 *
 * Must be called once per request — do not share across requests.
 *
 * Usage:
 *   const supabase = await createClient()
 *   const { data } = await supabase.from('builds').select('*')
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll() is called from a Server Component where cookies are
            // read-only. This is safe to swallow — middleware handles refresh.
          }
        },
      },
    }
  )
}

/**
 * `auth.getUser()` round-trips to the Supabase Auth server to validate the
 * token (it's not a local JWT decode), so calling it more than once per
 * request is a real cost. `AppShell` (every dashboard/prices page) and the
 * page it wraps both need the current user — `cache()` (per-request, React's
 * server-render memoization) collapses those into one call.
 */
export const getCachedUser = cache(async () => {
  const supabase = await createClient()
  return supabase.auth.getUser()
})

/**
 * Creates a Supabase client using the service role key.
 * Bypasses RLS entirely — use ONLY in:
 *   - Cron endpoints (/api/ladder/sync)
 *   - Admin operations (future)
 *
 * NEVER call this from a client component or expose the service key.
 */
export function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  // Service clients are not user-scoped, so we use the plain supabase-js
  // client instead of the cookie-based SSR client.
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        // No session to manage — disable session machinery entirely
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}