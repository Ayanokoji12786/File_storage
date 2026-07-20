/**
 * Splits text into overlapping chunks for embedding, preferring to break at
 * newlines/spaces so chunks stay readable.
 */
export function chunkText(
  text: string,
  chunkSize = 1200,
  overlap = 200,
): string[] {
  const clean = text.replace(/\r/g, '').trim()
  if (!clean) return []

  const chunks: string[] = []
  let start = 0

  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length)

    if (end < clean.length) {
      const lastBreak = Math.max(
        clean.lastIndexOf('\n', end),
        clean.lastIndexOf(' ', end),
      )
      if (lastBreak > start + chunkSize * 0.5) end = lastBreak
    }

    const piece = clean.slice(start, end).trim()
    if (piece) chunks.push(piece)

    if (end >= clean.length) break
    start = Math.max(end - overlap, start + 1)
  }

  return chunks
}
