'use server'

import { requireUser } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { success: true } | { error: string }

/** Marks a single notification as read (owner only, enforced by RLS). */
export async function markNotificationRead(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}

/** Marks all of the current user's notifications as read. */
export async function markAllNotificationsRead(): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false)

  if (error) return { error: error.message }
  return { success: true }
}
