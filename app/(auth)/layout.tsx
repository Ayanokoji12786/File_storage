import Link from 'next/link'

import { BrandIllustration } from '@/components/layout/brand-illustration'
import { APP_NAME } from '@/lib/constants'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel (desktop) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-white/10 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-black/10 blur-2xl"
        />

        <Link href="/" className="relative flex items-center gap-3 text-2xl font-semibold">
          <span className="grid size-11 place-items-center rounded-full bg-white/25">
            <span className="size-5 rounded-full bg-white" />
          </span>
          {APP_NAME}
        </Link>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-[1.1] xl:text-5xl">
            Manage your files the best way
          </h1>
          <p className="mt-5 text-lg text-primary-foreground/80">
            We&apos;ve created the perfect place for you to store and share all
            your documents.
          </p>
        </div>

        <BrandIllustration className="relative w-full max-w-sm" />
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-10 flex items-center justify-center gap-2 text-lg font-semibold lg:hidden"
          >
            <span className="grid size-8 place-items-center rounded-full bg-primary text-sm text-primary-foreground">
              N
            </span>
            {APP_NAME}
          </Link>
          {children}
        </div>
      </div>
    </div>
  )
}
