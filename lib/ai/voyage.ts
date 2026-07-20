import 'server-only'

import { env } from '@/lib/env'

/** Must match vector(...) in the file_chunks table. */
export const EMBEDDING_DIM = 1024

const VOYAGE_MODEL = 'voyage-3.5'
const BATCH_SIZE = 64

/**
 * Voyage's free tier allows only 3 requests/minute until a payment method is
 * added, so a 429 is expected rather than exceptional — wait and retry.
 */
const MAX_RETRIES = 3
const DEFAULT_RETRY_MS = 21_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface VoyageResponse {
  data: { embedding: number[]; index: number }[]
}

/**
 * Embeds texts with Voyage AI. `inputType` lets the model optimize for
 * indexing ('document') vs retrieval ('query').
 */
export async function embedTexts(
  texts: string[],
  inputType: 'document' | 'query',
): Promise<number[][]> {
  const out: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    out.push(...(await embedBatch(batch, inputType)))
  }

  return out
}

async function embedBatch(
  batch: string[],
  inputType: 'document' | 'query',
): Promise<number[][]> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.voyageApiKey}`,
      },
      body: JSON.stringify({
        input: batch,
        model: VOYAGE_MODEL,
        input_type: inputType,
        output_dimension: EMBEDDING_DIM,
      }),
    })

    if (res.ok) {
      const json = (await res.json()) as VoyageResponse
      json.data.sort((a, b) => a.index - b.index)
      return json.data.map((d) => d.embedding)
    }

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const header = Number(res.headers.get('retry-after'))
      const waitMs =
        Number.isFinite(header) && header > 0 ? header * 1000 : DEFAULT_RETRY_MS
      await sleep(waitMs)
      continue
    }

    const detail = (await res.text().catch(() => '')).slice(0, 200)
    if (res.status === 429) {
      throw new Error(
        'Embedding rate limit reached (Voyage free tier allows 3 requests/minute). Wait a minute and index again, or add a payment method to Voyage.',
      )
    }
    throw new Error(`Embedding failed (${res.status}): ${detail}`)
  }
}
