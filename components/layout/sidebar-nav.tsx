'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Files,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Music,
  Video,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'

const MAIN_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My Files', href: '/files', icon: Files },
]

const CATEGORY_ITEMS = [
  { label: 'Images', category: 'image', icon: ImageIcon },
  { label: 'Documents', category: 'document', icon: FileText },
  { label: 'Videos', category: 'video', icon: Video },
  { label: 'Audio', category: 'audio', icon: Music },
]

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeCategory = searchParams.get('category')

  return (
    <nav className="flex flex-1 flex-col gap-1 text-sm">
      {MAIN_ITEMS.map((item) => {
        const active =
          item.href === '/files'
            ? pathname === '/files' && !activeCategory
            : pathname === item.href
        return (
          <NavLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={active}
            onNavigate={onNavigate}
          />
        )
      })}

      <p className="mt-4 mb-1 px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Categories
      </p>

      {CATEGORY_ITEMS.map((item) => (
        <NavLink
          key={item.category}
          href={`/files?category=${item.category}`}
          icon={item.icon}
          label={item.label}
          active={pathname === '/files' && activeCategory === item.category}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  )
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  onNavigate,
}: {
  href: string
  icon: LucideIcon
  label: string
  active: boolean
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        active && 'bg-accent font-medium text-foreground',
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  )
}
