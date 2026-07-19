'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpDown, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SortKey } from '@/lib/data/files'
import { cn } from '@/lib/utils'

const OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'created_desc', label: 'Newest' },
  { key: 'created_asc', label: 'Oldest' },
  { key: 'name_asc', label: 'Name (A–Z)' },
  { key: 'name_desc', label: 'Name (Z–A)' },
  { key: 'size_desc', label: 'Largest' },
  { key: 'size_asc', label: 'Smallest' },
]

export function SortMenu() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = (searchParams.get('sort') as SortKey) ?? 'created_desc'

  function setSort(key: SortKey) {
    const params = new URLSearchParams(searchParams)
    params.set('sort', key)
    params.delete('page') // back to first page on re-sort
    router.push(`${pathname}?${params.toString()}`)
  }

  const activeLabel =
    OPTIONS.find((o) => o.key === current)?.label ?? 'Newest'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <ArrowUpDown className="size-4" />
          {activeLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.key}
            onSelect={() => setSort(option.key)}
            className="justify-between"
          >
            {option.label}
            <Check
              className={cn(
                'size-4',
                option.key === current ? 'opacity-100' : 'opacity-0',
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
