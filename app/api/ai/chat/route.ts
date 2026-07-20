import type { NextRequest } from 'next/server'

import { getAiProvider } from '@/lib/ai/provider'
import { embedTexts } from '@/lib/ai/voyage'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Source {
  id: string
  name: string
  similarity: number
}

const MAX_MESSAGES = 16
const MAX_MESSAGE_CHARS = 4000

/**
 * Chat with your files (RAG). The response body is a stream whose first line
 * is `__SOURCES__<json>` (the retrieved files), followed by raw answer text.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let messages: ChatMessage[]
  try {
    const body = (await request.json()) as { messages?: unknown }
    messages = sanitizeMessages(body.messages)
  } catch {
    return new Response('Invalid request', { status: 400 })
  }
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return new Response('Invalid request', { status: 400 })
  }

  // Retrieval: embed the latest question and pull the closest chunks.
  const question = messages[messages.length - 1].content
  let context = ''
  let sources: Source[] = []
  try {
    const [embedding] = await embedTexts([question], 'query')
    const { data: chunks } = await supabase.rpc('match_file_chunks', {
      query_embedding: embedding,
      match_owner_id: user.id,
      match_count: 8,
    })

    const rows = (chunks ?? []) as {
      file_id: string
      content: string
      similarity: number
    }[]

    if (rows.length > 0) {
      const fileIds = [...new Set(rows.map((r) => r.file_id))]
      const { data: files } = await supabase
        .from('files')
        .select('id, name')
        .in('id', fileIds)
      const names = new Map((files ?? []).map((f) => [f.id as string, f.name as string]))

      context = rows
        .map(
          (r) =>
            `<excerpt file="${names.get(r.file_id) ?? 'unknown'}">\n${r.content}\n</excerpt>`,
        )
        .join('\n\n')

      const best = new Map<string, number>()
      for (const r of rows) {
        best.set(r.file_id, Math.max(best.get(r.file_id) ?? 0, r.similarity))
      }
      sources = [...best.entries()]
        .map(([id, similarity]) => ({
          id,
          name: names.get(id) ?? 'unknown',
          similarity,
        }))
        .sort((a, b) => b.similarity - a.similarity)
    }
  } catch (err) {
    // Retrieval failing (e.g. migration not run) shouldn't kill the chat.
    console.error('retrieval failed:', err)
  }

  const system = `You are Nimbus AI, the assistant built into Nimbus — the user's personal cloud drive. Answer the user's questions using the excerpts from their own files below.

Rules:
- Ground your answers in the excerpts and mention the file names you drew from.
- If the excerpts don't contain the answer, say you couldn't find it in their files; you may then answer briefly from general knowledge.
- Be concise and direct.

File excerpts:
${context || '(no relevant excerpts were found for this question)'}`

  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode(`__SOURCES__${JSON.stringify(sources)}\n`),
      )
      try {
        const provider = await getAiProvider()
        for await (const chunk of provider.streamChat({ system, messages })) {
          controller.enqueue(encoder.encode(chunk))
        }
      } catch (err) {
        console.error('chat stream failed:', err)
        controller.enqueue(
          encoder.encode(
            `\n\n${err instanceof Error ? err.message : 'Something went wrong generating the answer.'}`,
          ),
        )
      }
      controller.close()
    },
  })

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

function sanitizeMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return []
  const messages: ChatMessage[] = []
  for (const item of raw.slice(-MAX_MESSAGES)) {
    if (
      item &&
      typeof item === 'object' &&
      'role' in item &&
      'content' in item &&
      (item.role === 'user' || item.role === 'assistant') &&
      typeof item.content === 'string' &&
      item.content.trim()
    ) {
      messages.push({
        role: item.role,
        content: item.content.slice(0, MAX_MESSAGE_CHARS),
      })
    }
  }
  // The API requires the conversation to start with a user turn.
  while (messages.length > 0 && messages[0].role !== 'user') messages.shift()
  return messages
}
