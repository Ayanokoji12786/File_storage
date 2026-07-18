import { createBrowserClient } from '@supabase/ssr'

import { env } from '@/lib/env'

/**
 * Supabase client for use in the browser (Client Components).
 * Reads the session from cookies written by the server.
 */
export function createClient() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey)
}
