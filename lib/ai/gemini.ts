import 'server-only'

import { GoogleGenAI } from '@google/genai'

import { env } from '@/lib/env'

import type { AiProvider, ChatMessage } from './provider'

/**
 * Rolling alias for the current Flash model — supports vision and stays on a
 * model that's actually available to new API keys (the pinned 2.x names are
 * retired: "no longer available to new users"). Override with GEMINI_MODEL.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-latest'

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: env.geminiApiKey })
  return client
}

function toContents(messages: ChatMessage[]) {
  return messages.map((message) => ({
    // Gemini calls the assistant role "model".
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }))
}

/**
 * Gemini 2.5 Flash thinks by default, which silently eats the output budget
 * and can yield empty text. These are short, grounded tasks — turn it off.
 */
const NO_THINKING = { thinkingBudget: 0 } as const

export const geminiProvider: AiProvider = {
  name: 'gemini',

  async *streamChat({ system, messages, maxTokens = 2048 }) {
    const stream = await getClient().models.generateContentStream({
      model: GEMINI_MODEL,
      contents: toContents(messages),
      config: {
        systemInstruction: system,
        maxOutputTokens: maxTokens,
        thinkingConfig: NO_THINKING,
      },
    })

    for await (const chunk of stream) {
      const text = chunk.text
      if (text) yield text
    }
  },

  async generateText({ system, prompt, maxTokens = 256 }) {
    const response = await getClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: system,
        maxOutputTokens: maxTokens,
        thinkingConfig: NO_THINKING,
      },
    })
    return response.text ?? ''
  },

  async readImage({ data, mediaType, prompt, maxTokens = 4096 }) {
    const response = await getClient().models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: mediaType, data: data.toString('base64') } },
            { text: prompt },
          ],
        },
      ],
      config: { maxOutputTokens: maxTokens, thinkingConfig: NO_THINKING },
    })
    return response.text ?? ''
  },
}
