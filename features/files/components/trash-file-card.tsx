'use client'

import { useTransition } from 'react'
import {
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Loader2,
  Music,
  RotateCcw,
  Trash2,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { CATEGORY_META, TRASH_RETENTION_DAYS } from '@/lib/constants'
import { formatBytes } from '@/lib/file-utils'
import type { DriveFile, FileCategory } from '@/types'

import { permanentlyDeleteFile, restoreFile } from '../actions'

const CATEGORY_ICON: Record<FileCategory, LucideIcon> = {
  image: ImageIcon,
  document: FileText,
  video: Video,
  audio: Music,
  other: FileIcon,
}

function daysLeft(deletedAt: string): number {
  const elapsedMs = Date.now() - new Date(deletedAt).getTime()
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000))
  return Math.max(0, TRASH_RETENTION_DAYS - elapsedDays)
}

export function TrashFileCard({ file }: { file: DriveFile }) {
  const [isPending, startTransition] = useTransition()
  const Icon = CATEGORY_ICON[file.category]
  const meta = CATEGORY_META[file.category]
  const remaining = file.deletedAt ? daysLeft(file.deletedAt) : TRASH_RETENTION_DAYS

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreFile(file.id)
      if ('error' in result) toast.error(result.error)
      else toast.success('File restored')
    })
  }

  function handleDeleteForever() {
    if (!window.confirm(`Permanently delete “${file.name}”? This can't be undone.`)) return
    startTransition(async () => {
      const result = await permanentlyDeleteFile(file.id)
      if ('error' in result) toast.error(result.error)
      else toast.success('File permanently deleted')
    })
  }

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <span className={`grid size-11 place-items-center rounded-full opacity-70 ${meta.bg}`}>
        <Icon className="size-5 text-white" />
      </span>

      <p className="mt-3 truncate font-medium" title={file.name}>
        {file.name}
      </p>
      <p className="text-xs text-muted-foreground">{formatBytes(file.originalSize)}</p>
      <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
        {remaining === 0
          ? 'Deleting soon'
          : `Permanently deleted in ${remaining} ${remaining === 1 ? 'day' : 'days'}`}
      </p>

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 gap-1"
          disabled={isPending}
          onClick={handleRestore}
        >
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
          Restore
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={isPending}
          onClick={handleDeleteForever}
          aria-label="Delete forever"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
