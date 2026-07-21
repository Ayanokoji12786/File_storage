'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import { getDraftlyContent } from '../actions'

const DRAFTLY_URL = process.env.NEXT_PUBLIC_DRAFTLY_URL
const DRAFTLY_ORIGIN = DRAFTLY_URL ? new URL(DRAFTLY_URL).origin : null

/** How long to wait for the handshake before offering a fallback — covers
 * cases where the iframe can't complete it at all (e.g. a browser blocking
 * Draftly's session cookie as third-party), which would otherwise spin
 * forever with no feedback. */
const STUCK_TIMEOUT_MS = 8_000

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
  const [stuck, setStuck] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
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

  // If the handshake hasn't completed within STUCK_TIMEOUT_MS, stop spinning
  // forever and offer a way out — most commonly hit when a browser blocks
  // Draftly's session cookie inside the iframe as third-party.
  useEffect(() => {
    if (!open || !DRAFTLY_ORIGIN || sent || error) return
    const timer = setTimeout(() => setStuck(true), STUCK_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [open, sent, error, retryKey])

  function handleOpenChange(next: boolean) {
    if (!next) {
      setError(null)
      setPayload(null)
      setIframeReady(false)
      setSent(false)
      setStuck(false)
      setRetryKey(0)
    }
    onOpenChange(next)
  }

  function retry() {
    setIframeReady(false)
    setSent(false)
    setStuck(false)
    setRetryKey((k) => k + 1)
  }

  function openInNewTab() {
    if (DRAFTLY_URL) window.open(DRAFTLY_URL, '_blank', 'noopener,noreferrer')
    handleOpenChange(false)
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
        ) : stuck ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              This is taking longer than expected — some browsers block
              Draftly&apos;s sign-in when it&apos;s embedded like this. You can
              open it directly instead (your document won&apos;t be pre-filled
              with this file&apos;s content there), or try loading it here again.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={retry}>
                <RotateCw className="size-3.5" />
                Try again
              </Button>
              <Button size="sm" className="gap-1.5" onClick={openInNewTab}>
                <ExternalLink className="size-3.5" />
                Open Draftly in a new tab
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative flex-1">
            {!sent && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <iframe
              key={retryKey}
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
