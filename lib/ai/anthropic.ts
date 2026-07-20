import 'server-only'

import Anthropic from '@anthropic-ai/sdk'

import { env } from '@/lib/env'

import type { AiProvider } from './provider'

/** Model used when Anthropic is the configured provider. */
export const CLAUDE_MODEL = 'claude-opus-4-8'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey })
  return client
}

export const anthropicProvider: AiProvider = {
  name: 'anthropic',

  async *streamChat({ system, messages, maxTokens = 4096 }) {
    const stream = getClient().messages.stream({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      system,
      messages,
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  },

  async generateText({ system, prompt, maxTokens = 256 }) {
    const response = await getClient().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content.find((b) => b.type === 'text')
    return block && block.type === 'text' ? block.text : ''
  },

  async readImage({ data, mediaType, prompt, maxTokens = 4096 }) {
    const response = await getClient().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                // Anthropic only accepts this closed set; callers gate on it.
                media_type: mediaType as
                  | 'image/jpeg'
                  | 'image/png'
                  | 'image/gif'
                  | 'image/webp',
                data: data.toString('base64'),
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    })
    const block = response.content.find((b) => b.type === 'text')
    return block && block.type === 'text' ? block.text : ''
  },
}
