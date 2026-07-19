# Nimbus — a Google Drive clone

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
In the Supabase dashboard → **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql).
It creates the `files` table (with RLS policies) and a private `files` storage
bucket (with per-user folder policies).

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
