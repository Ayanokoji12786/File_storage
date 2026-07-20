'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Loader2,
  Music,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Video,
  type LucideIcon,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CATEGORY_META } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { FileCategory } from '@/types'

import { indexAllPending, semanticSearch, type SearchResult } from '../actions'

const CATEGORY_ICON: Record<FileCategory, LucideIcon> = {
  image: ImageIcon,
  document: FileText,
  video: Video,
  audio: Music,
  other: FileIcon,
}

interface Source {
  id: string
  name: string
  similarity: number
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

const SUGGESTIONS = [
  'Summarize my notes',
  'Which file mentions duplicates?',
  'What images do I have?',
]

export function AiWorkspace({
  pendingCount,
  indexedCount,
}: {
  pendingCount: number
  indexedCount: number
}) {
  const router = useRouter()
  const [indexing, startIndexing] = useTransition()

  function handleIndexNow() {
    startIndexing(async () => {
      const result = await indexAllPending()
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(
        `Indexed ${result.indexed} file${result.indexed === 1 ? '' : 's'}` +
          (result.skipped ? `, skipped ${result.skipped}` : '') +
          (result.failed ? `, ${result.failed} failed` : ''),
      )
      router.refresh()
    })
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Sparkles className="size-6 text-primary" />
            Ask AI
          </h1>
          <p className="text-muted-foreground">
            Chat with your files, or search them by meaning.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {indexedCount} file{indexedCount === 1 ? '' : 's'} indexed
        </span>
      </div>

      {pendingCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-accent p-4">
          <p className="text-sm">
            <span className="font-medium">{pendingCount}</span>{' '}
            {pendingCount === 1 ? 'file isn’t' : 'files aren’t'} indexed for AI
            yet.
          </p>
          <Button size="sm" onClick={handleIndexNow} disabled={indexing}>
            {indexing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {indexing ? 'Indexing…' : 'Index now'}
          </Button>
        </div>
      )}

      <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="chat">
            <Sparkles className="size-4" /> Chat
          </TabsTrigger>
          <TabsTrigger value="search">
            <Search className="size-4" /> Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="min-h-0 flex-1">
          <ChatPanel />
        </TabsContent>
        <TabsContent value="search" className="min-h-0 flex-1">
          <SearchPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    const question = text.trim()
    if (!question || streaming) return
    setInput('')

    const history: ChatMessage[] = [
      ...messages,
      { role: 'user', content: question },
    ]
    setMessages([...history, { role: 'assistant', content: '' }])
    setStreaming(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      })
      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let pending = ''
      let answer = ''
      let gotSources = false

      const update = (changes: Partial<ChatMessage>) =>
        setMessages((prev) => {
          const copy = [...prev]
          copy[copy.length - 1] = { ...copy[copy.length - 1], ...changes }
          return copy
        })

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        pending += decoder.decode(value, { stream: true })

        if (!gotSources) {
          const newline = pending.indexOf('\n')
          if (newline === -1) continue
          const first = pending.slice(0, newline)
          pending = pending.slice(newline + 1)
          gotSources = true
          if (first.startsWith('__SOURCES__')) {
            try {
              update({ sources: JSON.parse(first.slice('__SOURCES__'.length)) })
            } catch {
              // Malformed sources line — ignore and keep streaming text.
            }
          } else {
            answer += first + '\n'
          }
        }

        answer += pending
        pending = ''
        update({ content: answer })
      }

      if (!answer.trim()) {
        update({ content: 'Something went wrong — please try again.' })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chat failed')
      setMessages((prev) => {
        const copy = [...prev]
        const last = copy[copy.length - 1]
        if (last.role === 'assistant' && !last.content) {
          copy[copy.length - 1] = {
            ...last,
            content: 'Something went wrong — please try again.',
          }
        }
        return copy
      })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="flex h-full min-h-[50vh] flex-col rounded-3xl border bg-card shadow-sm">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-10 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-primary/10">
              <Sparkles className="size-7 text-primary" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Ask anything about the files in your drive — summaries, lookups,
              or “which file mentions…”.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, i) => (
            <div
              key={i}
              className={cn(
                'flex',
                message.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                  message.role === 'user'
                    ? 'whitespace-pre-wrap bg-primary text-primary-foreground'
                    : 'bg-muted',
                )}
              >
                {message.role === 'assistant' && message.content ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  message.content ||
                  (streaming && i === messages.length - 1 ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    ''
                  ))
                )}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
                    {message.sources.map((source) => (
                      <span
                        key={source.id}
                        className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs text-muted-foreground"
                        title={`${Math.round(source.similarity * 100)}% match`}
                      >
                        <FileText className="size-3" />
                        {source.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault()
          sendMessage(input)
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your files…"
          disabled={streaming}
        />
        <Button type="submit" size="icon" disabled={streaming || !input.trim()}>
          {streaming ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Semantic search                                                     */
/* ------------------------------------------------------------------ */

function SearchPanel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [searching, startSearching] = useTransition()

  function runSearch() {
    const term = query.trim()
    if (!term) return
    startSearching(async () => {
      const result = await semanticSearch(term)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setResults(result.results)
    })
  }

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          runSearch()
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe what you're looking for — e.g. “my markdown checklist”"
        />
        <Button type="submit" disabled={searching || !query.trim()}>
          {searching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Search
        </Button>
      </form>

      {results !== null && results.length === 0 && (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No matches — try different wording, or index more files first.
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="space-y-3">
          {results.map((result) => {
            const category = (
              result.category in CATEGORY_META ? result.category : 'other'
            ) as FileCategory
            const Icon = CATEGORY_ICON[category]
            return (
              <li
                key={result.fileId}
                className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm"
              >
                <span
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-full',
                    CATEGORY_META[category].bg,
                  )}
                >
                  <Icon className="size-4 text-white" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{result.name}</p>
                    <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                      {Math.round(result.similarity * 100)}% match
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {result.snippet}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
