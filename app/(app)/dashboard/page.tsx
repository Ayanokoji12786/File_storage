import type { Metadata } from 'next'
import {
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  type LucideIcon,
} from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { STORAGE_QUOTA } from '@/lib/constants'
import { requireUser } from '@/lib/dal'
import { formatBytes } from '@/lib/file-utils'
import type { FileCategory } from '@/types'

export const metadata: Metadata = { title: 'Dashboard' }

// Local presentation config for the dashboard category tiles.
const CATEGORY_TILES: {
  category: FileCategory
  label: string
  icon: LucideIcon
  iconBg: string
}[] = [
  { category: 'document', label: 'Documents', icon: FileText, iconBg: 'bg-primary' },
  { category: 'image', label: 'Images', icon: ImageIcon, iconBg: 'bg-sky-500' },
  { category: 'video', label: 'Media', icon: Video, iconBg: 'bg-emerald-500' },
  { category: 'audio', label: 'Audio', icon: Music, iconBg: 'bg-violet-500' },
]

export default async function DashboardPage() {
  const user = await requireUser()
  const firstName = user.name?.split(' ')[0]

  const used = 0
  const percent = Math.min(100, Math.round((used / STORAGE_QUOTA) * 100))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{firstName ? `, ${firstName}` : ''} 👋
        </h1>
        <p className="text-muted-foreground">Here&apos;s an overview of your storage.</p>
      </div>

      {/* Storage hero */}
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
            {formatBytes(used)} / {formatBytes(STORAGE_QUOTA)}
          </p>
        </div>
      </div>

      {/* Category tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORY_TILES.map(({ category, label, icon: Icon, iconBg }) => (
          <Card key={category} className="shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className={`grid size-11 place-items-center rounded-full ${iconBg}`}>
                  <Icon className="size-5 text-white" />
                </span>
                <span className="text-lg font-semibold">0 B</span>
              </div>
              <p className="mt-4 font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">0 files</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-3xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Recent uploads and quick actions arrive in Feature 7.
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
