'use server'

import { revalidatePath } from 'next/cache'
import * as z from 'zod'

import { MAX_FILE_SIZE, STORAGE_QUOTA } from '@/lib/constants'
import { requireUser } from '@/lib/dal'
import { formatBytes, getFileCategory } from '@/lib/file-utils'
import { STORAGE_BUCKET } from '@/lib/storage'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { renameSchema } from '@/lib/validations/files'

export type ActionResult = { success: true } | { error: string }

/**
 * Reads an object's true byte count from Storage. The client reports a size
 * too, but it's attacker-controlled — quota accounting must never trust it.
 */
async function getStoredObjectSize(storagePath: string): Promise<number | null> {
  const admin = createAdminClient()
  const lastSlash = storagePath.lastIndexOf('/')
  const folder = storagePath.slice(0, lastSlash)
  const filename = storagePath.slice(lastSlash + 1)

  const { data } = await admin.storage
    .from(STORAGE_BUCKET)
    .list(folder, { limit: 1, search: filename })

  const match = data?.find((o) => o.name === filename)
  const size = (match?.metadata as { size?: number } | undefined)?.size
  return typeof size === 'number' ? size : null
}

/** Best-effort removal of objects we've decided not to keep. */
async function discardObjects(paths: (string | undefined)[]): Promise<void> {
  const real = paths.filter((p): p is string => !!p)
  if (real.length === 0) return
  const admin = createAdminClient()
  await admin.storage.from(STORAGE_BUCKET).remove(real)
}

/**
 * Records metadata for a file the client just uploaded to Storage. The object
 * itself was uploaded browser-side (for progress); here we verify ownership and
 * write the DB row with a server-derived owner + category.
 */
export async function registerUpload(input: {
  storagePath: string
  name: string
  size: number
  originalSize?: number
  mimeType: string
  contentHash?: string
  isEncrypted?: boolean
  encryptionIv?: string
  encryptionSalt?: string
  isCompressed?: boolean
  originalMimeType?: string
  thumbnailPath?: string
}): Promise<{ fileId: string } | { error: string }> {
  const user = await requireUser()

  // Security: the object must live in the user's own folder.
  if (!input.storagePath.startsWith(`${user.id}/`)) {
    return { error: 'Invalid upload path.' }
  }
  if (input.thumbnailPath && !input.thumbnailPath.startsWith(`${user.id}/`)) {
    return { error: 'Invalid thumbnail path.' }
  }

  // Never trust the client's reported size — read it back from Storage. If we
  // can't confirm it, refuse rather than let unmetered bytes through.
  const actualSize = await getStoredObjectSize(input.storagePath)
  if (actualSize === null) {
    await discardObjects([input.storagePath, input.thumbnailPath])
    return { error: 'Upload could not be verified. Please try again.' }
  }

  if (actualSize > MAX_FILE_SIZE) {
    await discardObjects([input.storagePath, input.thumbnailPath])
    return { error: `File exceeds the ${formatBytes(MAX_FILE_SIZE)} limit.` }
  }

  // Quota covers everything the user occupies, including Trash.
  const supabase = await createClient()
  const { data: usageRows } = await supabase
    .from('files')
    .select('size')
    .eq('owner_id', user.id)

  const used = (usageRows ?? []).reduce(
    (sum, r) => sum + ((r as { size: number }).size ?? 0),
    0,
  )
  if (used + actualSize > STORAGE_QUOTA) {
    await discardObjects([input.storagePath, input.thumbnailPath])
    return {
      error: `Not enough space — this needs ${formatBytes(actualSize)} but only ${formatBytes(Math.max(0, STORAGE_QUOTA - used))} is free. Empty your Trash or delete some files.`,
    }
  }

  const category = getFileCategory(input.mimeType, input.name)

  const row: Record<string, unknown> = {
    owner_id: user.id,
    name: input.name.slice(0, 255),
    storage_path: input.storagePath,
    size: actualSize,
    mime_type: input.mimeType,
    category,
  }
  // Only include when present so inserts keep working if a migration hasn't
  // been applied yet on an older database.
  if (input.contentHash) row.content_hash = input.contentHash
  if (input.isEncrypted) {
    row.is_encrypted = true
    row.encryption_iv = input.encryptionIv
    row.encryption_salt = input.encryptionSalt
  }
  if (input.isCompressed) row.is_compressed = true
  if (input.originalMimeType) row.original_mime_type = input.originalMimeType
  if (input.thumbnailPath) row.thumbnail_path = input.thumbnailPath
  // What the user actually uploaded, so a compressed file doesn't display as
  // its (much smaller) stored size.
  row.original_size = input.originalSize ?? actualSize

  const { data, error } = await supabase
    .from('files')
    .insert(row)
    .select('id')
    .single()

  // Without this the object would linger in Storage forever: no DB row means
  // it's invisible in the UI and unreclaimable, while still being billed.
  if (error || !data) {
    await discardObjects([input.storagePath, input.thumbnailPath])
    return { error: error?.message ?? 'Upload failed.' }
  }

  revalidatePath('/files')
  revalidatePath('/dashboard')
  return { fileId: data.id as string }
}

