import type { SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

import { env } from '@/lib/env'

let client: SupabaseClient | undefined

/**
 * Supabase client for use in the browser (Client Components).
 * Reads the session from cookies written by the server.
 *
 * `createBrowserClient` is a singleton, so we wire the Realtime auth token
 * exactly once. Without this, `@supabase/ssr` keeps the JWT in cookies but
 * never hands it to the Realtime socket — so every RLS-gated subscription
 * (the notification bell's postgres_changes, and the private upload-progress
 * and presence channels) silently receives nothing. We push the token in on
 * the initial session and on every refresh/sign-out.
 */
export function createClient() {
  if (client) return client

  client = createBrowserClient(env.supabaseUrl, env.supabaseAnonKey)

  client.auth.onAuthStateChange((_event, session) => {
    client!.realtime.setAuth(session?.access_token ?? null)
  })

  return client
}

/**
 * Feed the current session's JWT to the Realtime socket and resolve once it's
 * set. Call this and await it BEFORE subscribing to any RLS-gated channel
 * (postgres_changes on a protected table, or a private broadcast/presence
 * channel) — subscribing before the token lands fails the auth check and the
 * channel never retries. This closes the race against the async
 * `onAuthStateChange` handler above.
 */
export async function ensureRealtimeAuth() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  await supabase.realtime.setAuth(session?.access_token ?? null)
  return supabase
}
