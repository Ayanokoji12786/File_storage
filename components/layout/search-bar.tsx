'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'

/**
 * Debounced filename search. Typing updates `/files?search=…` after a short
 * pause (instant-search feel) without a request per keystroke.
 */
export function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get('search') ?? '')
  const isFirst = useRef(true)

  useEffect(() => {
    // Skip the initial mount so we don't redirect on page load.
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    const timer = setTimeout(() => {
      const q = value.trim()
      router.push(q ? `/files?search=${encodeURIComponent(q)}` : '/files')
    }, 300)
    return () => clearTimeout(timer)
  }, [value, router])

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search files…"
        className="rounded-full pl-11"
        aria-label="Search files"
      />
    </div>
  )
}
