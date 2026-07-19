import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FilePreview } from '@/features/files/components/file-preview'
import { APP_NAME } from '@/lib/constants'
import { formatBytes, formatDate } from '@/lib/file-utils'
import { STORAGE_BUCKET } from '@/lib/storage'
import { createAdminClient } from '@/lib/supabase/admin'
import type { FileCategory } from '@/types'

export const metadata: Metadata = { title: 'Shared file' }

interface SharedRow {
  name: string
  storage_path: string
  size: number
  mime_type: string
  category: string
  is_public: boolean
  created_at: string
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Admin client bypasses RLS; we only serve rows explicitly marked public.
  const admin = createAdminClient()
  const { data } = await admin
    .from('files')
    .select('name, storage_path, size, mime_type, category, is_public, created_at')
    .eq('id', id)
    .eq('is_public', true)
    .single<SharedRow>()

  if (!data) notFound()

  const { data: signed } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(data.storage_path, 3600)

  const url = signed?.signedUrl ?? ''
  const downloadUrl = url ? `${url}&download=${encodeURIComponent(data.name)}` : ''

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-full bg-primary">
            <span className="size-3.5 rounded-full bg-white" />
          </span>
          {APP_NAME}
        </Link>
        {downloadUrl && (
          <Button asChild>
            <a href={downloadUrl}>
              <Download className="size-4" />
              Download
            </a>
          </Button>
        )}
      </header>

      <div className="rounded-3xl border bg-card p-6 shadow-sm">
        <h1 className="truncate text-xl font-semibold" title={data.name}>
          {data.name}
        </h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {formatBytes(data.size)} · Shared on {formatDate(data.created_at)}
        </p>

        {url ? (
          <FilePreview
            file={{
              name: data.name,
              mimeType: data.mime_type,
              category: data.category as FileCategory,
            }}
            url={url}
          />
        ) : (
          <p className="py-10 text-center text-sm text-destructive">
            This file is unavailable.
          </p>
        )}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Shared via {APP_NAME}
      </p>
    </main>
  )
}
