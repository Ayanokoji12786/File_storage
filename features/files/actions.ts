'use server'

import { revalidatePath } from 'next/cache'
import * as z from 'zod'

import { requireUser } from '@/lib/dal'
import { getFileCategory } from '@/lib/file-utils'
import { STORAGE_BUCKET } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'
import { renameSchema } from '@/lib/validations/files'

export type ActionResult = { success: true } | { error: string }

/**
 * Records metadata for a file the client just uploaded to Storage. The object
 * itself was uploaded browser-side (for progress); here we verify ownership and
 * write the DB row with a server-derived owner + category.
 */
export async function registerUpload(input: {
  storagePath: string
  name: string
  size: number
  mimeType: string
}): Promise<ActionResult> {
  const user = await requireUser()

  // Security: the object must live in the user's own folder.
  if (!input.storagePath.startsWith(`${user.id}/`)) {
    return { error: 'Invalid upload path.' }
  }

  const supabase = await createClient()
  const category = getFileCategory(input.mimeType, input.name)

  const { error } = await supabase.from('files').insert({
    owner_id: user.id,
    name: input.name.slice(0, 255),
    storage_path: input.storagePath,
    size: input.size,
    mime_type: input.mimeType,
    category,
  })

  if (error) return { error: error.message }

  revalidatePath('/files')
  revalidatePath('/dashboard')
  return { success: true }
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

/** Returns a short-lived signed URL for inline preview (image/video/pdf/…). */
export async function getPreviewUrl(
  id: string,
): Promise<{ url: string } | { error: string }> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: file } = await supabase
    .from('files')
    .select('storage_path, owner_id')
    .eq('id', id)
    .single()

  if (!file || file.owner_id !== user.id) {
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

/** Returns a short-lived signed URL that force-downloads the file. */
export async function getDownloadUrl(
  id: string,
): Promise<{ url: string } | { error: string }> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: file } = await supabase
    .from('files')
    .select('storage_path, name, owner_id')
    .eq('id', id)
    .single()

  if (!file || file.owner_id !== user.id) {
    return { error: 'File not found.' }
  }

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(file.storage_path, 60, { download: file.name })

  if (error || !data) return { error: 'Could not create download link.' }
  return { url: data.signedUrl }
}

/** Deletes a file (Storage object + DB row). RLS + ownership check enforced. */
export async function deleteFile(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: file } = await supabase
    .from('files')
    .select('storage_path, owner_id')
    .eq('id', id)
    .single()

  if (!file || file.owner_id !== user.id) {
    return { error: 'File not found.' }
  }

  await supabase.storage.from(STORAGE_BUCKET).remove([file.storage_path])

  const { error } = await supabase.from('files').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/files')
  revalidatePath('/dashboard')
  return { success: true }
}
