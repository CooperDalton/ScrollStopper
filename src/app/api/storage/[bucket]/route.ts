import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Stream a private storage object to the client using the current user's session.
// Usage: /api/storage/user-images?path=<encoded path>
//        /api/storage/rendered-slides?path=<encoded path>
export async function GET(req: NextRequest, { params }: { params: { bucket: string } }) {
  try {
    const bucket = params.bucket
    if (!bucket || (bucket !== 'user-images' && bucket !== 'rendered-slides')) {
      return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')
    if (!path) {
      return NextResponse.json({ error: 'Missing path' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase.storage.from(bucket).download(path)
    if (error || !data) {
      // Surface auth errors clearly
      const status = (error as any)?.statusCode || (error as any)?.status || 403
      return NextResponse.json({ error: (error as any)?.message || 'Forbidden' }, { status })
    }

    // Best-effort content type detection
    const contentType = (data as any).type || 'application/octet-stream'

    return new NextResponse(data as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Cache privately in the browser to avoid repeated downloads during a session
        'Cache-Control': 'private, max-age=900',
      },
    })
  } catch (err) {
    console.error('Storage proxy error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}


