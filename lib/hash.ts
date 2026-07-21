import { HASH_MAX_SIZE } from '@/lib/constants'

/**
 * SHA-256 of a File/Blob as lowercase hex, via WebCrypto in the browser.
 *
 * WebCrypto's digest is one-shot — it needs the entire file resident in
 * memory — so anything above `HASH_MAX_SIZE` returns null instead of trying
 * (uploads can be up to 20GB; buffering that would crash the tab). Callers
 * treat null as "duplicate detection unavailable for this file".
 */
export async function sha256Hex(blob: Blob): Promise<string | null> {
  if (blob.size > HASH_MAX_SIZE) return null

  const buffer = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
