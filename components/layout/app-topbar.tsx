'use client'

import { Suspense, useState } from 'react'
import { LogOut, Menu } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { UploadButton } from '@/features/files/components/upload-button'
import { signOut } from '@/lib/actions/auth'
import type { AuthUser } from '@/types'

import { AppSidebar } from './app-sidebar'
import { SearchBar } from './search-bar'
import { ThemeToggle } from './theme-toggle'

export function AppTopbar({
  user,
  storageUsed = 0,
}: {
  user: AuthUser
  storageUsed?: number
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md lg:gap-3 lg:px-6">
      {/* Mobile drawer trigger */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebar
            user={user}
            storageUsed={storageUsed}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 justify-start">
        <Suspense fallback={<div className="h-11 w-full max-w-md" />}>
          <SearchBar />
        </Suspense>
      </div>

      <UploadButton />
      <ThemeToggle />
      <form action={signOut}>
        <Button
          variant="ghost"
          size="icon"
          type="submit"
          className="text-primary"
          aria-label="Sign out"
        >
          <LogOut className="size-5" />
        </Button>
      </form>
    </header>
  )
}
