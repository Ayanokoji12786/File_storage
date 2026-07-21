'use client'

import type { RealtimeChannel } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'

export type UploadBroadcastPayload = {
  id: string
  name: string
  percent: number
  status: 'uploading' | 'done' | 'error' | 'cancelled'
  error?: string
}

type Listener = (payload: UploadBroadcastPayload) => void

/**
 * A single shared `uploads:{userId}` channel for the whole tab. Both the
 * uploader (which sends progress) and the widget (which renders it) go through
 * this one channel — opening two channels on the *same* topic on the same
 * client collides and silently breaks `send()`, so they must share.
 *
 * `broadcast.self` echoes the sender's own messages back, so the tab doing the
 * upload also mirrors progress in its widget; other tabs/devices receive it via
 * normal fan-out. `private` routes through Realtime Authorization (RLS on
 * realtime.messages) so only the owning user can read or write the topic.
 */
const listeners = new Set<Listener>()
let channelPromise: Promise<RealtimeChannel> | null = null

function ensureChannel(userId: string): Promise<RealtimeChannel> {
  if (channelPromise) return channelPromise

  const supabase = createClient()

  channelPromise = (async () => {
    // Feed the socket the user's JWT *before* joining. A private channel that
    // subscribes before auth is set fails the RLS check and never retries, so
    // this must not race the client's onAuthStateChange handler.
    const {
      data: { session },
    } = await supabase.auth.getSession()
    await supabase.realtime.setAuth(session?.access_token ?? null)

    const channel = supabase.channel(`uploads:${userId}`, {
      config: { private: true, broadcast: { self: true } },
    })
    channel.on('broadcast', { event: 'progress' }, ({ payload }) => {
      listeners.forEach((l) => l(payload as UploadBroadcastPayload))
    })

    return new Promise<RealtimeChannel>((resolve, reject) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve(channel)
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Drop the cached promise so the next attempt reconnects instead of
          // being wedged forever behind a failed handshake.
          channelPromise = null
          supabase.removeChannel(channel)
          reject(new Error(`upload channel ${status}`))
        }
      })
    })
  })()

  // If the handshake fails, clear the cache so a later call can retry.
  channelPromise.catch(() => {
    channelPromise = null
  })

  return channelPromise
}

/**
 * Subscribe to live upload progress for this user. Returns an unsubscribe fn.
 * Used by the floating progress widget.
 */
export function subscribeUploadProgress(userId: string, listener: Listener): () => void {
  listeners.add(listener)
  ensureChannel(userId).catch(() => {})
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Best-effort progress broadcast. Never throws — the upload itself must not
 * fail just because the realtime side is unavailable.
 */
export async function broadcastUploadProgress(
  userId: string,
  payload: UploadBroadcastPayload,
): Promise<void> {
  try {
    const channel = await ensureChannel(userId)
    await channel.send({ type: 'broadcast', event: 'progress', payload })
  } catch {
    // Progress mirroring is non-essential; swallow connection failures.
  }
}
