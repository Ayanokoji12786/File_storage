import 'server-only'

import { requireUser } from '@/lib/dal'
import { createClient } from '@/lib/supabase/server'
import type { DriveFile, FileCategory } from '@/types'

interface FileRow {
  id: string
  owner_id: string
  name: string
  storage_path: string
  size: number
  mime_type: string
  category: string
  is_public: boolean
  created_at: string
  updated_at: string
}

function mapRow(row: FileRow): DriveFile {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    storagePath: row.storage_path,
    size: row.size,
    mimeType: row.mime_type,
    category: row.category as FileCategory,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Lists the current user's files (RLS guarantees ownership), optionally
 * filtered by category and/or a filename search.
 */
export async function getFiles({
  search,
  category,
}: {
  search?: string
  category?: FileCategory
} = {}): Promise<DriveFile[]> {
  await requireUser()
  const supabase = await createClient()

  let query = supabase
    .from('files')
    .select('*')
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)

  const term = search?.trim()
  if (term) query = query.ilike('name', `%${term}%`)

  const { data, error } = await query
  if (error) {
    console.error('getFiles failed:', error.message)
    return []
  }
  return (data as FileRow[]).map(mapRow)
}
