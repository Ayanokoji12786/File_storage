import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { VerifyForm } from '@/features/auth/components/verify-form'
import { getPendingAuth } from '@/lib/auth/pending-email'
import { OTP_LENGTH } from '@/lib/constants'

export const metadata: Metadata = { title: 'Verify' }

export default async function VerifyPage() {
  const pending = await getPendingAuth()
  if (!pending) redirect('/sign-in')
  const { email } = pending

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Check your inbox</h1>
      <p className="mt-2 text-muted-foreground">
        We emailed{' '}
        <span className="font-medium text-foreground">{email}</span>. Enter the{' '}
        {OTP_LENGTH}-digit code below, or just click the link in the email.
      </p>
      <div className="mt-8">
        <VerifyForm />
      </div>
    </div>
  )
}
