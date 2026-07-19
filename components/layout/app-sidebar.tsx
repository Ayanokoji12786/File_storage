'use client'

import { Suspense } from 'react'
import Link from 'next/link'

import { APP_NAME } from '@/lib/constants'
import type { AuthUser } from '@/types'

import { SidebarNav } from './sidebar-nav'
import { SidebarProfile } from './sidebar-profile'
import { StorageMeter } from './storage-meter'

/**
 * Sidebar contents, shared by the desktop rail and the mobile drawer.
 * `onNavigate` lets the mobile drawer close itself when a link is tapped.
 */
export function AppSidebar({
  user,
  storageUsed = 0,
  onNavigate,
}: {
  user: AuthUser
  storageUsed?: number
  onNavigate?: () => void
}) {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-2 py-1 text-xl font-semibold"
      >
        <span className="grid size-9 place-items-center rounded-full bg-primary">
          <span className="size-4 rounded-full bg-white" />
        </span>
        {APP_NAME}
      </Link>

      {/* useSearchParams needs a Suspense boundary. */}
      <Suspense fallback={<div className="flex-1" />}>
        <SidebarNav onNavigate={onNavigate} />
      </Suspense>

      <div className="space-y-3">
        <StorageMeter used={storageUsed} />
        <SidebarProfile user={user} />
      </div>
    </div>
  )
}