/**
 * Duplicate check: does the current user already have a file with this
 * SHA-256 content hash? Returns null (never an error) if the column is
 * missing (pre-migration) so uploads degrade gracefully.
 */
export async function findDuplicate(
  contentHash: string,
): Promise<{ duplicate: { id: string; name: string } | null }> {
  const user = await requireUser()
  if (!/^[a-f0-9]{64}$/.test(contentHash)) return { duplicate: null }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('files')
    .select('id, name')
    .eq('owner_id', user.id)
    .eq('content_hash', contentHash)
    .limit(1)
    .maybeSingle()

  if (error || !data) return { duplicate: null }
  return { duplicate: data }
}

/** Renames a file (DB only — the storage object keeps its opaque path). */
export async function renameFile(id: string, name: string): Promise<ActionResult> {
  const user = await requireUser()

  const parsed = renameSchema.safeParse({ name })
  if (!parsed.success) {
    return { error: z.flattenError(parsed.error).fieldErrors.name?.[0] ?? 'Invalid name' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('files')
    .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/files')
  return { success: true }
}

/**
 * Returns a short-lived signed URL for inline preview (image/video/pdf/…).
 * Access control is RLS: the `files` select policy already only returns rows
 * the caller owns, that are public, or that were shared directly with them.
 */
export async function getPreviewUrl(
  id: string,
): Promise<{ url: string } | { error: string }> {
  await requireUser()
  const supabase = await createClient()

  const { data: file } = await supabase
    .from('files')
    .select('storage_path')
    .eq('id', id)
    .single()

  if (!file) {
    return { error: 'File not found.' }
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(file.storage_path, 300)

  if (error || !data) return { error: 'Could not load preview.' }
  return { url: data.signedUrl }
}

/** Toggles a file's public-share flag (owner only). */
export async function setFilePublic(
  id: string,
  isPublic: boolean,
): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from('files')
    .update({ is_public: isPublic, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/files')
  return { success: true }
}

/**
 * Returns a short-lived signed URL that force-downloads the file. Access
 * control is RLS (see `getPreviewUrl`).
 */
export async function getDownloadUrl(
  id: string,
): Promise<{ url: string } | { error: string }> {
  await requireUser()
  const supabase = await createClient()

  const { data: file } = await supabase
    .from('files')
    .select('storage_path, name')
    .eq('id', id)
    .single()

  if (!file) {
    return { error: 'File not found.' }
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(file.storage_path, 60, { download: file.name })

  if (error || !data) return { error: 'Could not create download link.' }
  return { url: data.signedUrl }
}

/**
 * Moves a file to Trash (soft delete — sets `deleted_at`, the Storage object
 * is untouched). It's automatically purged for good after
 * `TRASH_RETENTION_DAYS` (see `getTrashedFiles`), or sooner via
 * `permanentlyDeleteFile` / `emptyTrash`.
 */
export async function deleteFile(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('files')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', user.id)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'File not found.' }

  revalidatePath('/files')
  revalidatePath('/dashboard')
  revalidatePath('/trash')
  return { success: true }
}

/** Restores a file out of Trash (owner only). */
export async function restoreFile(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('files')
    .update({ deleted_at: null })
    .eq('id', id)
    .eq('owner_id', user.id)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'File not found in Trash.' }

  revalidatePath('/files')
  revalidatePath('/dashboard')
  revalidatePath('/trash')
  return { success: true }
}

/** Permanently deletes a trashed file (Storage object(s) + DB row). Owner only. */
export async function permanentlyDeleteFile(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: file } = await supabase
    .from('files')
    .select('storage_path, thumbnail_path, owner_id, deleted_at')
    .eq('id', id)
    .single()

  if (!file || file.owner_id !== user.id || !file.deleted_at) {
    return { error: 'File not found in Trash.' }
  }

  const paths = [file.storage_path, file.thumbnail_path].filter(
    (p): p is string => !!p,
  )
  await supabase.storage.from(STORAGE_BUCKET).remove(paths)

  const { error } = await supabase.from('files').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/trash')
  return { success: true }
}

/** Permanently deletes every file currently in the user's Trash. */
export async function emptyTrash(): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: files } = await supabase
    .from('files')
    .select('id, storage_path, thumbnail_path')
    .eq('owner_id', user.id)
    .not('deleted_at', 'is', null)

  if (!files || files.length === 0) return { success: true }

  const paths = files.flatMap((f) =>
    [f.storage_path, f.thumbnail_path].filter((p): p is string => !!p),
  )
  if (paths.length > 0) await supabase.storage.from(STORAGE_BUCKET).remove(paths)

  const { error } = await supabase
    .from('files')
    .delete()
    .in('id', files.map((f) => f.id))
  if (error) return { error: error.message }

  revalidatePath('/trash')
  return { success: true }
}

/**
 * Shares a file directly with another Nimbus user by email: creates a
 * `shares` row (grants read access via RLS) and a notification for them.
 * Owner-only; the recipient must already have an account.
 */
export async function shareFileWithUser(
  id: string,
  email: string,
): Promise<ActionResult> {
  const user = await requireUser()
  const trimmedEmail = email.trim().toLowerCase()
  if (!trimmedEmail) return { error: 'Enter an email address.' }
  if (trimmedEmail === user.email.toLowerCase()) {
    return { error: "You can't share a file with yourself." }
  }

  const supabase = await createClient()

  const { data: file } = await supabase
    .from('files')
    .select('id, name, owner_id')
    .eq('id', id)
    .single()

  if (!file || file.owner_id !== user.id) {
    return { error: 'File not found.' }
  }

  // Resolved through a SECURITY DEFINER function that returns only an id —
  // the profiles table itself is no longer readable across accounts, so
  // addresses can't be enumerated.
  const { data: recipientId } = await supabase.rpc('lookup_user_by_email', {
    lookup_email: trimmedEmail,
  })

  if (!recipientId) {
    return { error: `No Nimbus account found for ${email}.` }
  }

  const { error: shareError } = await supabase
    .from('shares')
    .upsert(
      { file_id: id, owner_id: user.id, shared_with_user_id: recipientId },
      { onConflict: 'file_id,shared_with_user_id', ignoreDuplicates: true },
    )
  if (shareError) return { error: shareError.message }

  const actorName = user.name || user.email
  await supabase.from('notifications').insert({
    user_id: recipientId,
    actor_id: user.id,
    type: 'file_shared',
    file_id: id,
    message: `${actorName} shared "${file.name}" with you.`,
  })

  revalidatePath('/shared')
  return { success: true }
}
