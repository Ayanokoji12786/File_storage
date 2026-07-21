'use client'

import { useRef } from 'react'
import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/actions/auth'
import { clearOfflineData } from '@/lib/offline-store'

/**
 * Signs out, but wipes on-device caches first — offline file bytes and the
 * cached app shell would otherwise survive on a shared machine.
 */
export function SignOutButton() {
  const formRef = useRef<HTMLFormElement>(null)
  const cleared = useRef(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (cleared.current) return // second pass: let the action run
    e.preventDefault()
    void clearOfflineData().finally(() => {
      cleared.current = true
      formRef.current?.requestSubmit()
    })
  }

  return (
    <form ref={formRef} action={signOut} onSubmit={handleSubmit}>
      <Button
        variant="ghost"
        size="icon"
        type="submit"
        className="text-primary"
        aria-label="Sign out"
      >
        <LogOut className="size-5" />
      </Button>
    </form>
  )
}
