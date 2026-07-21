/**
 * Centralised, validated access to environment variables.
 *
 * We use lazy getters instead of validating at module load so that simply
 * importing this file never throws — the error is only raised the moment a
 * value is actually needed (and then with a clear, actionable message).
 *
 * `NEXT_PUBLIC_*` vars are statically inlined by Next.js at build time, so we
 * must reference them via their full literal name (not dynamically).
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable "${name}". Copy .env.example to .env.local and fill it in.`,
    )
  }
  return value
}

export const env = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
  },
  get supabaseAnonKey() {
    return required(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )
  },
  /** Server-only. Do not read this from client components. */
  get supabaseServiceRoleKey() {
    return required(
      'SUPABASE_SERVICE_ROLE_KEY',
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )
  },
  get siteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  },
  /** Server-only. Primary LLM provider — chat, OCR, and auto-categorization. */
  get groqApiKey() {
    return required('GROQ_API_KEY', process.env.GROQ_API_KEY)
  },
  /** Server-only. Fallback LLM provider if Groq isn't configured or fails. */
  get geminiApiKey() {
    return required('GEMINI_API_KEY', process.env.GEMINI_API_KEY)
  },
  /** Server-only. Fallback LLM provider if Groq/Gemini aren't configured or fail. */
  get anthropicApiKey() {
    return required('ANTHROPIC_API_KEY', process.env.ANTHROPIC_API_KEY)
  },
  /** Server-only. Powers embeddings for semantic search. */
  get voyageApiKey() {
    return required('VOYAGE_API_KEY', process.env.VOYAGE_API_KEY)
  },
}
