import type { Metadata } from 'next'

import { AuthForm } from '@/features/auth/components/auth-form'

export const metadata: Metadata = { title: 'Create account' }

export default function SignUpPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Create account</h1>
      <p className="mt-2 text-muted-foreground">
        No password needed — we&apos;ll email you a one-time code.
      </p>
      <div className="mt-8">
        <AuthForm mode="sign-up" />
      </div>
    </div>
  )
}
