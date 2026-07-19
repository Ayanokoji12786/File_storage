'use client'

import { useState, useTransition } from 'react'
import { Check, Copy } from 'lucide-react'
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

import { setFilePublic } from '../actions'

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
  const [isPending, startTransition] = useTransition()

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
      toast.success(next ? 'Link sharing on' : 'Link sharing off')
    })
  }

  async function copy() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    toast.success('Link copied')
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share “{file.name}”</DialogTitle>
          <DialogDescription>
            Anyone with the link can view and download this file.
          </DialogDescription>
        </DialogHeader>

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
          <div className="flex gap-2">
            <Input readOnly value={shareUrl} className="flex-1" />
            <Button type="button" variant="outline" size="icon" onClick={copy}>
              {copied ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
