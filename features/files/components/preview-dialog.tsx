'use client'

import { useEffect, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Loader2, Lock, NotebookPen } from 'lucide-react'

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
} from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { decompressBlob } from '@/lib/compression'
import { decryptBlob } from '@/lib/encryption'
import { createClient } from '@/lib/supabase/client'
import type { DriveFile } from '@/types'

import { getPreviewUrl } from '../actions'
import { FilePreview } from './file-preview'

interface Viewer {
  name: string
}

export function PreviewDialog({
  file,
  open,
  onOpenChange,
  onOpenWithDraftly,
}: {
  file: DriveFile
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present only when the file is eligible — renders an "Open with Draftly" button. */
  onOpenWithDraftly?: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [passphrase, setPassphrase] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [viewers, setViewers] = useState<Viewer[]>([])

  const needsPassphrase = file.isEncrypted && !objectUrl

  useEffect(() => {
    if (!open) return
    let active = true

    async function load() {
      setUrl(null)
      setError(null)
      setPassphrase('')

      const result = await getPreviewUrl(file.id)
      if (!active) return
      if ('error' in result) {
        setError(result.error)
        return
      }

      if (file.isEncrypted) {
        // Wait for the passphrase form instead of auto-loading.
        setUrl(result.url)
        return
      }

      if (file.isCompressed) {
        try {
          const res = await fetch(result.url)
          const compressed = await res.blob()
          const decompressed = await decompressBlob(compressed, file.originalMimeType ?? file.mimeType)
          if (!active) return
          const blobUrl = URL.createObjectURL(decompressed)
          setObjectUrl(blobUrl)
        } catch {
          if (active) setError('Could not decompress this file.')
        }
        return
      }

      setUrl(result.url)
    }
    load()

    return () => {
      active = false
    }
  }, [open, file.id, file.isEncrypted, file.isCompressed, file.originalMimeType, file.mimeType])

  // Revoke blob URLs on unmount/change to avoid leaking memory.
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  function handleOpenChange(next: boolean) {
    if (!next && objectUrl) {
      URL.revokeObjectURL(objectUrl)
      setObjectUrl(null)
    }
    onOpenChange(next)
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault()
    if (!url || !file.encryptionIv || !file.encryptionSalt) return
    setUnlocking(true)
    setError(null)
    try {
      const res = await fetch(url)
      const ciphertext = await res.blob()
      const decrypted = await decryptBlob(
        ciphertext,
        passphrase,
        file.encryptionIv,
        file.encryptionSalt,
        file.originalMimeType ?? file.mimeType,
      )
      setObjectUrl(URL.createObjectURL(decrypted))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not decrypt this file.')
    } finally {
      setUnlocking(false)
    }
  }

  // Collaborative presence: who else has this file open right now.
  useEffect(() => {
    if (!open) return
    let active = true
    const supabase = createClient()
    let channel: RealtimeChannel | null = null

    async function join() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!active || !session) return

      // Feed the socket the JWT before joining this private (RLS-gated) channel,
      // otherwise the subscribe races auth setup and silently fails.
      await supabase.realtime.setAuth(session.access_token)

      channel = supabase.channel(`presence:file:${file.id}`, {
        // `private` gates joins behind Realtime Authorization, so only users
        // who can actually see this file can see who's viewing it.
        config: { presence: { key: session.user.id }, private: true },
      })
      channel.on('presence', { event: 'sync' }, () => {
        if (!channel) return
        const state = channel.presenceState<Viewer>()
        const others = Object.entries(state)
          .filter(([key]) => key !== session.user.id)
          .map(([, metas]) => metas[0])
          .filter(Boolean)
        if (active) setViewers(others)
      })
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && channel) {
          const name =
            (session.user.user_metadata?.full_name as string | undefined) ||
            session.user.email ||
            'Someone'
          await channel.track({ name })
        }
      })
    }
    join()

    return () => {
      active = false
      setViewers([])
      if (channel) supabase.removeChannel(channel)
    }
  }, [open, file.id])

  const previewUrl = objectUrl ?? (file.isEncrypted || file.isCompressed ? null : url)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="flex-row items-center justify-between gap-4 space-y-0 pr-6">
          <DialogTitle className="min-w-0 flex-1 truncate">{file.name}</DialogTitle>
          <div className="flex shrink-0 items-center gap-3">
            {onOpenWithDraftly && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onOpenWithDraftly}>
                <NotebookPen className="size-3.5" />
                Open with Draftly
              </Button>
            )}
            {viewers.length > 0 && (
              <AvatarGroup>
                {viewers.slice(0, 4).map((viewer, i) => (
                  <Avatar key={i} size="sm" title={`${viewer.name} is viewing`}>
                    <AvatarFallback>{viewer.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                ))}
              </AvatarGroup>
            )}
          </div>
        </DialogHeader>

        {error && !needsPassphrase ? (
          <p className="py-10 text-center text-sm text-destructive">{error}</p>
        ) : needsPassphrase ? (
          <form onSubmit={unlock} className="space-y-3 py-6">
            <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
              <Lock className="size-8" />
              <p className="text-sm">This file is encrypted. Enter the passphrase to view it.</p>
            </div>
            <Input
              type="password"
              autoFocus
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Passphrase"
              className="mx-auto max-w-xs"
            />
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
            <div className="flex justify-center">
              <Button type="submit" disabled={unlocking || !passphrase}>
                {unlocking ? 'Unlocking…' : 'Unlock'}
              </Button>
            </div>
          </form>
        ) : previewUrl ? (
          <FilePreview
            file={{
              name: file.name,
              mimeType: file.originalMimeType ?? file.mimeType,
              category: file.category,
              size: file.size,
            }}
            url={previewUrl}
          />
        ) : (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
