'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export function PassphraseDialog({
  open,
  onOpenChange,
  onSubmit,
  fileName,
  error,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (passphrase: string) => void
  fileName: string
  error?: string | null
  pending?: boolean
}) {
  const [value, setValue] = useState('')

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setValue('')
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="size-4" />
            Encrypted file
          </DialogTitle>
          <DialogDescription>
            Enter the passphrase used to encrypt “{fileName}”.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit(value)
          }}
          className="space-y-3"
        >
          <Input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Passphrase"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={pending || !value}>
            {pending ? 'Unlocking…' : 'Unlock'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
