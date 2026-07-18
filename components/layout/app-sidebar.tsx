'use client'

import { Suspense } from 'react'
import Link from 'next/link'

import { APP_NAME } from '@/lib/constants'

import { SidebarNav } from './sidebar-nav'
import { StorageMeter } from './storage-meter'

/**
 * Sidebar contents, shared by the desktop rail and the mobile drawer.
 * `onNavigate` lets the mobile drawer close itself when a link is tapped.
 */
export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2 px-2 py-1 text-lg font-semibold"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm text-primary-foreground">
          N
        </span>
        {APP_NAME}
      </Link>

      {/* useSearchParams needs a Suspense boundary. */}
      <Suspense fallback={<div className="flex-1" />}>
        <SidebarNav onNavigate={onNavigate} />
      </Suspense>

      <div className="mt-auto">
        <StorageMeter />
      </div>
    </div>
  )
}
