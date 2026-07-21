# Nimbus — a Google Drive clone

**Live:** [file-storage-livid.vercel.app](https://file-storage-livid.vercel.app)

A modern, minimal cloud storage app built with **Next.js 16** and **Supabase**.
Upload, organize, preview, and share your files — with per-user isolation
enforced at the database with Row Level Security.

## Features

- **Passwordless auth** — email OTP (code or magic link), session cookies, route protection
- **Upload** — drag & drop with a real progress bar, auto-categorization (image / document / video / audio / other)
- **File management** — search, sort, filter by category, rename, download, delete, pagination
- **Preview** — inline preview for images, video, audio, and PDF
- **Sharing** — toggle a public link and share any file with anyone
- **Dashboard** — storage usage, per-category breakdown, recent uploads
- **Direct sharing & real-time notifications** — share a file with another user by email; they get a live in-app notification (Supabase Realtime)
- **Real-time upload progress** — progress broadcasts over a per-user Realtime channel, so any open tab/device shows the same upload in flight
- **Chunked, resumable uploads** — files ≥6MB upload via Supabase Storage's TUS endpoint in ~6MB chunks, up to 20GB
- **Client-side compression** — eligible text/document uploads are gzipped in the browser before upload, transparently decompressed on preview/download
- **Per-file end-to-end encryption** — opt-in AES-GCM encryption in the browser before upload; the passphrase never leaves the client and isn't recoverable if lost
- **Automatic thumbnails** — client-side canvas-generated WebP thumbnails for images, served through a private, ownership-checked route
- **QR code sharing** — generate and download a QR code for any public share link
- **Collaborative presence** — see who else has a file's preview open right now
- **Offline mode (PWA)** — installable manifest + service worker; mark individual files "available offline" for on-device access without a network round trip
- **Responsive** — sidebar on desktop, drawer on mobile; light & dark themes
- **Secure** — Row Level Security, server-side authorization in every action

## Tech stack

| Area | Choice |
|------|--------|
| Framework | Next.js 16 (App Router, Server Actions) |
| UI | React 19, Tailwind CSS v4, shadcn/ui, lucide-react |
| Backend | Supabase (Auth, Postgres, Storage) |
| Forms / validation | React Hook Form, Zod |
| Theme / toasts | next-themes, sonner |

> **Note:** This project targets **Next.js 16**, where Middleware is renamed
> **Proxy** (`proxy.ts`) and `cookies()` is async.

## Getting started

### 1. Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) project

### 2. Install
```bash
npm install
```

### 3. Configure the database
In the Supabase dashboard → **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql)
top to bottom. It's idempotent, so re-running it on a database that already
has some of these migrations applied is safe. It creates:
- the `files` table (RLS) + a private `files` storage bucket (per-user folder policies)
- the AI semantic search columns/tables (pgvector)
- `profiles` (auto-synced from `auth.users`), `shares`, and `notifications` — needed for
  direct file sharing and the notification bell (Realtime must be on for the
  project, which is the default for new Supabase projects)
- encryption/compression/thumbnail columns on `files`, and raises the Storage
  bucket's per-object size limit to 20GB for chunked uploads
- security/scalability hardening: locks `profiles` down to self-only reads,
  requires an actual share before a notification can be inserted, RLS
  policies on `realtime.messages` (Realtime Authorization), a `pg_trgm`
  index for search, a `get_storage_stats()` aggregate, and a `pg_cron` job
  that purges expired Trash daily

**One step SQL can't do:** the `realtime.messages` policies only take effect
once **Realtime Authorization** is switched on for the project — Supabase
dashboard → **Settings → Realtime** → enable it. Without this, the private
upload-progress and presence channels aren't actually enforced.

### 4. Configure environment variables
Copy the template and fill it in:
```bash
cp .env.example .env.local
```

| Variable | Where to find it | Notes |
|----------|------------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | Public (protected by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | **Secret** — powers the public share page. Server-only. |
| `NEXT_PUBLIC_SITE_URL` | Your app's origin | `http://localhost:3000` locally; your domain in production |

### 5. Email delivery (for OTP)
Supabase's built-in email is rate-limited (~2/hour) and only reaches your own
account address. For real delivery, configure **custom SMTP** (e.g. Resend) in
Supabase → Authentication → Emails → SMTP Settings. Custom SMTP also unlocks
editing the email templates (add `{{ .Token }}` to show the numeric code).

### 6. Run
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Project structure

```
app/
  (auth)/            # sign-in, sign-up, verify (split-screen layout)
  (app)/             # authenticated app: dashboard, files (shared shell)
  auth/confirm/      # magic-link callback route handler
  share/[id]/        # public share page
  layout.tsx         # root layout (theme, fonts, toaster)
components/
  layout/            # sidebar, topbar, search, theme toggle
  ui/                # shadcn/ui primitives
features/
  auth/              # auth forms
  files/             # upload, file card, preview/share/rename dialogs, actions
lib/
  supabase/          # browser / server / admin / proxy clients
  data/              # RLS-scoped read queries
  actions/           # server actions (auth)
  validations/       # zod schemas
  dal.ts             # Data Access Layer (auth gate)
proxy.ts             # route protection + session refresh (Next 16 "middleware")
supabase/schema.sql  # database schema
```

## Architecture notes

- **Auth**: `proxy.ts` does optimistic redirects; the **DAL** (`lib/dal.ts`) is
  the authoritative gate, and every Server Action re-checks the user.
- **Authorization**: RLS ensures a user can only read/write their own rows and
  storage objects. The service-role admin client is used *only* on the public
  share page, and only for files explicitly marked `is_public`.
- **Uploads** go client-side straight to Storage (for progress via XHR); a
  Server Action then records metadata with a server-derived owner + category.

## Deploy to Vercel

1. Push to GitHub and import the repo in Vercel.
2. Add all four environment variables (above) in the Vercel project settings.
   Set `NEXT_PUBLIC_SITE_URL` to your production domain.
3. In Supabase → Authentication → URL Configuration, add your production domain
   to the **Redirect URLs** allowlist.
4. Deploy. (Run `supabase/schema.sql` against your project if you haven't.)

## License

MIT — for learning/demo purposes.
