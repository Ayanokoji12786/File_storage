import type { FileCategory } from '@/types'

/**
 * Human-readable file size. `formatBytes(1536)` → "1.5 KB".
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1)
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`
}

/**
 * Deterministic date formatting. A fixed locale + UTC timezone guarantees the
 * server and client render the exact same string (avoiding hydration
 * mismatches from `toLocaleDateString()`'s environment-dependent output).
 * e.g. "19 Jul 2026".
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Derive our coarse category from a MIME type, falling back to the file
 * extension when the MIME type is missing or generic (e.g. octet-stream).
 */
export function getFileCategory(mimeType: string, fileName = ''): FileCategory {
  const mime = (mimeType || '').toLowerCase()

  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (isDocumentMime(mime)) return 'document'

  // Fall back to the extension for ambiguous/absent MIME types.
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (VIDEO_EXTS.has(ext)) return 'video'
  if (AUDIO_EXTS.has(ext)) return 'audio'
  if (DOCUMENT_EXTS.has(ext)) return 'document'

  return 'other'
}

function isDocumentMime(mime: string): boolean {
  return (
    mime === 'application/pdf' ||
    mime.startsWith('text/') ||
    mime.includes('word') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    mime.includes('powerpoint') ||
    mime === 'application/rtf' ||
    mime === 'application/json' ||
    mime === 'application/csv'
  )
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'])
const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v'])
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'])
const DOCUMENT_EXTS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'md', 'rtf', 'csv', 'json',
])
