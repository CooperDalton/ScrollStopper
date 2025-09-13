import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-service'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const supabase = createServiceSupabaseClient()

    // Ensure collection exists (optional but helpful for 404s)
    const { data: collection, error: collErr } = await supabase
      .from('public_image_collections')
      .select('id')
      .eq('id', id)
      .single()

    if (collErr || !collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    const { data: images, error } = await supabase
      .from('public_images')
      .select('id, storage_path, created_at, width, height, mime_type, bytes, categories, objects, metadata')
      .eq('collection_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ images: images || [] })
  } catch (error) {
    console.error('Public images error:', error)
    return NextResponse.json({ error: 'Failed to fetch public images' }, { status: 500 })
  }
}


