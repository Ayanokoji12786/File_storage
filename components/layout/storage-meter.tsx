import { HardDrive } from 'lucide-react'

import { Progress } from '@/components/ui/progress'
import { STORAGE_QUOTA } from '@/lib/constants'
import { formatBytes } from '@/lib/file-utils'

/**
 * Shows how much of the user's quota is used. `used` is wired up for real once
 * the files feature lands; defaults to 0 for now.
 */
export function StorageMeter({ used = 0 }: { used?: number }) {
  const percent = Math.min(100, Math.round((used / STORAGE_QUOTA) * 100))

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <HardDrive className="size-4 text-muted-foreground" />
        Storage
      </div>
      <Progress value={percent} className="mt-3 h-2" />
      <p className="mt-2 text-xs text-muted-foreground">
        {formatBytes(used)} of {formatBytes(STORAGE_QUOTA)} used
      </p>
    </div>
  )
}
