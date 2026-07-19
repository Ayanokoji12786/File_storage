'use client'

import { useEffect, useState } from 'react'

import { PreviewLoading, PreviewMessage } from './shared'

/**
 * Word (.docx) preview via mammoth, which converts the document to clean HTML
 * in the browser. Runtime-imported to keep the bundle lean.
 */
export function DocxPreview({ url }: { url: string }) {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [res, mammoth] = await Promise.all([fetch(url), import('mammoth')])
        if (!res.ok) throw new Error()
        const arrayBuffer = await res.arrayBuffer()
        const result = await mammoth.convertToHtml({ arrayBuffer })
        if (active) setHtml(result.value)
      } catch {
        if (active) setError('Could not load the Word preview.')
      }
    }
    load()

    return () => {
      active = false
    }
  }, [url])

  if (error) return <PreviewMessage message={error} />
  if (html === null) return <PreviewLoading />

  return (
    <div
      className="prose prose-sm dark:prose-invert max-h-[70vh] max-w-none overflow-auto rounded-xl border p-6"
      // mammoth generates its own HTML from the docx structure (it does not
      // pass raw document markup through).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
