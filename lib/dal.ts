import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { AuthUser } from '@/types'

/**
 * Data Access Layer — the single place that reads the authenticated user.
 *
 * `cache()` memoizes the result for one render pass, so calling `getCurrentUser`
 * in a layout and several components hits Supabase only once per request.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  return {
    id: user.id,
    email: user.email ?? '',
    name: (user.user_metadata?.full_name as string | undefined) ?? null,
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
  }
})

/**
 * Use in Server Components / Actions that must have a user. Redirects to
 * sign-in when there's no session, and returns a non-null user otherwise.
 */
export const requireUser = cache(async (): Promise<AuthUser> => {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  return user
})
