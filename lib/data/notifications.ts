import 'server-only'

import { requireUser } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import type { DriveNotification, NotificationType } from '@/types'

interface NotificationRow {
  id: string
  user_id: string
  actor_id: string
  type: string
  file_id: string | null
  message: string
  read: boolean
  created_at: string
  files: { name: string } | { name: string }[] | null
  profiles: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null
}

function firstOf<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function mapRow(row: NotificationRow): DriveNotification {
  const actor = firstOf(row.profiles)
  const file = firstOf(row.files)
  return {
    id: row.id,
    userId: row.user_id,
    actorId: row.actor_id,
    actorName: actor?.full_name || actor?.email || 'Someone',
    type: row.type as NotificationType,
    fileId: row.file_id,
    fileName: file?.name ?? null,
    message: row.message,
    read: row.read,
    createdAt: row.created_at,
  }
}

/** The current user's most recent notifications (newest first). */
export async function getNotifications(limit = 20): Promise<DriveNotification[]> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notifications')
    .select('*, files(name), profiles!notifications_actor_id_fkey(full_name, email)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return (data as unknown as NotificationRow[]).map(mapRow)
}
