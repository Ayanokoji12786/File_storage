'use client'

import { useEffect, useState } from 'react'
import { Download, Trash2, WifiOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CATEGORY_META } from '@/lib/constants'
import { formatBytes } from '@/lib/file-utils'
import {
  getOfflineFileUrl,
  getOfflineIndex,
  removeFileOffline,
  type OfflineFileMeta,
} from '@/lib/offline-store'
import type { FileCategory } from '@/types'

export default function OfflinePage() {
  // Starts empty to match the server-rendered HTML (Cache Storage doesn't
  // exist server-side), then syncs to the real value after mount.
  const [files, setFiles] = useState<OfflineFileMeta[]>([])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a client-only store (Cache Storage) after mount; the initial [] avoids a hydration mismatch
    setFiles(getOfflineIndex())
  }, [])

  async function open(file: OfflineFileMeta) {
    const url = await getOfflineFileUrl(file.id)
    if (url) window.open(url, '_blank')
  }

  async function remove(id: string) {
    await removeFileOffline(id)
    setFiles(getOfflineIndex())
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Offline files</h1>
        <p className="text-muted-foreground">
          {files.length} {files.length === 1 ? 'file' : 'files'} saved to this device
        </p>
      </div>

      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed p-16 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <WifiOff className="size-7" />
          </div>
          <p className="font-medium">No offline files yet</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Use “Make available offline” on a file to keep a copy on this device.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {files.map((file) => {
            const meta = CATEGORY_META[(file.category as FileCategory) || 'other']
            return (
              <div key={file.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <span className={`grid size-11 place-items-center rounded-full ${meta.bg}`}>
                  <WifiOff className="size-5 text-white" />
                </span>
                <p className="mt-3 truncate font-medium" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1"
                    onClick={() => open(file)}
                  >
                    <Download className="size-3.5" />
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(file.id)}
                    aria-label="Remove offline copy"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
