import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, FolderOpen } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FileCard } from '@/features/files/components/file-card'
import { SortMenu } from '@/features/files/components/sort-menu'
import { CATEGORY_META, PAGE_SIZE } from '@/lib/constants'
import { getFiles, isSortKey } from '@/lib/data/files'
import type { FileCategory } from '@/types'

export const metadata: Metadata = { title: 'My Files' }

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string
    search?: string
    sort?: string
    page?: string
  }>
}) {
  const { category, search, sort, page } = await searchParams

  const activeCategory =
    category && category in CATEGORY_META ? (category as FileCategory) : undefined
  const sortKey = isSortKey(sort) ? sort : 'created_desc'
  const currentPage = Math.max(1, Number(page) || 1)

  const { files, total } = await getFiles({
    search,
    category: activeCategory,
    sort: sortKey,
    page: currentPage,
  })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const heading = search
    ? `Results for “${search}”`
    : activeCategory
      ? CATEGORY_META[activeCategory].plural
      : 'My Files'

  // Build a page URL preserving the other filters.
  function pageHref(targetPage: number) {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (activeCategory) params.set('category', activeCategory)
    if (sortKey !== 'created_desc') params.set('sort', sortKey)
    if (targetPage > 1) params.set('page', String(targetPage))
    const qs = params.toString()
    return qs ? `/files?${qs}` : '/files'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          <p className="text-muted-foreground">
            {total} {total === 1 ? 'file' : 'files'}
          </p>
        </div>
        {total > 0 && (
          <Suspense fallback={<div className="h-9 w-28" />}>
            <SortMenu />
          </Suspense>
        )}
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
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {files.map((file) => (
              <FileCard key={file.id} file={file} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                asChild={currentPage > 1}
                variant="outline"
                size="icon"
                disabled={currentPage <= 1}
                aria-label="Previous page"
              >
                {currentPage > 1 ? (
                  <Link href={pageHref(currentPage - 1)}>
                    <ChevronLeft className="size-4" />
                  </Link>
                ) : (
                  <ChevronLeft className="size-4" />
                )}
              </Button>

              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>

              <Button
                asChild={currentPage < totalPages}
                variant="outline"
                size="icon"
                disabled={currentPage >= totalPages}
                aria-label="Next page"
              >
                {currentPage < totalPages ? (
                  <Link href={pageHref(currentPage + 1)}>
                    <ChevronRight className="size-4" />
                  </Link>
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
