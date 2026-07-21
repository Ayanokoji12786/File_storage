'use server'

import { extractFileText, MAX_EXTRACT_BYTES } from '@/lib/ai/extract'
import { requireUser } from '@/lib/dal'
import { isDraftlyEligible } from '@/lib/draftly'
import { STORAGE_BUCKET } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

/**
 * Extracts a file's plain text for handoff to Draftly. Owner-only: Draftly
 * gets embedded from "My Files", and the file must be readable by the
 * caller's own Storage policies (which only permit reading your own
 * `{uid}/…` folder — shared/public non-owner access goes through a signed
 * URL instead, which this flow doesn't use).
 */
export async function getDraftlyContent(
  fileId: string,
): Promise<{ title: string; content: string } | { error: string }> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: file } = await supabase
    .from('files')
    .select('name, storage_path, size, mime_type, category, is_encrypted, is_compressed, owner_id')
    .eq('id', fileId)
    .eq('owner_id', user.id)
    .single()

  if (!file) return { error: 'File not found.' }

  if (!isDraftlyEligible(file.name, file.is_encrypted ?? false, file.is_compressed ?? false)) {
    return { error: "This file type isn't supported by Draftly." }
  }
  if (file.size > MAX_EXTRACT_BYTES) {
    return { error: 'File is too large to open in Draftly.' }
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(file.storage_path)
  if (downloadError || !blob) return { error: 'Could not read this file.' }

  const buffer = Buffer.from(await blob.arrayBuffer())
  const text = await extractFileText({
    buffer,
    name: file.name,
    mimeType: file.mime_type,
    category: file.category,
  })

  if (!text || !text.trim()) return { error: 'No readable text found in this file.' }

  return { title: file.name, content: text }
}
