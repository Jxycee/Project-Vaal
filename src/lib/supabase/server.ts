import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
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