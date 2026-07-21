import 'server-only'

/** A single turn in a chat conversation. */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * The LLM capabilities this app needs, kept vendor-neutral so the provider can
 * be swapped without touching feature code.
 */
export interface AiProvider {
  readonly name: string

  /** Streams an answer as text chunks. */
  streamChat(input: {
    system: string
    messages: ChatMessage[]
    maxTokens?: number
  }): AsyncIterable<string>

  /** One-shot generation for short outputs (e.g. classification). */
  generateText(input: {
    system?: string
    prompt: string
    maxTokens?: number
  }): Promise<string>

  /** Vision: read text out of an image (OCR) or describe it. */
  readImage(input: {
    data: Buffer
    mediaType: string
    prompt: string
    maxTokens?: number
  }): Promise<string>
}

/** True when the app has some LLM configured (chat/OCR/classification). */
export function hasAiProvider(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY)
}

async function loadProvider(name: 'gemini' | 'anthropic'): Promise<AiProvider> {
  if (name === 'gemini') return (await import('./gemini')).geminiProvider
  return (await import('./anthropic')).anthropicProvider
}

/**
 * Wraps a primary provider so a failure (e.g. "the model is overloaded" —
 * common on Gemini's free tier under load) transparently retries once with
 * the other configured provider instead of failing the whole request.
 *
 * For streamChat specifically: only retry if the primary hasn't yielded any
 * text yet. Once partial output has reached the client, restarting from the
 * fallback would duplicate/garble the response, so at that point we just let
 * the error surface as before.
 */
function withFallback(primary: AiProvider, fallback: AiProvider): AiProvider {
  return {
    name: primary.name,

    async *streamChat(input) {
      let yielded = false
      try {
        for await (const chunk of primary.streamChat(input)) {
          yielded = true
          yield chunk
        }
        return
      } catch (err) {
        if (yielded) throw err
        console.error(`${primary.name} failed, retrying with ${fallback.name}:`, err)
      }
      yield* fallback.streamChat(input)
    },

    async generateText(input) {
      try {
        return await primary.generateText(input)
      } catch (err) {
        console.error(`${primary.name} failed, retrying with ${fallback.name}:`, err)
        return fallback.generateText(input)
      }
    },

    async readImage(input) {
      try {
        return await primary.readImage(input)
      } catch (err) {
        console.error(`${primary.name} failed, retrying with ${fallback.name}:`, err)
        return fallback.readImage(input)
      }
    },
  }
}

/**
 * Picks the configured provider. Gemini wins when both are set because it has
 * a usable free tier; Anthropic is used when it's the only key present. When
 * both are configured, the unused one becomes an automatic fallback.
 */
export async function getAiProvider(): Promise<AiProvider> {
  const primaryName = process.env.GEMINI_API_KEY
    ? 'gemini'
    : process.env.ANTHROPIC_API_KEY
      ? 'anthropic'
      : null
  if (!primaryName) {
    throw new Error(
      'No AI provider configured. Set GEMINI_API_KEY (free at aistudio.google.com) or ANTHROPIC_API_KEY in .env.local.',
    )
  }

  const primary = await loadProvider(primaryName)

  const fallbackName =
    primaryName === 'gemini' && process.env.ANTHROPIC_API_KEY
      ? 'anthropic'
      : primaryName === 'anthropic' && process.env.GEMINI_API_KEY
        ? 'gemini'
        : null
  if (!fallbackName) return primary

  const fallback = await loadProvider(fallbackName)
  return withFallback(primary, fallback)
}
