import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { env } from '@/lib/env'

/**
 * Service-role Supabase client. BYPASSES Row Level Security — use only on the
 * server, and only for operations that have their own authorization checks
 * (e.g. serving a file that is explicitly marked `is_public`).
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
