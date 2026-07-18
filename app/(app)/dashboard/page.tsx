import type { Metadata } from 'next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CATEGORY_META, FILE_CATEGORIES } from '@/lib/constants'
import { requireUser } from '@/lib/dal'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const user = await requireUser()
  const firstName = user.name?.split(' ')[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back{firstName ? `, ${firstName}` : ''} 👋
        </h1>
        <p className="text-muted-foreground">Here&apos;s an overview of your storage.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FILE_CATEGORIES.filter((c) => c !== 'other').map((category) => {
          const meta = CATEGORY_META[category]
          return (
            <Card key={category}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm font-medium ${meta.color}`}>
                  {meta.plural}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">0</p>
                <p className="text-xs text-muted-foreground">files</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Storage stats, recent uploads and quick actions arrive in Feature 7.
      </div>
    </div>
  )
}
