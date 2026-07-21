'use client'

/**
 * Local, on-device storage for files marked "available offline". File bytes
 * live in the Cache Storage API (keyed by a synthetic same-origin request so
 * it plays nicely with the service worker's cache), and a small metadata
 * index lives in localStorage since `caches.keys()` alone can't give us
 * names/sizes to render a list.
 */

const CACHE_NAME = 'nimbus-offline-files'
const INDEX_KEY = 'nimbus-offline-index'

export interface OfflineFileMeta {
  id: string
  name: string
  size: number
  mimeType: string
  category: string
}

function cacheKey(id: string): string {
  return `/__offline-file/${id}`
}

function readIndex(): OfflineFileMeta[] {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? '[]') as OfflineFileMeta[]
  } catch {
    return []
  }
}

function writeIndex(index: OfflineFileMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

export function getOfflineIndex(): OfflineFileMeta[] {
  return readIndex()
}

export function isAvailableOffline(id: string): boolean {
  return readIndex().some((f) => f.id === id)
}

export async function saveFileOffline(meta: OfflineFileMeta, blob: Blob): Promise<void> {
  const cache = await caches.open(CACHE_NAME)
  await cache.put(cacheKey(meta.id), new Response(blob, { headers: { 'Content-Type': meta.mimeType } }))
  writeIndex([...readIndex().filter((f) => f.id !== meta.id), meta])
}

export async function removeFileOffline(id: string): Promise<void> {
  const cache = await caches.open(CACHE_NAME)
  await cache.delete(cacheKey(id))
  writeIndex(readIndex().filter((f) => f.id !== id))
}

/**
 * Wipes every trace of the signed-in user's files from this device. Called on
 * sign-out so a shared machine doesn't leak the previous user's documents.
 */
export async function clearOfflineData(): Promise<void> {
  try {
    localStorage.removeItem(INDEX_KEY)
    if ('caches' in window) {
      const names = await caches.keys()
      await Promise.all(names.map((name) => caches.delete(name)))
    }
  } catch {
    // Best effort — never block sign-out on cleanup.
  }
}

export async function getOfflineFileUrl(id: string): Promise<string | null> {
  const cache = await caches.open(CACHE_NAME)
  const res = await cache.match(cacheKey(id))
  if (!res) return null
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
