import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppTopbar } from '@/components/layout/app-topbar'
import { getStorageStats } from '@/lib/data/files'
import { requireUser } from '@/lib/dal'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Secure gate: redirects to /sign-in if there's no session (proxy handles the
  // optimistic redirect; this is the authoritative check).
  const [user, stats] = await Promise.all([requireUser(), getStorageStats()])

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-64 shrink-0 border-r lg:block">
        <div className="sticky top-0 h-dvh">
          <AppSidebar user={user} storageUsed={stats.totalSize} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar user={user} storageUsed={stats.totalSize} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
