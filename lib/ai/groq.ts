import 'server-only'

import { env } from '@/lib/env'

import type { AiProvider, ChatMessage } from './provider'

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'

/** Groq's lineup moves fast — override if this model gets deprecated. */
export const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'
/** Must be one of Groq's multimodal models (for readImage/OCR). */
export const GROQ_VISION_MODEL =
  process.env.GROQ_VISION_MODEL ?? 'meta-llama/llama-4-scout-17b-16e-instruct'

function toOpenAiMessages(system: string | undefined, messages: ChatMessage[]) {
  const out: { role: string; content: string }[] = []
  if (system) out.push({ role: 'system', content: system })
  for (const m of messages) out.push({ role: m.role, content: m.content })
  return out
}

async function chatCompletion(body: Record<string, unknown>): Promise<Response> {
  const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.groqApiKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300)
    throw new Error(`Groq request failed (${res.status}): ${detail}`)
  }
  return res
}

/** Splits an SSE response body into individual `data: ...` lines. */
async function* streamLines(res: Response): AsyncGenerator<string> {
  const reader = res.body?.getReader()
  if (!reader) return
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let newline: number
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line) yield line
    }
  }
}

export const groqProvider: AiProvider = {
  name: 'groq',

  async *streamChat({ system, messages, maxTokens = 2048 }) {
    const res = await chatCompletion({
      model: GROQ_MODEL,
      messages: toOpenAiMessages(system, messages),
      max_tokens: maxTokens,
      stream: true,
    })

    for await (const line of streamLines(res)) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice('data: '.length)
      if (payload === '[DONE]') break
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[]
        }
        const text = json.choices?.[0]?.delta?.content
        if (text) yield text
      } catch {
        // Malformed SSE chunk — skip it rather than failing the whole stream.
      }
    }
  },

  async generateText({ system, prompt, maxTokens = 256 }) {
    const res = await chatCompletion({
      model: GROQ_MODEL,
      messages: toOpenAiMessages(system, [{ role: 'user', content: prompt }]),
      max_tokens: maxTokens,
    })
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return json.choices?.[0]?.message?.content ?? ''
  },

  async readImage({ data, mediaType, prompt, maxTokens = 4096 }) {
    const res = await chatCompletion({
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:${mediaType};base64,${data.toString('base64')}` },
            },
          ],
        },
      ],
      max_tokens: maxTokens,
    })
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return json.choices?.[0]?.message?.content ?? ''
  },
}
