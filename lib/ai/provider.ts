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

type ProviderName = 'groq' | 'gemini' | 'anthropic'

/**
 * Priority order: Groq first (fast, generous free tier), then Gemini, then
 * Anthropic (paid, no free tier) — each configured key becomes an automatic
 * fallback for the ones before it.
 */
const PRIORITY: { name: ProviderName; envVar: string }[] = [
  { name: 'groq', envVar: 'GROQ_API_KEY' },
  { name: 'gemini', envVar: 'GEMINI_API_KEY' },
  { name: 'anthropic', envVar: 'ANTHROPIC_API_KEY' },
]

/** True when the app has some LLM configured (chat/OCR/classification). */
export function hasAiProvider(): boolean {
  return PRIORITY.some(({ envVar }) => Boolean(process.env[envVar]))
}

async function loadProvider(name: ProviderName): Promise<AiProvider> {
  if (name === 'groq') return (await import('./groq')).groqProvider
  if (name === 'gemini') return (await import('./gemini')).geminiProvider
  return (await import('./anthropic')).anthropicProvider
}

/**
 * Chains providers in priority order so a failure (e.g. "the model is
 * overloaded" — common on a free tier under load) transparently retries with
 * the next configured provider instead of failing the whole request.
 *
 * For streamChat specifically: only retry if the current provider hasn't
 * yielded any text yet. Once partial output has reached the client,
 * restarting from a fallback would duplicate/garble the response, so at that
 * point we just let the error surface as before.
 */
function chainProviders(providers: AiProvider[]): AiProvider {
  const [current, ...rest] = providers
  if (rest.length === 0) return current
  const next = chainProviders(rest)

  return {
    name: current.name,

    async *streamChat(input) {
      let yielded = false
      try {
        for await (const chunk of current.streamChat(input)) {
          yielded = true
          yield chunk
        }
        return
      } catch (err) {
        if (yielded) throw err
        console.error(`${current.name} failed, retrying with ${next.name}:`, err)
      }
      yield* next.streamChat(input)
    },

    async generateText(input) {
      try {
        return await current.generateText(input)
      } catch (err) {
        console.error(`${current.name} failed, retrying with ${next.name}:`, err)
        return next.generateText(input)
      }
    },

    async readImage(input) {
      try {
        return await current.readImage(input)
      } catch (err) {
        console.error(`${current.name} failed, retrying with ${next.name}:`, err)
        return next.readImage(input)
      }
    },
  }
}

/**
 * Picks the provider chain from whichever keys are configured, in priority
 * order (see PRIORITY above). The first configured provider is primary;
 * any others configured become automatic fallbacks.
 */
export async function getAiProvider(): Promise<AiProvider> {
  const configured = PRIORITY.filter(({ envVar }) => process.env[envVar])
  if (configured.length === 0) {
    throw new Error(
      'No AI provider configured. Set GROQ_API_KEY (free at console.groq.com), GEMINI_API_KEY (free at aistudio.google.com), or ANTHROPIC_API_KEY in .env.local.',
    )
  }

  const providers = await Promise.all(configured.map(({ name }) => loadProvider(name)))
  return chainProviders(providers)
}
