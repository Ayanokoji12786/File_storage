import { FileQuestion } from 'lucide-react'

import type { FileCategory } from '@/types'

interface PreviewFile {
  name: string
  mimeType: string
  category: FileCategory
}

/**
 * Renders an inline preview for a file given a (signed) URL. Falls back to an
 * icon for unsupported types. Shared by the in-app dialog and the share page.
 */
export function FilePreview({
  file,
  url,
}: {
  file: PreviewFile
  url: string
}) {
  if (file.category === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed URL, not optimizable
      <img
        src={url}
        alt={file.name}
        className="mx-auto max-h-[70vh] w-auto rounded-xl object-contain"
      />
    )
  }

  if (file.category === 'video') {
    return (
      <video
        src={url}
        controls
        className="mx-auto max-h-[70vh] w-full rounded-xl bg-black"
      />
    )
  }

  if (file.category === 'audio') {
    return <audio src={url} controls className="w-full" />
  }

  if (file.mimeType === 'application/pdf') {
    return (
      <iframe
        src={url}
        title={file.name}
        className="h-[70vh] w-full rounded-xl border"
      />
    )
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center text-muted-foreground">
      <FileQuestion className="size-10" />
      <p className="text-sm">No preview available for this file type.</p>
    </div>
  )
}
