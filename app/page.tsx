import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, FolderLock, Share2, UploadCloud } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { APP_DESCRIPTION, APP_NAME } from '@/lib/constants'

const FEATURES = [
  {
    icon: UploadCloud,
    title: 'Upload anything',
    body: 'Drag & drop files with live progress. Automatically sorted into images, docs, video, audio and more.',
  },
  {
    icon: FolderLock,
    title: 'Private by default',
    body: 'Every file is yours alone, enforced at the database with row-level security — not just in the UI.',
  },
  {
    icon: Share2,
    title: 'Share in a click',
    body: 'Generate a public link when you want to, keep everything else locked down.',
  },
]

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  // Safety net: if the email link's redirect lands here with a PKCE code
  // (e.g. the allowlist fell back to the Site URL), forward it to the handler.
  const { code } = await searchParams
  if (code) redirect(`/auth/confirm?code=${code}`)

  return (
    <main className="relative flex min-h-dvh flex-col items-center overflow-hidden px-6">
      {/* Decorative gradient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <section className="z-10 flex w-full max-w-3xl flex-1 flex-col items-center justify-center py-24 text-center">
        <span className="mb-6 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          Built with Next.js 16 · Supabase
        </span>

        <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
          Your files, <span className="text-primary">beautifully organised</span>.
        </h1>

        <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">
          {APP_DESCRIPTION}
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/sign-up">
              Get started <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>

        <div className="mt-20 grid w-full gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border bg-card/50 p-5 text-left backdrop-blur-sm"
            >
              <Icon className="size-6 text-primary" />
              <h3 className="mt-3 font-medium">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="z-10 pb-8 text-sm text-muted-foreground">
        {APP_NAME} — a Google Drive clone demo.
      </footer>
    </main>
  )
}
