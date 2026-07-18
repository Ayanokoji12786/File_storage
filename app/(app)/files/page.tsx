import type { Metadata } from 'next'

import { CATEGORY_META } from '@/lib/constants'
import type { FileCategory } from '@/types'

export const metadata: Metadata = { title: 'My Files' }

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const meta =
    category && category in CATEGORY_META
      ? CATEGORY_META[category as FileCategory]
      : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {meta ? meta.plural : 'My Files'}
        </h1>
        <p className="text-muted-foreground">
          Upload, preview and manage your files.
        </p>
      </div>

      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        File upload &amp; management arrive in Features 4–6.
      </div>
    </div>
  )
}
