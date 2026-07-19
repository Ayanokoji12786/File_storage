'use client'

import { useState, useTransition } from 'react'
import {
  Download,
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Music,
  Pencil,
  Trash2,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CATEGORY_META } from '@/lib/constants'
import { formatBytes, formatDate } from '@/lib/file-utils'
import type { DriveFile, FileCategory } from '@/types'

import { deleteFile, getDownloadUrl } from '../actions'
import { RenameDialog } from './rename-dialog'

const CATEGORY_ICON: Record<FileCategory, LucideIcon> = {
  image: ImageIcon,
  document: FileText,
  video: Video,
  audio: Music,
  other: FileIcon,
}

export function FileCard({ file }: { file: DriveFile }) {
  const [isPending, startTransition] = useTransition()
  const [renameOpen, setRenameOpen] = useState(false)
  const Icon = CATEGORY_ICON[file.category]
  const meta = CATEGORY_META[file.category]

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteFile(file.id)
      if ('error' in result) toast.error(result.error)
      else toast.success('File deleted')
    })
  }

  function handleDownload() {
    startTransition(async () => {
      const result = await getDownloadUrl(file.id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      const anchor = document.createElement('a')
      anchor.href = result.url
      anchor.download = file.name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    })
  }

  return (
    <>
      <div className="group relative rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between">
          <span
            className={`grid size-11 place-items-center rounded-full ${meta.bg}`}
          >
            <Icon className="size-5 text-white" />
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label="File actions"
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MoreVertical className="size-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleDownload}>
                <Download className="size-4" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                <Pencil className="size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="mt-3 truncate font-medium" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(file.size)} · {formatDate(file.createdAt)}
        </p>
      </div>

      <RenameDialog file={file} open={renameOpen} onOpenChange={setRenameOpen} />
    </>
  )
}
