import { NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-service'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = createServiceSupabaseClient()

    const { data: collections, error } = await supabase
      .from('public_image_collections')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    const enriched = await Promise.all(
      (collections || []).map(async (c) => {
        const { data: sample } = await supabase
          .from('public_images')
          .select('id, storage_path, created_at')
          .eq('collection_id', c.id)
          .order('created_at', { ascending: false })
          .limit(4)

        const { count } = await supabase
          .from('public_images')
          .select('*', { count: 'exact', head: true })
          .eq('collection_id', c.id)

        return {
          ...c,
          sample_images: sample || [],
          image_count: count || 0,
          type: 'public' as const,
        }
      })
    )

    return NextResponse.json({ collections: enriched })
  } catch (error) {
    console.error('Public collections error:', error)
    return NextResponse.json({ error: 'Failed to fetch public collections' }, { status: 500 })
  }
}


