'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, CircleAlert, Loader2, UploadCloud, X } from 'lucide-react'

import { Progress } from '@/components/ui/progress'
import {
  subscribeUploadProgress,
  type UploadBroadcastPayload,
} from '@/lib/realtime/upload-channel'
import { cn } from '@/lib/utils'

/**
 * Floating panel that mirrors upload progress broadcast on the
 * `uploads:{userId}` realtime channel — including uploads started from
 * another tab or device signed into the same account.
 */
export function UploadProgressWidget({ userId }: { userId: string }) {
  const [items, setItems] = useState<Record<string, UploadBroadcastPayload>>({})
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    return subscribeUploadProgress(userId, (item) => {
      setItems((prev) => ({ ...prev, [item.id]: item }))
      if (item.status === 'done') {
        setTimeout(() => {
          setDismissed((prev) => new Set(prev).add(item.id))
        }, 4000)
      }
    })
  }, [userId])

  const visible = Object.values(items)
    .filter((item) => !dismissed.has(item.id))
    .sort((a) => (a.status === 'uploading' ? -1 : 1))

  if (visible.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 space-y-2 rounded-2xl border bg-card p-3 shadow-lg">
      <div className="flex items-center gap-2 px-1 text-sm font-medium">
        <UploadCloud className="size-4 text-primary" />
        Uploads
      </div>
      <ul className="max-h-64 space-y-2 overflow-y-auto">
        {visible.map((item) => (
          <li key={item.id} className="rounded-xl bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs">
              <StatusIcon status={item.status} />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <button
                type="button"
                onClick={() =>
                  setDismissed((prev) => new Set(prev).add(item.id))
                }
                className="text-muted-foreground hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="size-3.5" />
              </button>
            </div>
            {(item.status === 'uploading' || item.status === 'done') && (
              <Progress
                value={item.percent}
                className={cn('mt-1.5 h-1', item.status === 'done' && 'opacity-60')}
              />
            )}
            {item.status === 'error' && (
              <p className="mt-1 text-xs text-destructive">{item.error ?? 'Upload failed'}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function StatusIcon({ status }: { status: UploadBroadcastPayload['status'] }) {
  if (status === 'done') return <CheckCircle2 className="size-3.5 text-emerald-500" />
  if (status === 'error' || status === 'cancelled')
    return <CircleAlert className="size-3.5 text-destructive" />
  return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
}
