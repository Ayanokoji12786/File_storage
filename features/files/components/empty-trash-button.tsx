'use client'

import { useTransition } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import { emptyTrash } from '../actions'

export function EmptyTrashButton() {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!window.confirm("Permanently delete everything in Trash? This can't be undone.")) return
    startTransition(async () => {
      const result = await emptyTrash()
      if ('error' in result) toast.error(result.error)
      else toast.success('Trash emptied')
    })
  }

  return (
    <Button variant="outline" className="gap-2" disabled={isPending} onClick={handleClick}>
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      Empty Trash
    </Button>
  )
}
