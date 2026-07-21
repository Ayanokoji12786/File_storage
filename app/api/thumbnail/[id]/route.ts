import { NextResponse } from 'next/server'

import { requireUser } from '@/lib/dal'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { STORAGE_BUCKET } from '@/lib/storage'

/**
 * Streams a file's thumbnail. Access control is RLS on `files` — the lookup
 * only returns a row (and therefore a thumbnail) for a file the caller owns,
 * that's public, or that was shared with them; everything else is a 404.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await requireUser()

  const supabase = await createClient()
  const { data: file } = await supabase
    .from('files')
    .select('thumbnail_path')
    .eq('id', id)
    .single()

  if (!file?.thumbnail_path) {
    return new NextResponse(null, { status: 404 })
  }

  // Redirect to a short-lived signed URL rather than streaming the bytes
  // through this server — the object goes straight from Storage to the
  // browser, so thumbnails don't consume app bandwidth or block a worker.
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(file.thumbnail_path, 60 * 60)

  if (error || !data) {
    return new NextResponse(null, { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl, {
    headers: { 'Cache-Control': 'private, max-age=1800' },
  })
}
