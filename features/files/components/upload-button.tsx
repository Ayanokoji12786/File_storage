'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import {
  CheckCircle2,
  CircleAlert,
  Copy,
  Loader2,
  UploadCloud,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { MAX_FILE_SIZE } from '@/lib/constants'
import { formatBytes } from '@/lib/file-utils'
import { sha256Hex } from '@/lib/hash'
import { uploadToStorage } from '@/lib/storage'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

import { indexFile } from '@/features/ai/actions'

import { findDuplicate, registerUpload } from '../actions'

interface UploadItem {
  id: string
  name: string
  progress: number
  status: 'checking' | 'uploading' | 'duplicate' | 'done' | 'error'
  error?: string
  duplicateOf?: string
}

export function UploadButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Files parked as duplicates, kept around for "Upload anyway".
  const parked = useRef(new Map<string, { file: File; hash: string }>())

  function patch(id: string, changes: Partial<UploadItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...changes } : it)))
  }

  async function uploadOne(
    itemId: string,
    file: File,
    hash: string,
    session: Session,
  ) {
    patch(itemId, { status: 'uploading', progress: 0 })

    const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''
    const path = `${session.user.id}/${crypto.randomUUID()}${ext}`

    await uploadToStorage({
      token: session.access_token,
      path,
      file,
      onProgress: (percent) => patch(itemId, { progress: percent }),
    })

    const result = await registerUpload({
      storagePath: path,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      contentHash: hash,
    })
    if ('error' in result) throw new Error(result.error)

    // Kick off AI indexing in the background — never blocks the upload UI.
    void indexFile(result.fileId).catch(() => {})

    patch(itemId, { progress: 100, status: 'done' })
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    // Snapshot now: the caller may reset the input (emptying this live
    // FileList) before the async loop below runs.
    const files = Array.from(fileList)

    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      toast.error('Your session expired — please sign in again.')
      return
    }

    for (const file of files) {
      const itemId = crypto.randomUUID()

      if (file.size > MAX_FILE_SIZE) {
        setItems((prev) => [
          ...prev,
          {
            id: itemId,
            name: file.name,
            progress: 0,
            status: 'error',
            error: `Too large (max ${formatBytes(MAX_FILE_SIZE)})`,
          },
        ])
        continue
      }

      setItems((prev) => [
        ...prev,
        { id: itemId, name: file.name, progress: 0, status: 'checking' },
      ])

      try {
        const hash = await sha256Hex(file)
        const { duplicate } = await findDuplicate(hash)

        if (duplicate) {
          parked.current.set(itemId, { file, hash })
          patch(itemId, { status: 'duplicate', duplicateOf: duplicate.name })
          continue
        }

        await uploadOne(itemId, file, hash, session)
      } catch (err) {
        patch(itemId, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        })
      }
    }

    router.refresh()
  }

  async function uploadAnyway(itemId: string) {
    const entry = parked.current.get(itemId)
    if (!entry) return
    parked.current.delete(itemId)

    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      toast.error('Your session expired — please sign in again.')
      return
    }

    try {
      await uploadOne(itemId, entry.file, entry.hash, session)
      router.refresh()
    } catch (err) {
      patch(itemId, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed',
      })
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setItems([])
          parked.current.clear()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UploadCloud className="size-4" />
          Upload
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription>
            Drag &amp; drop, or browse. Max {formatBytes(MAX_FILE_SIZE)} per file.
          </DialogDescription>
        </DialogHeader>

        {/* Dropzone */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFiles(e.dataTransfer.files)
          }}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-sm text-muted-foreground transition-colors',
            dragging ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted',
          )}
        >
          <UploadCloud className="size-8" />
          <span>
            <span className="font-medium text-foreground">Click to browse</span> or
            drag files here
          </span>
        </button>

        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />

        {items.length > 0 && (
          <ul className="max-h-56 space-y-3 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id} className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <StatusIcon status={item.status} />
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  {item.status === 'duplicate' ? (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => uploadAnyway(item.id)}
                    >
                      Upload anyway
                    </Button>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.status === 'error'
                        ? item.error
                        : item.status === 'checking'
                          ? 'Checking…'
                          : `${item.progress}%`}
                    </span>
                  )}
                </div>
                {item.status === 'duplicate' && (
                  <p className="pl-6 text-xs text-amber-600 dark:text-amber-500">
                    Duplicate of “{item.duplicateOf}” — skipped
                  </p>
                )}
                {(item.status === 'uploading' || item.status === 'done') && (
                  <Progress value={item.progress} className="h-1.5" />
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StatusIcon({ status }: { status: UploadItem['status'] }) {
  if (status === 'done') return <CheckCircle2 className="size-4 text-emerald-500" />
  if (status === 'error') return <CircleAlert className="size-4 text-destructive" />
  if (status === 'duplicate')
    return <Copy className="size-4 text-amber-600 dark:text-amber-500" />
  return <Loader2 className="size-4 animate-spin text-muted-foreground" />
}
