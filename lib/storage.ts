import { env } from '@/lib/env'

export const STORAGE_BUCKET = 'files'

/**
 * Uploads a file straight to Supabase Storage via XHR so we get real upload
 * progress events (the supabase-js `upload()` doesn't expose progress).
 *
 * Auth is the user's own access token; the bucket's RLS policies restrict
 * writes to the user's own `{uid}/…` folder.
 */
export function uploadToStorage({
  token,
  path,
  file,
  onProgress,
  signal,
}: {
  token: string
  path: string
  file: File
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(
      'POST',
      `${env.supabaseUrl}/storage/v1/object/${STORAGE_BUCKET}/${path}`,
    )
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('x-upsert', 'false')
    if (file.type) xhr.setRequestHeader('Content-Type', file.type)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(parseError(xhr.responseText)))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))

    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort()
        reject(new Error('Upload cancelled'))
      })
    }

    xhr.send(file)
  })
}

function parseError(body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string }
    return parsed.message || parsed.error || 'Upload failed'
  } catch {
    return 'Upload failed'
  }
}
