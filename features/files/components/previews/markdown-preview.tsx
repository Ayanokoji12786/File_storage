'use client'

import { useEffect, useState, type ReactNode } from 'react'

import { PreviewLoading, PreviewMessage } from './shared'

/**
 * Renders Markdown with GitHub-flavored extras. react-markdown and remark-gfm
 * are imported at runtime so they stay out of the main bundle.
 */
export function MarkdownPreview({ url }: { url: string }) {
  const [node, setNode] = useState<ReactNode>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [res, mdModule, gfmModule] = await Promise.all([
          fetch(url),
          import('react-markdown'),
          import('remark-gfm'),
        ])
        if (!res.ok) throw new Error()
        const text = await res.text()
        if (!active) return

        const ReactMarkdown = mdModule.default
        const remarkGfm = gfmModule.default
        setNode(
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>,
        )
      } catch {
        if (active) setError('Could not load the preview.')
      }
    }
    load()

    return () => {
      active = false
    }
  }, [url])

  if (error) return <PreviewMessage message={error} />
  if (node === null) return <PreviewLoading />

  return (
    <div className="prose prose-sm dark:prose-invert max-h-[70vh] max-w-none overflow-auto rounded-xl border p-6">
      {node}
    </div>
  )
}
