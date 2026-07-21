import type { Metadata } from 'next'
import { Users } from 'lucide-react'

import { FileCard } from '@/features/files/components/file-card'
import { getSharedWithMeFiles } from '@/lib/data/files'

export const metadata: Metadata = { title: 'Shared with me' }

export default async function SharedPage() {
  const files = await getSharedWithMeFiles()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shared with me</h1>
        <p className="text-muted-foreground">
          {files.length} {files.length === 1 ? 'file' : 'files'}
        </p>
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed p-16 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <Users className="size-7" />
          </div>
          <p className="font-medium">Nothing shared with you yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Files someone shares with your email will show up here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {files.map((file) => (
            <FileCard key={file.id} file={file} viewerIsOwner={false} />
          ))}
        </div>
      )}
    </div>
  )
}
