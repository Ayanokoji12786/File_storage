import 'server-only'

import { cookies } from 'next/headers'

/**
 * The kind of OTP awaiting verification, which determines the `type` passed to
 * `verifyOtp`: a brand-new signup's code is type `signup`, a returning user's
 * login code is type `email`.
 */
export type PendingOtpType = 'signup' | 'email'

export interface PendingAuth {
  email: string
  type: PendingOtpType
}

/**
 * A short-lived, httpOnly cookie holding the email + OTP type awaiting
 * verification. Kept in a cookie (not the URL) so the address never appears in
 * query strings or browser history.
 */
const COOKIE = 'nimbus_pending_auth'
const MAX_AGE = 60 * 10 // 10 minutes

export async function setPendingAuth(email: string, type: PendingOtpType) {
  const store = await cookies()
  store.set(COOKIE, JSON.stringify({ email, type }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  })
}

export async function getPendingAuth(): Promise<PendingAuth | null> {
  const store = await cookies()
  const raw = store.get(COOKIE)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<PendingAuth>
    if (!parsed.email) return null
    return {
      email: parsed.email,
      type: parsed.type === 'signup' ? 'signup' : 'email',
    }
  } catch {
    return null
  }
}

export async function clearPendingAuth() {
  const store = await cookies()
  store.delete(COOKIE)
}
