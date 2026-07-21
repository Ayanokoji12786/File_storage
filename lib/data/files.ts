import 'server-only'

import { PAGE_SIZE, TRASH_RETENTION_DAYS } from '@/lib/constants'
import { requireUser } from '@/lib/dal'
import { STORAGE_BUCKET } from '@/lib/storage'
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
  is_encrypted?: boolean | null
  encryption_iv?: string | null
  encryption_salt?: string | null
  is_compressed?: boolean | null
  original_mime_type?: string | null
  thumbnail_path?: string | null
  deleted_at?: string | null
  original_size?: number | null
}

function mapRow(row: FileRow): DriveFile {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    storagePath: row.storage_path,
    size: row.size,
    originalSize: row.original_size ?? row.size,
    mimeType: row.mime_type,
    category: row.category as FileCategory,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isEncrypted: row.is_encrypted ?? false,
    encryptionIv: row.encryption_iv ?? null,
    encryptionSalt: row.encryption_salt ?? null,
    isCompressed: row.is_compressed ?? false,
    originalMimeType: row.original_mime_type ?? null,
    thumbnailPath: row.thumbnail_path ?? null,
    deletedAt: row.deleted_at ?? null,
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
 * Escapes LIKE metacharacters so a search for "%" matches a literal percent
 * sign instead of every file the user owns.
 */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`)
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
    .is('deleted_at', null)
    .order(column, { ascending })
    .range(from, to)

  if (category) query = query.eq('category', category)

  const term = search?.trim()
  if (term) query = query.ilike('name', `%${escapeLike(term)}%`)

  const { data, error, count } = await query
  if (error) {
    console.error('getFiles failed:', error.message)
    return { files: [], total: 0 }
  }
  return { files: (data as FileRow[]).map(mapRow), total: count ?? 0 }
}

export interface StorageStats {
  /** Bytes counted against the quota — includes Trash, which still occupies storage. */
  totalSize: number
  /** Active (non-trashed) file count. */
  totalCount: number
  /** Bytes held by trashed files, already included in `totalSize`. */
  trashedSize: number
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

/**
 * Aggregates the user's files. Runs as a single grouped SQL query rather than
 * streaming every row to the app — this is called from the app layout, so it
 * executes on every page load.
 */
export async function getStorageStats(): Promise<StorageStats> {
  await requireUser()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_storage_stats')
  const byCategory = emptyByCategory()
  if (error || !data) {
    return { totalSize: 0, totalCount: 0, trashedSize: 0, byCategory }
  }

  const rows = data as {
    category: string
    file_count: number
    total_size: number
    trashed: boolean
  }[]

  let totalSize = 0
  let totalCount = 0
  let trashedSize = 0

  for (const row of rows) {
    // Trash still occupies real storage, so it counts against the quota — but
    // it shouldn't appear in the category tiles or the active file count.
    totalSize += Number(row.total_size)
    if (row.trashed) {
      trashedSize += Number(row.total_size)
      continue
    }
    const category = (
      row.category in byCategory ? row.category : 'other'
    ) as FileCategory
    byCategory[category].count += Number(row.file_count)
    byCategory[category].size += Number(row.total_size)
    totalCount += Number(row.file_count)
  }

  return { totalSize, totalCount, trashedSize, byCategory }
}

/** Files someone else has shared directly with the current user. */
export async function getSharedWithMeFiles(): Promise<DriveFile[]> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: shareRows } = await supabase
    .from('shares')
    .select('file_id')
    .eq('shared_with_user_id', user.id)

  const fileIds = (shareRows ?? []).map((row) => row.file_id as string)
  if (fileIds.length === 0) return []

  const { data } = await supabase
    .from('files')
    .select('*')
    .in('id', fileIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return (data as FileRow[] | null)?.map(mapRow) ?? []
}

/** The user's most recent uploads. */
export async function getRecentFiles(limit = 6): Promise<DriveFile[]> {
  await requireUser()
  const supabase = await createClient()

  const { data } = await supabase
    .from('files')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data as FileRow[] | null)?.map(mapRow) ?? []
}

/**
 * Files in Trash. Purges anything older than `TRASH_RETENTION_DAYS` first —
 * removing the Storage object(s) then the row — so nothing outlives its
 * retention window even if Trash is only opened occasionally.
 */
export async function getTrashedFiles(): Promise<DriveFile[]> {
  await requireUser()
  const supabase = await createClient()

  const { data } = await supabase
    .from('files')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  const rows = (data as FileRow[] | null) ?? []
  const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000
  const expired = rows.filter(
    (row) => row.deleted_at && new Date(row.deleted_at).getTime() <= cutoff,
  )

  if (expired.length > 0) {
    const paths = expired.flatMap((row) =>
      [row.storage_path, row.thumbnail_path].filter((p): p is string => !!p),
    )
    if (paths.length > 0) await supabase.storage.from(STORAGE_BUCKET).remove(paths)
    await supabase
      .from('files')
      .delete()
      .in('id', expired.map((row) => row.id))
  }

  const expiredIds = new Set(expired.map((row) => row.id))
  return rows.filter((row) => !expiredIds.has(row.id)).map(mapRow)
}
