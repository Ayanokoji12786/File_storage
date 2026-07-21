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
  /** Bytes actually stored (post-compression/encryption) — what counts against quota. */
  size: number
  /** Bytes the user originally uploaded — what the UI should display. */
  originalSize: number
  mimeType: string
  category: FileCategory
  isPublic: boolean
  createdAt: string
  updatedAt: string
  /** True if the file bytes are AES-GCM encrypted client-side (E2E). */
  isEncrypted: boolean
  /** Base64 IV, present only when `isEncrypted`. */
  encryptionIv: string | null
  /** Base64 PBKDF2 salt, present only when `isEncrypted`. */
  encryptionSalt: string | null
  /** True if the stored bytes are gzip-compressed. */
  isCompressed: boolean
  /** The real MIME type, when it's hidden behind compression/encryption. */
  originalMimeType: string | null
  /** Storage path of the auto-generated thumbnail, if any. */
  thumbnailPath: string | null
  /** Set when the file is in the Trash; null otherwise. */
  deletedAt: string | null
}

/** Minimal authenticated-user shape passed around the UI. */
export interface AuthUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
}

export type NotificationType = 'file_shared'

export interface DriveNotification {
  id: string
  userId: string
  actorId: string
  actorName: string
  type: NotificationType
  fileId: string | null
  fileName: string | null
  message: string
  read: boolean
  createdAt: string
}
