const MAX_DIMENSION = 320

/** Downscaled WebP thumbnail generated client-side via canvas, or null on failure. */
export async function generateImageThumbnail(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.75)
    })
  } catch {
    return null
  }
}

export function canThumbnail(mimeType: string): boolean {
  const mime = (mimeType || '').toLowerCase()
  return mime.startsWith('image/') && mime !== 'image/svg+xml'
}
