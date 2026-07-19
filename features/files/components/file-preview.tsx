import type { FileCategory } from '@/types'

import { DocxPreview } from './previews/docx-preview'
import { MarkdownPreview } from './previews/markdown-preview'
import { PreviewMessage } from './previews/shared'
import { TextPreview } from './previews/text-preview'
import { XlsxPreview } from './previews/xlsx-preview'

interface PreviewFile {
  name: string
  mimeType: string
  category: FileCategory
  size?: number
}

/** Extensions rendered as plain text/code. */
const TEXT_EXTS = new Set([
  'txt', 'csv', 'log', 'json', 'yml', 'yaml', 'xml', 'sql', 'sh',
  'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'rb', 'go', 'rs',
  'css', 'html', 'env', 'ini', 'toml',
])

/**
 * Renders an inline preview for a file given a (signed) URL: images, video,
 * audio, PDF, Markdown, Word, Excel, and text/code — icon fallback otherwise.
 * Shared by the in-app dialog and the public share page.
 */
export function FilePreview({
  file,
  url,
}: {
  file: PreviewFile
  url: string
}) {
  const ext = file.name.includes('.')
    ? (file.name.split('.').pop() ?? '').toLowerCase()
    : ''

  if (file.category === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed URL, not optimizable
      <img
        src={url}
        alt={file.name}
        className="mx-auto max-h-[70vh] w-auto rounded-xl object-contain"
      />
    )
  }

  if (file.category === 'video') {
    return (
      <video
        src={url}
        controls
        className="mx-auto max-h-[70vh] w-full rounded-xl bg-black"
      />
    )
  }

  if (file.category === 'audio') {
    return <audio src={url} controls className="w-full" />
  }

  if (file.mimeType === 'application/pdf') {
    return (
      <iframe
        src={url}
        title={file.name}
        className="h-[70vh] w-full rounded-xl border"
      />
    )
  }

  if (ext === 'md' || ext === 'markdown') return <MarkdownPreview url={url} />
  if (ext === 'docx') return <DocxPreview url={url} />
  if (ext === 'xlsx') return <XlsxPreview url={url} />
  if (TEXT_EXTS.has(ext) || file.mimeType.startsWith('text/')) {
    return <TextPreview url={url} size={file.size} />
  }

  return <PreviewMessage message="No preview available for this file type." />
}
