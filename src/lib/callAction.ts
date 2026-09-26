// src/lib/callAction.ts
// Calls a Server Action from a client component without letting a THROWN
// action take the page down. Inside startTransition, a rejected action is
// rethrown to the nearest error boundary; on /tree that unmounted the editor
// and every unsaved edit with it (review 2026-09-26). A throw here — a dropped
// connection, a deploy that retired the action's id — becomes an ordinary
// failure result that the caller already knows how to show. Next's own
// control-flow signals (redirect, notFound) are rethrown untouched.
import { unstable_rethrow } from 'next/navigation'

export const ACTION_UNREACHABLE = "Couldn't reach the server. Nothing here was lost — try again."

export async function callAction<T>(action: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try {
    return await action()
  } catch (err) {
    unstable_rethrow(err)
    console.error('Server action failed:', err)
    return { ok: false, error: ACTION_UNREACHABLE }
  }
}
