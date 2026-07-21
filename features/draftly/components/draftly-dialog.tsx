'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import { getDraftlyContent } from '../actions'

const DRAFTLY_URL = process.env.NEXT_PUBLIC_DRAFTLY_URL
const DRAFTLY_ORIGIN = DRAFTLY_URL ? new URL(DRAFTLY_URL).origin : null

interface Payload {
  title: string
  content: string
}

/**
 * Embeds Draftly (a separately-deployed Google-Docs-style editor) in an
 * iframe, seeded with the file's extracted text via postMessage. See
 * draftly/src/app/import/page.tsx on the Draftly side for the other half of
 * this handshake.
 */
export function DraftlyDialog({
  fileId,
  open,
  onOpenChange,
}: {
  fileId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<Payload | null>(null)
  const [iframeReady, setIframeReady] = useState(false)
  const [sent, setSent] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Fetch the file's extracted text whenever the dialog opens.
  useEffect(() => {
    if (!open || !DRAFTLY_ORIGIN) return
    let active = true
    getDraftlyContent(fileId).then((result) => {
      if (!active) return
      if ('error' in result) setError(result.error)
      else setPayload(result)
    })
    return () => {
      active = false
    }
  }, [open, fileId])

  // Listen for the iframe announcing it's mounted and ready to receive content.
  useEffect(() => {
    if (!open || !DRAFTLY_ORIGIN) return
    function onMessage(event: MessageEvent) {
      if (event.origin !== DRAFTLY_ORIGIN) return
      if (event.data?.type === 'draftly:ready') setIframeReady(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [open])

  // Once both the extracted content and the iframe are ready, seed exactly once.
  useEffect(() => {
    if (sent || !payload || !iframeReady || !DRAFTLY_ORIGIN) return
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.postMessage(
      { type: 'draftly:seed', title: payload.title, content: payload.content },
      DRAFTLY_ORIGIN,
    )
    setSent(true)
  }, [payload, iframeReady, sent])

  function handleOpenChange(next: boolean) {
    if (!next) {
      setError(null)
      setPayload(null)
      setIframeReady(false)
      setSent(false)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-5xl flex-col gap-0 p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Draftly</DialogTitle>
        </DialogHeader>
        {!DRAFTLY_URL ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-destructive">
            Draftly is not configured for this app.
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="relative flex-1">
            {!sent && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={`${DRAFTLY_URL}/import`}
              className="size-full rounded-b-2xl border-0"
              title="Draftly"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
