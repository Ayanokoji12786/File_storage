import type { Metadata } from 'next'

import { AiWorkspace } from '@/features/ai/components/ai-workspace'
import { requireUser } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Ask AI' }

export default async function AiPage() {
  await requireUser()
  const supabase = await createClient()

  // Both queries tolerate the AI migration not having run yet (count -> 0).
  const [{ count: pending }, { count: indexed }] = await Promise.all([
    supabase
      .from('files')
      .select('id', { count: 'exact', head: true })
      .in('index_status', ['pending', 'error']),
    supabase
      .from('files')
      .select('id', { count: 'exact', head: true })
      .eq('index_status', 'indexed'),
  ])

  return (
    <AiWorkspace pendingCount={pending ?? 0} indexedCount={indexed ?? 0} />
  )
}
