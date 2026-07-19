/**
 * SHA-256 of a File/Blob as lowercase hex, via WebCrypto in the browser.
 * Fine to buffer fully in memory since uploads are capped at MAX_FILE_SIZE.
 */
export async function sha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
