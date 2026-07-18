'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  startSignIn,
  startSignUp,
  type AuthActionState,
} from '@/lib/actions/auth'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const isSignUp = mode === 'sign-up'
  const action = isSignUp ? startSignUp : startSignIn

  const [state, formAction, pending] = useActionState<AuthActionState, FormData>(
    action,
    undefined,
  )

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {isSignUp && (
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            placeholder="Jane Doe"
            autoComplete="name"
            aria-invalid={!!state?.fieldErrors?.name}
          />
          <FieldError messages={state?.fieldErrors?.name} />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={!!state?.fieldErrors?.email}
        />
        <FieldError messages={state?.fieldErrors?.email} />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {isSignUp ? 'Create account' : 'Send code'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
        <Link
          href={isSignUp ? '/sign-in' : '/sign-up'}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {isSignUp ? 'Sign in' : 'Sign up'}
        </Link>
      </p>
    </form>
  )
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null
  return <p className="text-sm text-destructive">{messages[0]}</p>
}
