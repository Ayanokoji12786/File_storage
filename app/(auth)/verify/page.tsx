import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { VerifyForm } from '@/features/auth/components/verify-form'
import { getPendingAuth } from '@/lib/auth/pending-email'
import { OTP_LENGTH } from '@/lib/constants'

export const metadata: Metadata = { title: 'Verify' }

export default async function VerifyPage() {
  const pending = await getPendingAuth()
  if (!pending) redirect('/sign-in')
  const { email } = pending

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Check your inbox</CardTitle>
        <CardDescription>
          We emailed{' '}
          <span className="font-medium text-foreground">{email}</span>. Enter the{' '}
          {OTP_LENGTH}-digit code below, or just click the link in the email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <VerifyForm />
      </CardContent>
    </Card>
  )
}
