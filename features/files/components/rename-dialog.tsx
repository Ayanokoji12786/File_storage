'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { renameSchema, type RenameInput } from '@/lib/validations/files'
import type { DriveFile } from '@/types'

import { renameFile } from '../actions'

export function RenameDialog({
  file,
  open,
  onOpenChange,
}: {
  file: DriveFile
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RenameInput>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: file.name },
  })

  function onSubmit(values: RenameInput) {
    startTransition(async () => {
      const result = await renameFile(file.id, values.name)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('File renamed')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset({ name: file.name })
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename file</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename-input">Name</Label>
            <Input id="rename-input" autoFocus {...register('name')} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
