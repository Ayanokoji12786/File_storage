import type { Metadata } from 'next'
import { FolderOpen } from 'lucide-react'

import { FileCard } from '@/features/files/components/file-card'
import { CATEGORY_META } from '@/lib/constants'
import { getFiles } from '@/lib/data/files'
import type { FileCategory } from '@/types'

export const metadata: Metadata = { title: 'My Files' }

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; search?: string }>
}) {
  const { category, search } = await searchParams
  const activeCategory =
    category && category in CATEGORY_META ? (category as FileCategory) : undefined

  const files = await getFiles({ search, category: activeCategory })

  const heading = search
    ? `Results for “${search}”`
    : activeCategory
      ? CATEGORY_META[activeCategory].plural
      : 'My Files'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        <p className="text-muted-foreground">
          {files.length} {files.length === 1 ? 'file' : 'files'}
        </p>
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed p-16 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <FolderOpen className="size-7" />
          </div>
          <p className="font-medium">
            {search ? 'No files match your search' : 'No files yet'}
          </p>
          <p className="max-w-xs text-sm text-muted-foreground">
            {search
              ? 'Try a different name.'
              : 'Use the Upload button to add your first file.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {files.map((file) => (
            <FileCard key={file.id} file={file} />
          ))}
        </div>
      )}
    </div>
  )
}
