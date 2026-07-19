'use client'

import { useEffect, useState } from 'react'

import { PreviewLoading, PreviewMessage } from './shared'

/** Rows shown before truncating, to keep the DOM sane for big sheets. */
const MAX_ROWS = 200

function formatCell(cell: unknown): string {
  if (cell == null) return ''
  if (cell instanceof Date) return cell.toISOString().slice(0, 10)
  return String(cell)
}

/**
 * Excel (.xlsx) preview via read-excel-file (first sheet, capped rows).
 * Runtime-imported to keep the bundle lean.
 */
export function XlsxPreview({ url }: { url: string }) {
  const [rows, setRows] = useState<string[][] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [res, mod] = await Promise.all([
          fetch(url),
          import('read-excel-file/browser'),
        ])
        if (!res.ok) throw new Error()
        const blob = await res.blob()
        const data = await mod.readSheet(blob)
        if (active) {
          setRows(data.map((row) => row.map((cell) => formatCell(cell))))
        }
      } catch {
        if (active) setError('Could not load the spreadsheet preview.')
      }
    }
    load()

    return () => {
      active = false
    }
  }, [url])

  if (error) return <PreviewMessage message={error} />
  if (rows === null) return <PreviewLoading />
  if (rows.length === 0) return <PreviewMessage message="This sheet is empty." />

  const [header, ...body] = rows
  const visible = body.slice(0, MAX_ROWS)

  return (
    <div className="max-h-[70vh] overflow-auto rounded-xl border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-muted">
          <tr>
            {header.map((cell, i) => (
              <th key={i} className="border-b px-3 py-2 text-left font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, r) => (
            <tr key={r} className="even:bg-muted/40">
              {row.map((cell, c) => (
                <td key={c} className="border-b px-3 py-1.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {body.length > MAX_ROWS && (
        <p className="p-3 text-center text-xs text-muted-foreground">
          Showing the first {MAX_ROWS} of {body.length} rows.
        </p>
      )}
    </div>
  )
}
