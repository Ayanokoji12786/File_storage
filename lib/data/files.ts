import 'server-only'

import { PAGE_SIZE } from '@/lib/constants'
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

export type SortKey =
  | 'created_desc'
  | 'created_asc'
  | 'name_asc'
  | 'name_desc'
  | 'size_desc'
  | 'size_asc'

const SORT_MAP: Record<SortKey, { column: string; ascending: boolean }> = {
  created_desc: { column: 'created_at', ascending: false },
  created_asc: { column: 'created_at', ascending: true },
  name_asc: { column: 'name', ascending: true },
  name_desc: { column: 'name', ascending: false },
  size_desc: { column: 'size', ascending: false },
  size_asc: { column: 'size', ascending: true },
}

export function isSortKey(value: string | undefined): value is SortKey {
  return !!value && value in SORT_MAP
}

/**
 * Lists the current user's files (RLS guarantees ownership) with optional
 * category filter, filename search, sort, and pagination. Returns the page of
 * results plus the total matching count (for pagination controls).
 */
export async function getFiles({
  search,
  category,
  sort = 'created_desc',
  page = 1,
}: {
  search?: string
  category?: FileCategory
  sort?: SortKey
  page?: number
} = {}): Promise<{ files: DriveFile[]; total: number }> {
  await requireUser()
  const supabase = await createClient()

  const { column, ascending } = SORT_MAP[sort]
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('files')
    .select('*', { count: 'exact' })
    .order(column, { ascending })
    .range(from, to)

  if (category) query = query.eq('category', category)

  const term = search?.trim()
  if (term) query = query.ilike('name', `%${term}%`)

  const { data, error, count } = await query
  if (error) {
    console.error('getFiles failed:', error.message)
    return { files: [], total: 0 }
  }
  return { files: (data as FileRow[]).map(mapRow), total: count ?? 0 }
}

export interface StorageStats {
  totalSize: number
  totalCount: number
  byCategory: Record<FileCategory, { count: number; size: number }>
}

function emptyByCategory(): StorageStats['byCategory'] {
  return {
    image: { count: 0, size: 0 },
    document: { count: 0, size: 0 },
    video: { count: 0, size: 0 },
    audio: { count: 0, size: 0 },
    other: { count: 0, size: 0 },
  }
}

/** Aggregates the user's files: total size/count and per-category breakdown. */
export async function getStorageStats(): Promise<StorageStats> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase.from('files').select('category, size')
  const byCategory = emptyByCategory()
  if (error || !data) return { totalSize: 0, totalCount: 0, byCategory }

  let totalSize = 0
  for (const row of data as { category: string; size: number }[]) {
    const category = (
      row.category in byCategory ? row.category : 'other'
    ) as FileCategory
    byCategory[category].count += 1
    byCategory[category].size += row.size
    totalSize += row.size
  }

  return { totalSize, totalCount: data.length, byCategory }
}

/** The user's most recent uploads. */
export async function getRecentFiles(limit = 6): Promise<DriveFile[]> {
  await requireUser()
  const supabase = await createClient()

  const { data } = await supabase
    .from('files')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data as FileRow[] | null)?.map(mapRow) ?? []
}
