'use client'

import { useEffect, useState } from 'react'

import { PreviewLoading, PreviewMessage } from './shared'

/** Don't try to render huge files as text. */
const MAX_TEXT_PREVIEW = 500 * 1024 // 500 KB

export function TextPreview({ url, size }: { url: string; size?: number }) {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tooLarge = !!size && size > MAX_TEXT_PREVIEW

  useEffect(() => {
    if (tooLarge) return
    let active = true
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.text()
      })
      .then((value) => active && setText(value))
      .catch(() => active && setError('Could not load the preview.'))
    return () => {
      active = false
    }
  }, [url, tooLarge])

  if (tooLarge) {
    return (
      <PreviewMessage message="File is too large to preview — download it instead." />
    )
  }
  if (error) return <PreviewMessage message={error} />
  if (text === null) return <PreviewLoading />

  return (
    <pre className="max-h-[70vh] overflow-auto rounded-xl border bg-muted/40 p-4 font-mono text-sm whitespace-pre-wrap">
      {text}
    </pre>
  )
}
