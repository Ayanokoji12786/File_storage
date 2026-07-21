'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  Download,
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Loader2,
  Lock,
  MoreVertical,
  Music,
  NotebookPen,
  Pencil,
  Share2,
  Trash2,
  Video,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CATEGORY_META } from '@/lib/constants'
import { decompressBlob } from '@/lib/compression'
import { isDraftlyEligible } from '@/lib/draftly'
import { decryptBlob } from '@/lib/encryption'
import { formatBytes, formatDate } from '@/lib/file-utils'
import {
  isAvailableOffline,
  removeFileOffline,
  saveFileOffline,
} from '@/lib/offline-store'
import type { DriveFile, FileCategory } from '@/types'

import { DraftlyDialog } from '@/features/draftly/components/draftly-dialog'

import { deleteFile, getDownloadUrl } from '../actions'
import { PassphraseDialog } from './passphrase-dialog'
import { PreviewDialog } from './preview-dialog'
import { RenameDialog } from './rename-dialog'
import { ShareDialog } from './share-dialog'

const CATEGORY_ICON: Record<FileCategory, LucideIcon> = {
  image: ImageIcon,
  document: FileText,
  video: Video,
  audio: Music,
  other: FileIcon,
}

export function FileCard({
  file,
  viewerIsOwner = true,
}: {
  file: DriveFile
  viewerIsOwner?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [passphraseOpen, setPassphraseOpen] = useState(false)
  const [passphraseError, setPassphraseError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [draftlyOpen, setDraftlyOpen] = useState(false)
  // Starts false to match the server-rendered HTML (Cache Storage doesn't
  // exist server-side), then syncs to the real value after mount.
  const [offline, setOffline] = useState(false)
  const [offlinePending, setOfflinePending] = useState(false)
  const Icon = CATEGORY_ICON[file.category]
  const draftlyEligible =
    viewerIsOwner &&
    Boolean(process.env.NEXT_PUBLIC_DRAFTLY_URL) &&
    isDraftlyEligible(file.name, file.isEncrypted, file.isCompressed)
  const meta = CATEGORY_META[file.category]

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a client-only store (Cache Storage) after mount; the initial false avoids a hydration mismatch
    setOffline(isAvailableOffline(file.id))
  }, [file.id])

  async function toggleOffline() {
    setOfflinePending(true)
    try {
      if (offline) {
        await removeFileOffline(file.id)
        setOffline(false)
        toast.success('Removed offline copy')
        return
      }
      const result = await getDownloadUrl(file.id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      const res = await fetch(result.url)
      let blob = await res.blob()
      if (file.isCompressed) blob = await decompressBlob(blob, file.originalMimeType ?? file.mimeType)
      await saveFileOffline(
        { id: file.id, name: file.name, size: blob.size, mimeType: file.originalMimeType ?? file.mimeType, category: file.category },
        blob,
      )
      setOffline(true)
      toast.success('Available offline')
    } catch {
      toast.error('Could not save this file offline.')
    } finally {
      setOfflinePending(false)
    }
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteFile(file.id)
      if ('error' in result) toast.error(result.error)
      else toast.success('Moved to Trash')
    })
  }

  function saveBlob(blob: Blob) {
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = file.name
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  }

  function handleDownload() {
    if (file.isEncrypted) {
      setPassphraseError(null)
      setPassphraseOpen(true)
      return
    }

    startTransition(async () => {
      const result = await getDownloadUrl(file.id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }

      if (file.isCompressed) {
        try {
          const res = await fetch(result.url)
          const compressed = await res.blob()
          const decompressed = await decompressBlob(compressed, file.originalMimeType ?? file.mimeType)
          saveBlob(decompressed)
        } catch {
          toast.error('Could not decompress this file.')
        }
        return
      }

      const anchor = document.createElement('a')
      anchor.href = result.url
      anchor.download = file.name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    })
  }

  async function unlockAndDownload(passphrase: string) {
    if (!file.encryptionIv || !file.encryptionSalt) return
    setUnlocking(true)
    setPassphraseError(null)
    try {
      const result = await getDownloadUrl(file.id)
      if ('error' in result) throw new Error(result.error)
      const res = await fetch(result.url)
      const ciphertext = await res.blob()
      const decrypted = await decryptBlob(
        ciphertext,
        passphrase,
        file.encryptionIv,
        file.encryptionSalt,
        file.originalMimeType ?? file.mimeType,
      )
      saveBlob(decrypted)
      setPassphraseOpen(false)
    } catch (err) {
      setPassphraseError(err instanceof Error ? err.message : 'Could not decrypt this file.')
    } finally {
      setUnlocking(false)
    }
  }

  return (
    <>
      <div
        onClick={() => setPreviewOpen(true)}
        className="group relative cursor-pointer rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex items-start justify-between">
          {file.thumbnailPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- private, per-user thumbnail served from our API route, not eligible for next/image's remote optimizer
            <img
              src={`/api/thumbnail/${file.id}`}
              alt=""
              className="size-11 rounded-full object-cover"
            />
          ) : (
            <span
              className={`grid size-11 place-items-center rounded-full ${meta.bg}`}
            >
              {file.isEncrypted ? (
                <Lock className="size-5 text-white" />
              ) : (
                <Icon className="size-5 text-white" />
              )}
            </span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label="File actions"
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MoreVertical className="size-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem onSelect={handleDownload}>
                <Download className="size-4" />
                Download
              </DropdownMenuItem>
              {draftlyEligible && (
                <DropdownMenuItem onSelect={() => setDraftlyOpen(true)}>
                  <NotebookPen className="size-4" />
                  Open with Draftly
                </DropdownMenuItem>
              )}
              {!file.isEncrypted && (
                <DropdownMenuItem onSelect={toggleOffline} disabled={offlinePending}>
                  <WifiOff className="size-4" />
                  {offline ? 'Remove offline copy' : 'Make available offline'}
                </DropdownMenuItem>
              )}
              {viewerIsOwner && (
                <>
                  <DropdownMenuItem onSelect={() => setShareOpen(true)}>
                    <Share2 className="size-4" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                    <Pencil className="size-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
                    <Trash2 className="size-4" />
                    Move to Trash
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="mt-3 truncate font-medium" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(file.originalSize)} · {formatDate(file.createdAt)}
        </p>
      </div>

      <PreviewDialog
        file={file}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onOpenWithDraftly={draftlyEligible ? () => setDraftlyOpen(true) : undefined}
      />
      <RenameDialog file={file} open={renameOpen} onOpenChange={setRenameOpen} />
      <ShareDialog file={file} open={shareOpen} onOpenChange={setShareOpen} />
      {draftlyEligible && (
        <DraftlyDialog fileId={file.id} open={draftlyOpen} onOpenChange={setDraftlyOpen} />
      )}
      <PassphraseDialog
        open={passphraseOpen}
        onOpenChange={setPassphraseOpen}
        onSubmit={unlockAndDownload}
        fileName={file.name}
        error={passphraseError}
        pending={unlocking}
      />
    </>
  )
}
