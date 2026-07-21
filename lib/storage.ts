import * as tus from 'tus-js-client'

import { CHUNK_SIZE } from '@/lib/constants'
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
  file: Blob
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

/**
 * Uploads via Supabase Storage's resumable (TUS) endpoint — chunked, so large
 * files upload in ~6MB pieces and can survive a dropped connection. Used for
 * anything at or above `CHUNK_UPLOAD_THRESHOLD`, up to `MAX_FILE_SIZE` (20GB).
 */
export function uploadToStorageChunked({
  token,
  path,
  file,
  contentType,
  onProgress,
  signal,
}: {
  token: string
  path: string
  file: Blob
  contentType: string
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${env.supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000],
      chunkSize: CHUNK_SIZE,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: {
        authorization: `Bearer ${token}`,
        apikey: env.supabaseAnonKey,
        'x-upsert': 'false',
      },
      metadata: {
        bucketName: STORAGE_BUCKET,
        objectName: path,
        contentType: contentType || 'application/octet-stream',
        cacheControl: '3600',
      },
      onError: (error) => reject(error),
      onProgress: (bytesSent, bytesTotal) => {
        if (onProgress) onProgress(Math.round((bytesSent / bytesTotal) * 100))
      },
      onSuccess: () => resolve(),
    })

    if (signal) {
      signal.addEventListener('abort', () => {
        upload.abort()
        reject(new Error('Upload cancelled'))
      })
    }

    upload
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0])
        upload.start()
      })
      .catch(() => upload.start())
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
