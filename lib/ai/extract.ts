import 'server-only'

import { getAiProvider, hasAiProvider } from './provider'

/** Hard cap on extracted text so indexing cost stays bounded. */
export const MAX_EXTRACT_CHARS = 100_000

/** Don't buffer/parse files larger than this for indexing. */
export const MAX_EXTRACT_BYTES = 25 * 1024 * 1024 // 25 MB

/** Extensions treated as plain text (mirrors the preview's list). */
const TEXT_EXTS = new Set([
  'txt', 'csv', 'log', 'json', 'yml', 'yaml', 'xml', 'sql', 'sh',
  'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'rb', 'go', 'rs',
  'css', 'html', 'env', 'ini', 'toml', 'md', 'markdown', 'svg',
])

type OcrMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
const OCR_MEDIA_TYPES: OcrMediaType[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]
/** Claude vision request cap — skip OCR for anything larger. */
const MAX_OCR_BYTES = 4 * 1024 * 1024

function formatCell(cell: unknown): string {
  if (cell == null) return ''
  if (cell instanceof Date) return cell.toISOString().slice(0, 10)
  return String(cell)
}

/**
 * Produces a plain-text representation of a file for the AI index, or null
 * when the type has no useful text form (e.g. audio/video).
 */
export async function extractFileText(input: {
  buffer: Buffer
  name: string
  mimeType: string
  category: string
}): Promise<string | null> {
  const { buffer, name, mimeType, category } = input
  const mime = mimeType.toLowerCase()
  const ext = name.includes('.')
    ? (name.split('.').pop() ?? '').toLowerCase()
    : ''

  // Plain text / code / markup — includes SVG, which is just XML.
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'image/svg+xml' ||
    TEXT_EXTS.has(ext)
  ) {
    return buffer.toString('utf-8').slice(0, MAX_EXTRACT_CHARS)
  }

  if (mime === 'application/pdf' || ext === 'pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await extractText(pdf, { mergePages: true })
    return text.slice(0, MAX_EXTRACT_CHARS)
  }

  if (ext === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value.slice(0, MAX_EXTRACT_CHARS)
  }

  if (ext === 'xlsx') {
    const { readSheet } = await import('read-excel-file/node')
    const rows = await readSheet(buffer)
    return rows
      .map((row) => row.map((cell) => formatCell(cell)).join(' | '))
      .join('\n')
      .slice(0, MAX_EXTRACT_CHARS)
  }

  // Images: OCR via the vision model. Images without text get a short
  // description instead, which makes photos semantically searchable.
  if (category === 'image') {
    if (
      !hasAiProvider() ||
      buffer.length > MAX_OCR_BYTES ||
      !OCR_MEDIA_TYPES.includes(mime as OcrMediaType)
    ) {
      return null
    }
    return ocrImage(buffer, mime as OcrMediaType)
  }

  return null
}

async function ocrImage(
  buffer: Buffer,
  mediaType: OcrMediaType,
): Promise<string | null> {
  const provider = await getAiProvider()
  const text = await provider.readImage({
    data: buffer,
    mediaType,
    prompt:
      'Extract all legible text from this image, preserving reading order. Return only the extracted text. If the image contains no text, return a one-sentence description of what the image shows instead.',
  })
  return text.trim() ? text.slice(0, MAX_EXTRACT_CHARS) : null
}
