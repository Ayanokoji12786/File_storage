import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refreshes the Supabase auth session on every request and reports the current
 * user. Called from the root `proxy.ts` (formerly "middleware" pre-Next 16).
 *
 * The cookie dance below is required by `@supabase/ssr`: tokens rotated during
 * `getUser()` must be written back onto BOTH the request (so downstream reads
 * see them) and the outgoing response (so the browser stores them).
 *
 * If Supabase env vars aren't configured yet, we no-op so the app still boots.
 */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return { response: NextResponse.next({ request }), user: null }
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  // IMPORTANT: getUser() revalidates the token with Supabase Auth. Do not
  // insert logic between creating the client and this call.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
