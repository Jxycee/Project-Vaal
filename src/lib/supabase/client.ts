import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * Creates a Supabase client for use in Client Components ('use client').
 *
 * The browser client is a singleton — calling this multiple times returns
 * the same underlying instance (handled by @supabase/ssr internally).
 *
 * Usage:
 *   const supabase = createClient()
 *   const { data } = await supabase.from('builds').select('*')
 *
 * For auth state in React, pair with supabase.auth.onAuthStateChange()
 * or use the AuthProvider pattern (see src/components/providers/auth-provider.tsx).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}