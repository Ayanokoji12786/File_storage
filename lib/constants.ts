import type { FileCategory } from '@/types'

export const APP_NAME = 'Nimbus'
export const APP_DESCRIPTION =
  'A modern, minimal cloud storage app — upload, organise, preview and share your files.'

/** Max size for a single upload (bytes). Requires the Storage migration in supabase/schema.sql. */
export const MAX_FILE_SIZE = 20 * 1024 * 1024 * 1024 // 20 GB

/** Files at or above this size use chunked/resumable (TUS) upload instead of a single PUT. */
export const CHUNK_UPLOAD_THRESHOLD = 6 * 1024 * 1024 // 6 MB

/** Size of each chunk sent over the resumable upload protocol. */
export const CHUNK_SIZE = 6 * 1024 * 1024 // 6 MB

/** Storage quota granted to each user (bytes). Matches MAX_FILE_SIZE so a
 * single max-size upload doesn't get rejected purely by the quota check. */
export const STORAGE_QUOTA = 20 * 1024 * 1024 * 1024 // 20 GB

/** Days a file sits in Trash before it's purged for good. */
export const TRASH_RETENTION_DAYS = 30

/**
 * Above this, duplicate detection is skipped. Hashing needs the whole file in
 * memory (WebCrypto has no streaming digest), so hashing a multi-GB upload
 * would crash the tab.
 */
export const HASH_MAX_SIZE = 256 * 1024 * 1024 // 256 MB

/**
 * Above this, client-side encryption is refused. AES-GCM via WebCrypto is
 * one-shot — it buffers plaintext *and* ciphertext in memory, so large files
 * would OOM the tab. Chunked-envelope encryption would be needed to lift this.
 */
export const MAX_ENCRYPT_SIZE = 256 * 1024 * 1024 // 256 MB

/** Above this, client-side gzip is skipped (it buffers the result in memory). */
export const MAX_COMPRESS_SIZE = 128 * 1024 * 1024 // 128 MB

/** Files shown per page in the file browser. */
export const PAGE_SIZE = 12

/**
 * Length of the email OTP code. Must match the Supabase project's
 * "Email OTP Length" setting (Authentication → Providers → Email).
 */
export const OTP_LENGTH = 8

/** Ordered list of categories (drives the dashboard + filters). */
export const FILE_CATEGORIES: FileCategory[] = [
  'image',
  'document',
  'video',
  'audio',
  'other',
]

/**
 * Presentation metadata per category. `accent` is a Tailwind-friendly HSL-ish
 * token pair used for the coloured chips/cards on the dashboard.
 */
export const CATEGORY_META: Record<
  FileCategory,
  { label: string; plural: string; color: string; bg: string }
> = {
  image: { label: 'Image', plural: 'Images', color: 'text-sky-500', bg: 'bg-sky-500' },
  document: { label: 'Document', plural: 'Documents', color: 'text-primary', bg: 'bg-primary' },
  video: { label: 'Video', plural: 'Videos', color: 'text-emerald-500', bg: 'bg-emerald-500' },
  audio: { label: 'Audio', plural: 'Audio', color: 'text-violet-500', bg: 'bg-violet-500' },
  other: { label: 'Other', plural: 'Other', color: 'text-slate-500', bg: 'bg-slate-500' },
}
