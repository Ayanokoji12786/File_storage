'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, QrCode, Send } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { DriveFile } from '@/types'

import { setFilePublic, shareFileWithUser } from '../actions'
import { QrCodePanel } from './qr-code-panel'

export function ShareDialog({
  file,
  open,
  onOpenChange,
}: {
  file: DriveFile
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [isPublic, setIsPublic] = useState(file.isPublic)
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isSharing, startSharing] = useTransition()

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/share/${file.id}`
      : ''

  function toggle(next: boolean) {
    startTransition(async () => {
      const result = await setFilePublic(file.id, next)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setIsPublic(next)
      if (!next) setShowQr(false)
      toast.success(next ? 'Link sharing on' : 'Link sharing off')
    })
  }

  async function copy() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    toast.success('Link copied')
    setTimeout(() => setCopied(false), 1500)
  }

  function share(e: React.FormEvent) {
    e.preventDefault()
    const target = email.trim()
    if (!target) return
    startSharing(async () => {
      const result = await shareFileWithUser(file.id, target)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(`Shared with ${target}`)
      setEmail('')
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share “{file.name}”</DialogTitle>
          <DialogDescription>
            Share directly with a person, or turn on a public link.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={share} className="flex gap-2">
          <Input
            type="email"
            placeholder="Share with an email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSharing}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isSharing || !email.trim()}>
            <Send className="size-4" />
          </Button>
        </form>

        <div className="flex items-center justify-between rounded-xl border p-4">
          <Label htmlFor="share-toggle" className="font-normal">
            Public link
          </Label>
          <Switch
            id="share-toggle"
            checked={isPublic}
            onCheckedChange={toggle}
            disabled={isPending}
          />
        </div>

        {isPublic && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={shareUrl} className="flex-1" />
              <Button type="button" variant="outline" size="icon" onClick={copy}>
                {copied ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowQr((v) => !v)}
                aria-label="Show QR code"
              >
                <QrCode className="size-4" />
              </Button>
            </div>
            {showQr && <QrCodePanel value={shareUrl} fileName={file.name} />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
