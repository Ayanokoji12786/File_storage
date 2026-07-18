'use server'

import { redirect } from 'next/navigation'
import * as z from 'zod'

import {
  clearPendingAuth,
  getPendingAuth,
  setPendingAuth,
} from '@/lib/auth/pending-email'
import { env } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import { emailSchema, otpSchema, signUpSchema } from '@/lib/validations/auth'

/** Where the email link lands so we can complete sign-in server-side. */
const EMAIL_REDIRECT_TO = () => `${env.siteUrl}/auth/confirm`

export type AuthActionState =
  | {
      error?: string
      message?: string
      fieldErrors?: Record<string, string[] | undefined>
    }
  | undefined

const GENERIC_ERROR = 'Something went wrong. Please try again.'

/**
 * Sign-up: request an OTP for a new (or existing) account. Stores the name in
 * user metadata via `options.data`.
 */
export async function startSignUp(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    name: String(formData.get('name') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim(),
  })
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        shouldCreateUser: true,
        data: { full_name: parsed.data.name },
        emailRedirectTo: EMAIL_REDIRECT_TO(),
      },
    })
    if (error) return { error: error.message }
    // New users get the "Confirm signup" email → verify type `signup`.
    await setPendingAuth(parsed.data.email, 'signup')
  } catch {
    return { error: GENERIC_ERROR }
  }

  redirect('/verify')
}

/** Sign-in: request an OTP for an existing account only. */
export async function startSignIn(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailSchema.safeParse({
    email: String(formData.get('email') ?? '').trim(),
  })
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: EMAIL_REDIRECT_TO(),
      },
    })
    if (error) {
      // Most common cause: no account exists for this email.
      return { error: 'No account found for that email. Try signing up.' }
    }
    // Existing users get the "Magic Link" email → verify type `email`.
    await setPendingAuth(parsed.data.email, 'email')
  } catch {
    return { error: GENERIC_ERROR }
  }

  redirect('/verify')
}

/** Verify the 6-digit code and establish the session. */
export async function verifyOtp(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const pending = await getPendingAuth()
  if (!pending) redirect('/sign-in')

  const parsed = otpSchema.safeParse({
    token: String(formData.get('token') ?? '').trim(),
  })
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      email: pending.email,
      token: parsed.data.token,
      type: pending.type,
    })
    if (error) return { error: 'That code is invalid or has expired.' }
    await clearPendingAuth()
  } catch {
    return { error: GENERIC_ERROR }
  }

  redirect('/dashboard')
}

/** Re-send the OTP to the pending email. Called directly from the client. */
export async function resendOtp(): Promise<AuthActionState> {
  const pending = await getPendingAuth()
  if (!pending) redirect('/sign-in')

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email: pending.email,
      options: {
        // Re-create the user only if this was a signup that never completed.
        shouldCreateUser: pending.type === 'signup',
        emailRedirectTo: EMAIL_REDIRECT_TO(),
      },
    })
    if (error) return { error: error.message }
  } catch {
    return { error: GENERIC_ERROR }
  }

  return { message: 'A new code is on its way.' }
}

/** Sign out and return to the sign-in screen. */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/sign-in')
}
