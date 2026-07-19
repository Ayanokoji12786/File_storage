import type { Metadata } from 'next'
import Link from 'next/link'
import {
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  type LucideIcon,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { CATEGORY_META, STORAGE_QUOTA } from '@/lib/constants'
import { getRecentFiles, getStorageStats } from '@/lib/data/files'
import { requireUser } from '@/lib/dal'
import { formatBytes, formatDate } from '@/lib/file-utils'
import type { FileCategory } from '@/types'

export const metadata: Metadata = { title: 'Dashboard' }

const CATEGORY_ICON: Record<FileCategory, LucideIcon> = {
  image: ImageIcon,
  document: FileText,
  video: Video,
  audio: Music,
  other: FileIcon,
}

const TILES: { category: FileCategory; label: string }[] = [
  { category: 'document', label: 'Documents' },
  { category: 'image', label: 'Images' },
  { category: 'video', label: 'Media' },
  { category: 'audio', label: 'Audio' },
]

export default async function DashboardPage() {
  const [user, stats, recent] = await Promise.all([
    requireUser(),
    getStorageStats(),
    getRecentFiles(),
  ])
  const firstName = user.name?.split(' ')[0]
  const percent = Math.min(
    100,
    Math.round((stats.totalSize / STORAGE_QUOTA) * 100),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{firstName ? `, ${firstName}` : ''} 👋
        </h1>
        <p className="text-muted-foreground">
          {stats.totalCount} {stats.totalCount === 1 ? 'file' : 'files'} ·{' '}
          {formatBytes(stats.totalSize)} used
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: storage + categories */}
        <div className="space-y-6 lg:col-span-2">
          <div className="flex flex-col items-center gap-6 rounded-3xl bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/20 sm:flex-row sm:p-8">
            <div className="relative grid shrink-0 place-items-center">
              <StorageRing percent={percent} />
              <div className="absolute text-center">
                <p className="text-2xl font-bold">{percent}%</p>
                <p className="text-xs text-primary-foreground/80">Space used</p>
              </div>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-xl font-semibold">Available Storage</p>
              <p className="mt-1 text-primary-foreground/80">
                {formatBytes(stats.totalSize)} / {formatBytes(STORAGE_QUOTA)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {TILES.map(({ category, label }) => {
              const Icon = CATEGORY_ICON[category]
              const meta = CATEGORY_META[category]
              const bucket = stats.byCategory[category]
              return (
                <Link key={category} href={`/files?category=${category}`}>
                  <Card className="shadow-sm transition-shadow hover:shadow-md">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <span
                          className={`grid size-11 place-items-center rounded-full ${meta.bg}`}
                        >
                          <Icon className="size-5 text-white" />
                        </span>
                        <span className="text-lg font-semibold">
                          {formatBytes(bucket.size)}
                        </span>
                      </div>
                      <p className="mt-4 font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">
                        {bucket.count} {bucket.count === 1 ? 'file' : 'files'}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Right: recent uploads */}
        <div className="rounded-3xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-semibold">Recent uploads</h2>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No uploads yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {recent.map((file) => {
                const Icon = CATEGORY_ICON[file.category]
                const meta = CATEGORY_META[file.category]
                return (
                  <li key={file.id}>
                    <div className="flex items-center gap-3 rounded-xl p-2">
                      <span
                        className={`grid size-9 shrink-0 place-items-center rounded-full ${meta.bg}`}
                      >
                        <Icon className="size-4 text-white" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(file.createdAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function StorageRing({ percent }: { percent: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <svg viewBox="0 0 120 120" className="size-32 -rotate-90">
      <circle
        cx="60"
        cy="60"
        r={radius}
        strokeWidth="10"
        className="fill-none stroke-white/25"
      />
      <circle
        cx="60"
        cy="60"
        r={radius}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="fill-none stroke-white transition-[stroke-dashoffset]"
      />
    </svg>
  )
}
