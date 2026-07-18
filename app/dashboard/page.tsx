import type { Metadata } from 'next'
import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/actions/auth'
import { requireUser } from '@/lib/dal'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const user = await requireUser()

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-start justify-center gap-4 px-6">
      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        Authenticated
      </span>
      <h1 className="text-3xl font-semibold tracking-tight">You&apos;re in 🎉</h1>
      <p className="text-muted-foreground">
        Signed in as{' '}
        <span className="font-medium text-foreground">{user.email}</span>
        {user.name ? ` · ${user.name}` : ''}
      </p>
      <p className="text-sm text-muted-foreground">
        This is a placeholder. The full dashboard and app shell arrive in
        Feature 3.
      </p>

      <form action={signOut}>
        <Button variant="outline">
          <LogOut className="size-4" />
          Sign out
        </Button>
      </form>
    </main>
  )
}
