import type { Metadata } from 'next'
import { Trash2 } from 'lucide-react'

import { EmptyTrashButton } from '@/features/files/components/empty-trash-button'
import { TrashFileCard } from '@/features/files/components/trash-file-card'
import { TRASH_RETENTION_DAYS } from '@/lib/constants'
import { getTrashedFiles } from '@/lib/data/files'
import { formatBytes } from '@/lib/file-utils'

export const metadata: Metadata = { title: 'Trash' }

export default async function TrashPage() {
  const files = await getTrashedFiles()
  const heldBytes = files.reduce((sum, f) => sum + f.size, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trash</h1>
          <p className="text-muted-foreground">
            {`${files.length} ${files.length === 1 ? 'file' : 'files'} · deleted forever after ${TRASH_RETENTION_DAYS} days`}
          </p>
          {files.length > 0 && (
            <p className="mt-1 text-sm text-amber-600 dark:text-amber-500">
              {`${formatBytes(heldBytes)} still counts toward your storage until emptied`}
            </p>
          )}
        </div>
        {files.length > 0 && <EmptyTrashButton />}
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed p-16 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <Trash2 className="size-7" />
          </div>
          <p className="font-medium">Trash is empty</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            {`Files you delete stick around here for ${TRASH_RETENTION_DAYS} days before they’re gone for good.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {files.map((file) => (
            <TrashFileCard key={file.id} file={file} />
          ))}
        </div>
      )}
    </div>
  )
}
