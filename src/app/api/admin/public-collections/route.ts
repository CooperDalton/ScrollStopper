import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-service'
import { assertAdminOrThrow } from '@/lib/admin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    await assertAdminOrThrow()

    const { name } = await req.json()
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const supabase = createServiceSupabaseClient()
    const { data: collection, error } = await supabase
      .from('public_image_collections')
      .insert({ name })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ collection })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}


