'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { resendOtp, verifyOtp, type AuthActionState } from '@/lib/actions/auth'

export function VerifyForm() {
  const [token, setToken] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  const [state, verifyAction, verifying] = useActionState<
    AuthActionState,
    FormData
  >(verifyOtp, undefined)

  const [resending, startResend] = useTransition()

  function handleResend() {
    startResend(async () => {
      const result = await resendOtp()
      if (result?.message) {
        toast.success(result.message)
        setToken('')
      } else if (result?.error) {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      <form ref={formRef} action={verifyAction} className="space-y-4">
        {/* Controlled value mirrored into a hidden field for submission. */}
        <input type="hidden" name="token" value={token} />

        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={token}
            onChange={setToken}
            onComplete={() => formRef.current?.requestSubmit()}
            disabled={verifying}
            autoFocus
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {state?.error && (
          <p className="text-center text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={verifying || token.length < 6}
        >
          {verifying && <Loader2 className="size-4 animate-spin" />}
          Verify &amp; continue
        </Button>
      </form>

      <div className="text-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleResend}
          disabled={resending}
        >
          {resending ? 'Sending…' : "Didn't get it? Resend code"}
        </Button>
      </div>
    </div>
  )
}
