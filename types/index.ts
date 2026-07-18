/** The five buckets every uploaded file is sorted into. */
export type FileCategory = 'image' | 'document' | 'video' | 'audio' | 'other'

/**
 * A file as the UI consumes it. This mirrors the `files` table we'll create in
 * a later feature; kept here so components and the data layer share one shape.
 */
export interface DriveFile {
  id: string
  ownerId: string
  name: string
  /** Path within the Supabase Storage bucket. */
  storagePath: string
  size: number
  mimeType: string
  category: FileCategory
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

/** Minimal authenticated-user shape passed around the UI. */
export interface AuthUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
}
