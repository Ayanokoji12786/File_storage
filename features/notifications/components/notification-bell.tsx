'use client'

import { useEffect, useState } from 'react'
import { Bell, Share2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDate } from '@/lib/file-utils'
import type { RealtimeChannel } from '@supabase/supabase-js'

import { createClient, ensureRealtimeAuth } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { DriveNotification } from '@/types'

import { markAllNotificationsRead, markNotificationRead } from '../actions'

interface NotificationRow {
  id: string
  user_id: string
  actor_id: string
  type: string
  file_id: string | null
  message: string
  read: boolean
  created_at: string
}

export function NotificationBell({
  userId,
  initial,
}: {
  userId: string
  initial: DriveNotification[]
}) {
  const [notifications, setNotifications] = useState(initial)
  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    let channel: RealtimeChannel | null = null
    let cancelled = false

    // Set the socket's JWT before subscribing to this RLS-gated table.
    ensureRealtimeAuth().then((supabase) => {
      if (cancelled) return
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as NotificationRow
            const next: DriveNotification = {
              id: row.id,
              userId: row.user_id,
              actorId: row.actor_id,
              actorName: 'Someone',
              type: row.type as DriveNotification['type'],
              fileId: row.file_id,
              fileName: null,
              message: row.message,
              read: row.read,
              createdAt: row.created_at,
            }
            setNotifications((prev) => [next, ...prev])
            toast(next.message, { icon: <Share2 className="size-4" /> })
          },
        )
        .subscribe()
    })

    return () => {
      cancelled = true
      if (channel) createClient().removeChannel(channel)
    }
  }, [userId])

  function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    void markNotificationRead(id)
  }

  function markAll() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    void markAllNotificationsRead()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAll}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            No notifications yet.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto border-t">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => markRead(n.id)}
                  className={cn(
                    'flex w-full items-start gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-muted',
                    !n.read && 'bg-primary/5',
                  )}
                >
                  {!n.read && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  )}
                  <span className={cn('flex-1', n.read && 'pl-4')}>
                    <span className="block">{n.message}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatDate(n.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
