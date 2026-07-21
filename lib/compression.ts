/**
 * Client-side gzip via the native Compression Streams API — no dependency,
 * supported in all evergreen browsers. Only worth it for text-ish formats;
 * images/video/audio/archives are already compressed and would only grow.
 */

const COMPRESSIBLE_MIME_PREFIXES = ['text/']
const COMPRESSIBLE_MIME_TYPES = new Set([
  'application/json',
  'application/javascript',
  'application/xml',
  'application/rtf',
  'image/svg+xml',
])
const COMPRESSIBLE_EXTS = new Set([
  'txt', 'md', 'csv', 'json', 'xml', 'svg', 'rtf', 'log', 'html', 'css', 'js', 'ts', 'yml', 'yaml',
])

/** Below this, gzip overhead isn't worth a round trip. */
export const MIN_COMPRESSIBLE_SIZE = 10 * 1024 // 10 KB

export function isCompressible(mimeType: string, name: string): boolean {
  // The compressed result is buffered in memory, so skip very large files.
  const mime = (mimeType || '').toLowerCase()
  if (COMPRESSIBLE_MIME_PREFIXES.some((p) => mime.startsWith(p))) return true
  if (COMPRESSIBLE_MIME_TYPES.has(mime)) return true

  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return COMPRESSIBLE_EXTS.has(ext)
}

export async function compressBlob(blob: Blob): Promise<Blob> {
  const stream = blob.stream().pipeThrough(new CompressionStream('gzip'))
  return new Response(stream).blob()
}

export async function decompressBlob(blob: Blob, type: string): Promise<Blob> {
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'))
  const decompressed = await new Response(stream).blob()
  return type ? new Blob([decompressed], { type }) : decompressed
}
