'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DriveFile } from '@/types'

import { getPreviewUrl } from '../actions'
import { FilePreview } from './file-preview'

export function PreviewDialog({
  file,
  open,
  onOpenChange,
}: {
  file: DriveFile
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true

    async function load() {
      setUrl(null)
      setError(null)
      const result = await getPreviewUrl(file.id)
      if (!active) return
      if ('error' in result) setError(result.error)
      else setUrl(result.url)
    }
    load()

    return () => {
      active = false
    }
  }, [open, file.id])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{file.name}</DialogTitle>
        </DialogHeader>

        {error ? (
          <p className="py-10 text-center text-sm text-destructive">{error}</p>
        ) : url ? (
          <FilePreview
            file={{
              name: file.name,
              mimeType: file.mimeType,
              category: file.category,
              size: file.size,
            }}
            url={url}
          />
        ) : (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
