'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import {
  CheckCircle2,
  CircleAlert,
  Copy,
  Loader2,
  Lock,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { compressBlob, isCompressible, MIN_COMPRESSIBLE_SIZE } from '@/lib/compression'
import {
  CHUNK_UPLOAD_THRESHOLD,
  MAX_COMPRESS_SIZE,
  MAX_ENCRYPT_SIZE,
  MAX_FILE_SIZE,
} from '@/lib/constants'
import { encryptBlob } from '@/lib/encryption'
import { formatBytes } from '@/lib/file-utils'
import { sha256Hex } from '@/lib/hash'
import { broadcastUploadProgress } from '@/lib/realtime/upload-channel'
import { uploadToStorage, uploadToStorageChunked } from '@/lib/storage'
import { createClient } from '@/lib/supabase/client'
import { canThumbnail, generateImageThumbnail } from '@/lib/thumbnail'
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
  const [encryptEnabled, setEncryptEnabled] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  // Files parked as duplicates, kept around for "Upload anyway".
  const parked = useRef(new Map<string, { file: File; hash: string | null }>())
  const locked = items.length > 0
  const passphraseValid = passphrase.length >= 8 && passphrase === confirmPassphrase

  function patch(id: string, changes: Partial<UploadItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...changes } : it)))
  }

  async function uploadOne(
    itemId: string,
    file: File,
    hash: string | null,
    session: Session,
    encrypting: boolean,
  ) {
    patch(itemId, { status: 'uploading', progress: 0 })
    const userId = session.user.id

    function report(
      percent: number,
      status: 'uploading' | 'done' | 'error' | 'cancelled' = 'uploading',
    ) {
      patch(itemId, { progress: percent })
      void broadcastUploadProgress(userId, { id: itemId, name: file.name, percent, status })
    }

    const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''
    const path = `${userId}/${crypto.randomUUID()}${ext}`

    let uploadBlob: Blob = file
    let contentType = file.type || 'application/octet-stream'
    let isEncrypted = false
    let isCompressed = false
    let encryptionIv: string | undefined
    let encryptionSalt: string | undefined
    let thumbnailPath: string | undefined

    if (encrypting) {
      const encrypted = await encryptBlob(file, passphrase)
      uploadBlob = encrypted.ciphertext
      contentType = 'application/octet-stream'
      isEncrypted = true
      encryptionIv = encrypted.iv
      encryptionSalt = encrypted.salt
    } else {
      if (canThumbnail(file.type)) {
        const thumb = await generateImageThumbnail(file)
        if (thumb) {
          const thumbPath = `${userId}/thumbnails/${crypto.randomUUID()}.webp`
          await uploadToStorage({ token: session.access_token, path: thumbPath, file: thumb })
          thumbnailPath = thumbPath
        }
      }

      if (
        isCompressible(file.type, file.name) &&
        file.size > MIN_COMPRESSIBLE_SIZE &&
        file.size <= MAX_COMPRESS_SIZE
      ) {
        const compressed = await compressBlob(file)
        if (compressed.size < file.size) {
          uploadBlob = compressed
          contentType = 'application/gzip'
          isCompressed = true
        }
      }
    }

    if (uploadBlob.size >= CHUNK_UPLOAD_THRESHOLD) {
      await uploadToStorageChunked({
        token: session.access_token,
        path,
        file: uploadBlob,
        contentType,
        onProgress: (percent) => report(percent),
      })
    } else {
      await uploadToStorage({
        token: session.access_token,
        path,
        file: uploadBlob,
        onProgress: (percent) => report(percent),
      })
    }

    const result = await registerUpload({
      storagePath: path,
      name: file.name,
      // Advisory only — the server re-reads the real size from Storage.
      size: uploadBlob.size,
      // What the user actually picked, so compressed files display honestly.
      originalSize: file.size,
      mimeType: contentType,
      contentHash: hash ?? undefined,
      isEncrypted,
      encryptionIv,
      encryptionSalt,
      isCompressed,
      originalMimeType: isEncrypted || isCompressed ? file.type : undefined,
      thumbnailPath,
    })
    if ('error' in result) throw new Error(result.error)

    // Skip AI indexing for encrypted (server never sees plaintext) and
    // compressed (server-side extraction expects the raw format) uploads.
    if (!isEncrypted && !isCompressed) {
      void indexFile(result.fileId).catch(() => {})
    }

    report(100, 'done')
    patch(itemId, { status: 'done' })
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    if (encryptEnabled && !passphraseValid) {
      toast.error('Enter matching passphrases (min 8 characters) before uploading.')
      return
    }
    // Snapshot now: the caller may reset the input (emptying this live
    // FileList) before the async loop below runs.
    const files = Array.from(fileList)
    const encrypting = encryptEnabled

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

      const tooLarge = file.size > MAX_FILE_SIZE
      const tooLargeToEncrypt = encrypting && file.size > MAX_ENCRYPT_SIZE
      if (tooLarge || tooLargeToEncrypt) {
        setItems((prev) => [
          ...prev,
          {
            id: itemId,
            name: file.name,
            progress: 0,
            status: 'error',
            error: tooLarge
              ? `Too large (max ${formatBytes(MAX_FILE_SIZE)})`
              : `Encrypted uploads max ${formatBytes(MAX_ENCRYPT_SIZE)}`,
          },
        ])
        continue
      }

      setItems((prev) => [
        ...prev,
        { id: itemId, name: file.name, progress: 0, status: 'checking' },
      ])

      try {
        // null for very large files — dedup is skipped rather than OOM-ing.
        const hash = await sha256Hex(file)
        const { duplicate } = hash
          ? await findDuplicate(hash)
          : { duplicate: null }

        if (duplicate) {
          parked.current.set(itemId, { file, hash })
          patch(itemId, { status: 'duplicate', duplicateOf: duplicate.name })
          continue
        }

        await uploadOne(itemId, file, hash, session, encrypting)
      } catch (err) {
        patch(itemId, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        })
        void broadcastUploadProgress(session.user.id, {
          id: itemId,
          name: file.name,
          percent: 0,
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
      await uploadOne(itemId, entry.file, entry.hash, session, encryptEnabled)
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
          setEncryptEnabled(false)
          setPassphrase('')
          setConfirmPassphrase('')
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

        <div className="space-y-2 rounded-xl border p-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="encrypt-toggle" className="flex items-center gap-2 font-normal">
              <Lock className="size-4 text-muted-foreground" />
              Encrypt these uploads
            </Label>
            <Switch
              id="encrypt-toggle"
              checked={encryptEnabled}
              onCheckedChange={setEncryptEnabled}
              disabled={locked}
            />
          </div>
          {encryptEnabled && (
            <div className="space-y-2 pt-1">
              <Input
                type="password"
                placeholder="Passphrase (min 8 characters)"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                disabled={locked}
              />
              <Input
                type="password"
                placeholder="Confirm passphrase"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                disabled={locked}
              />
              <p className="text-xs text-muted-foreground">
                We never see this passphrase and can’t recover it — write it down.
              </p>
            </div>
          )}
        </div>

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
