import 'server-only'

import type { FileCategory } from '@/types'

import { getAiProvider, hasAiProvider } from './provider'

const CATEGORIES: FileCategory[] = ['image', 'document', 'video', 'audio', 'other']

/**
 * AI auto-categorization for files whose MIME/extension couldn't decide
 * (category 'other'). Classifies from the file name plus a content excerpt.
 * Returns null on any failure — the caller keeps the existing category.
 */
export async function classifyCategory(
  name: string,
  excerpt: string,
): Promise<FileCategory | null> {
  if (!hasAiProvider()) return null

  try {
    const provider = await getAiProvider()
    const raw = await provider.generateText({
      system:
        'Classify the file into exactly one category based on its name and content. Reply with a single word: image, document, video, audio, or other.',
      prompt: `File name: ${name}\n\nContent excerpt:\n${excerpt.slice(0, 1500)}`,
      maxTokens: 16,
    })

    const word = raw.trim().toLowerCase()
    return (CATEGORIES as string[]).includes(word)
      ? (word as FileCategory)
      : null
  } catch {
    return null
  }
}
