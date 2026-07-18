import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { env } from '@/lib/env'

/**
 * Supabase client for use on the server (Server Components, Server Actions,
 * Route Handlers). In Next.js 16 `cookies()` is async, so this factory is too.
 *
 * The `setAll` call can throw when invoked from a Server Component (cookies are
 * read-only there); that's expected and safe to ignore because the session is
 * refreshed in `proxy.ts` on every request instead.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a Server Component — safe to ignore (see JSDoc above).
        }
      },
    },
  })
}
