import { NextResponse, type NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/proxy'

/** Routes that require an authenticated user. */
function isProtectedRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/files') ||
    pathname.startsWith('/ai')
  )
}

/** Auth screens an already-signed-in user shouldn't see. */
const AUTH_ROUTES = ['/sign-in', '/sign-up', '/verify']

/**
 * Root Proxy (Next.js 16 renamed Middleware → Proxy). Runs before every matched
 * request: refreshes the session, then performs optimistic redirects based on
 * the session cookie. Real authorization still happens at the data layer (DAL).
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  // Gate protected routes for anonymous visitors.
  if (isProtectedRoute(pathname) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    return NextResponse.redirect(url)
  }

  // Keep signed-in users out of the auth screens.
  if (user && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Skip API, Next internals, the auth confirm route handler, and static assets.
  matcher: [
    '/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
