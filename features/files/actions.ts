'use server'

import { revalidatePath } from 'next/cache'

import { requireUser } from '@/lib/dal'
import { getFileCategory } from '@/lib/file-utils'
import { STORAGE_BUCKET } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

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
