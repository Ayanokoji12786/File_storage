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

/**
 * Picks the configured provider. Gemini wins when both are set because it has
 * a usable free tier; Anthropic is used when it's the only key present.
 */
export async function getAiProvider(): Promise<AiProvider> {
  if (process.env.GEMINI_API_KEY) {
    const { geminiProvider } = await import('./gemini')
    return geminiProvider
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const { anthropicProvider } = await import('./anthropic')
    return anthropicProvider
  }
  throw new Error(
    'No AI provider configured. Set GEMINI_API_KEY (free at aistudio.google.com) or ANTHROPIC_API_KEY in .env.local.',
  )
}
