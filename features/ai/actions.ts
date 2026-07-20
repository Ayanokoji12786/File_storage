'use server'

import { chunkText } from '@/lib/ai/chunk'
import { classifyCategory } from '@/lib/ai/classify'
import {
  extractFileText,
  MAX_EXTRACT_BYTES,
  MAX_EXTRACT_CHARS,
} from '@/lib/ai/extract'
import { embedTexts } from '@/lib/ai/voyage'
import { requireUser } from '@/lib/dal'
import { STORAGE_BUCKET } from '@/lib/storage'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { AuthUser } from '@/types'

/** Bound per-file work so indexing cost stays predictable. */
const MAX_CHUNKS_PER_FILE = 80
/**
 * Files processed per "Index now" invocation. Kept small so a batch fits
 * inside Voyage's free-tier rate window (3 requests/minute) and the action
 * returns promptly; the banner lets the user run it again for the rest.
 */
const MAX_BATCH = 3

export type IndexOutcome = 'indexed' | 'skipped' | 'error'

export interface SearchResult {
  fileId: string
  name: string
  category: string
  similarity: number
  snippet: string
}

interface IndexableFile {
  id: string
  name: string
  storage_path: string
  mime_type: string
  category: string
  size: number
  owner_id: string
}

/**
 * Core indexing: download → extract text (incl. OCR) → AI-categorize when
 * unknown → chunk → embed → store vectors. Writes go through the admin client
 * (ownership is verified before this runs); status lands on files.index_status.
 */
async function indexOne(user: AuthUser, file: IndexableFile): Promise<IndexOutcome> {
  const admin = createAdminClient()

  async function setStatus(status: string) {
    await admin.from('files').update({ index_status: status }).eq('id', file.id)
  }

  if (file.size > MAX_EXTRACT_BYTES) {
    await setStatus('skipped')
    return 'skipped'
  }

  await setStatus('indexing')

  try {
    const { data: blob, error: downloadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .download(file.storage_path)
    if (downloadError || !blob) throw new Error('Could not download file.')

    const buffer = Buffer.from(await blob.arrayBuffer())
    const text = await extractFileText({
      buffer,
      name: file.name,
      mimeType: file.mime_type,
      category: file.category,
    })

    if (!text || !text.trim()) {
      await setStatus('skipped')
      return 'skipped'
    }

    // AI auto-categorization: only when MIME/extension left it as 'other'.
    if (file.category === 'other') {
      const category = await classifyCategory(file.name, text)
      if (category && category !== 'other') {
        await admin.from('files').update({ category }).eq('id', file.id)
      }
    }

    const chunks = chunkText(text.slice(0, MAX_EXTRACT_CHARS)).slice(
      0,
      MAX_CHUNKS_PER_FILE,
    )
    const embeddings = await embedTexts(chunks, 'document')

    await admin.from('file_chunks').delete().eq('file_id', file.id)
    const rows = chunks.map((content, i) => ({
      file_id: file.id,
      owner_id: user.id,
      chunk_index: i,
      content,
      embedding: embeddings[i],
    }))
    const { error: insertError } = await admin.from('file_chunks').insert(rows)
    if (insertError) throw new Error(insertError.message)

    await setStatus('indexed')
    return 'indexed'
  } catch (err) {
    console.error(`indexing failed for ${file.id}:`, err)
    await setStatus('error')
    return 'error'
  }
}

async function loadOwnedFile(
  userId: string,
  fileId: string,
): Promise<IndexableFile | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('files')
    .select('id, name, storage_path, mime_type, category, size, owner_id')
    .eq('id', fileId)
    .single<IndexableFile>()
  return data && data.owner_id === userId ? data : null
}

/** Index a single file for AI search/chat (fired after upload). */
export async function indexFile(
  fileId: string,
): Promise<{ status: IndexOutcome } | { error: string }> {
  const user = await requireUser()
  const file = await loadOwnedFile(user.id, fileId)
  if (!file) return { error: 'File not found.' }
  return { status: await indexOne(user, file) }
}

/** Index every file still pending (or previously failed), capped per call. */
export async function indexAllPending(): Promise<
  { indexed: number; skipped: number; failed: number } | { error: string }
> {
  const user = await requireUser()
  const supabase = await createClient()

  const { data: files, error } = await supabase
    .from('files')
    .select('id, name, storage_path, mime_type, category, size, owner_id')
    .in('index_status', ['pending', 'error'])
    .limit(MAX_BATCH)

  if (error) return { error: 'Could not list files — has the AI migration been run?' }

  const counts = { indexed: 0, skipped: 0, failed: 0 }
  for (const file of (files ?? []) as IndexableFile[]) {
    const outcome = await indexOne(user, file)
    if (outcome === 'indexed') counts.indexed++
    else if (outcome === 'skipped') counts.skipped++
    else counts.failed++
  }
  return counts
}

/** Semantic file search: embed the query, match chunks, group by file. */
export async function semanticSearch(
  query: string,
): Promise<{ results: SearchResult[] } | { error: string }> {
  const user = await requireUser()
  const term = query.trim()
  if (term.length < 2) return { results: [] }

  try {
    const [embedding] = await embedTexts([term], 'query')
    const supabase = await createClient()

    const { data: chunks, error } = await supabase.rpc('match_file_chunks', {
      query_embedding: embedding,
      match_owner_id: user.id,
      match_count: 12,
    })
    if (error) throw new Error(error.message)

    const byFile = new Map<string, { similarity: number; snippet: string }>()
    for (const chunk of (chunks ?? []) as {
      file_id: string
      content: string
      similarity: number
    }[]) {
      const existing = byFile.get(chunk.file_id)
      if (!existing || chunk.similarity > existing.similarity) {
        byFile.set(chunk.file_id, {
          similarity: chunk.similarity,
          snippet: chunk.content.slice(0, 180),
        })
      }
    }
    if (byFile.size === 0) return { results: [] }

    const { data: files } = await supabase
      .from('files')
      .select('id, name, category')
      .in('id', [...byFile.keys()])

    const results: SearchResult[] = (files ?? [])
      .map((file) => {
        const match = byFile.get(file.id)!
        return {
          fileId: file.id,
          name: file.name as string,
          category: file.category as string,
          similarity: match.similarity,
          snippet: match.snippet,
        }
      })
      .sort((a, b) => b.similarity - a.similarity)

    return { results }
  } catch (err) {
    console.error('semanticSearch failed:', err)
    return { error: 'Search failed — make sure your files are indexed.' }
  }
}
