import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { APP_NAME } from '@/lib/constants'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-7xl font-bold text-primary">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-muted-foreground">
        This page doesn&apos;t exist or is no longer available.
      </p>
      <Button asChild>
        <Link href="/">Back to {APP_NAME}</Link>
      </Button>
    </main>
  )
}
