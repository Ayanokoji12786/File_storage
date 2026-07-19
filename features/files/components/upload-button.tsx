'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, CircleAlert, Loader2, UploadCloud } from 'lucide-react'
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
import { uploadToStorage } from '@/lib/storage'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

import { registerUpload } from '../actions'

interface UploadItem {
  id: string
  name: string
  progress: number
  status: 'uploading' | 'done' | 'error'
  error?: string
}

export function UploadButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function patch(id: string, changes: Partial<UploadItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...changes } : it)))
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
        { id: itemId, name: file.name, progress: 0, status: 'uploading' },
      ])

      const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''
      const path = `${session.user.id}/${crypto.randomUUID()}${ext}`

      try {
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
        })
        if ('error' in result) throw new Error(result.error)

        patch(itemId, { progress: 100, status: 'done' })
      } catch (err) {
        patch(itemId, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        })
      }
    }

    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setItems([])
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
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {item.status === 'error' ? item.error : `${item.progress}%`}
                  </span>
                </div>
                {item.status !== 'error' && (
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
  return <Loader2 className="size-4 animate-spin text-muted-foreground" />
}
