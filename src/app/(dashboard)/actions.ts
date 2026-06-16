'use server'

// Sign-out server action. Cookie writes succeed here (Server Actions can
// mutate cookies, unlike Server Components), so the Supabase session is
// fully cleared before we send the user back to /login.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}