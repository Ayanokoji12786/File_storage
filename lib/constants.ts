import type { FileCategory } from '@/types'

export const APP_NAME = 'Nimbus'
export const APP_DESCRIPTION =
  'A modern, minimal cloud storage app — upload, organise, preview and share your files.'

/** Max size for a single upload (bytes). */
export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

/** Storage quota granted to each user (bytes). */
export const STORAGE_QUOTA = 2 * 1024 * 1024 * 1024 // 2 GB

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
  { label: string; plural: string; color: string }
> = {
  image: { label: 'Image', plural: 'Images', color: 'text-sky-500' },
  document: { label: 'Document', plural: 'Documents', color: 'text-amber-500' },
  video: { label: 'Video', plural: 'Videos', color: 'text-rose-500' },
  audio: { label: 'Audio', plural: 'Audio', color: 'text-violet-500' },
  other: { label: 'Other', plural: 'Other', color: 'text-emerald-500' },
}
