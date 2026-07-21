import type { Metadata } from 'next'

import { AuthForm } from '@/features/auth/components/auth-form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Login</h1>
      <p className="mt-2 text-muted-foreground">
        Enter your email and we&apos;ll send you a one-time code.
      </p>
      {error === 'auth' && (
        <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          That sign-in link didn&apos;t work — this can happen if it opens in a
          different browser than the one you requested it from (common with
          some email apps). Request a new code below and enter it directly
          instead.
        </p>
      )}
      <div className="mt-8">
        <AuthForm mode="sign-in" />
      </div>
    </div>
  )
}
