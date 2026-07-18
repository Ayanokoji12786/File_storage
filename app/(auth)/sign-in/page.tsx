import type { Metadata } from 'next'

import { AuthForm } from '@/features/auth/components/auth-form'

export const metadata: Metadata = { title: 'Sign in' }

export default function SignInPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Login</h1>
      <p className="mt-2 text-muted-foreground">
        Enter your email and we&apos;ll send you a one-time code.
      </p>
      <div className="mt-8">
        <AuthForm mode="sign-in" />
      </div>
    </div>
  )
}
