import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase-service'
import { assertAdminOrThrow } from '@/lib/admin'

export const runtime = 'nodejs'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await assertAdminOrThrow()
    const { id } = await ctx.params
    const form = await req.formData()

    // Support multiple files: either multiple 'file' fields or a single FileList named 'files'
    const files: File[] = []
    for (const [key, value] of form.entries()) {
      if (value instanceof File && (key === 'file' || key === 'files')) {
        if (value.size > 0) files.push(value)
      }
    }
    if (files.length === 0) {
      return NextResponse.json({ error: 'Missing file(s)' }, { status: 400 })
    }

    const supabase = createServiceSupabaseClient()

    // Ensure collection exists
    const { data: collection, error: collErr } = await supabase
      .from('public_image_collections')
      .select('id')
      .eq('id', id)
      .single()
    if (collErr || !collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    const created: any[] = []
    const errors: Array<{ name: string; error: string }> = []

    for (const file of files) {
      try {
        const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
        const unique = `${Date.now()}_${Math.random().toString(36).slice(2)}`
        const storagePath = `collections/${id}/${unique}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('public-images')
          .upload(storagePath, file, { contentType: file.type })
        if (uploadErr) throw uploadErr

        const dims = await getImageDimensions(file).catch(() => ({ width: null as number | null, height: null as number | null }))
        const aspect = dims.width && dims.height ? `${dims.width}:${dims.height}` : null

        const { data: image, error: dbErr } = await supabase
          .from('public_images')
          .insert({
            collection_id: id,
            storage_path: storagePath,
            mime_type: file.type || null,
            bytes: (file as any).size ?? null,
            width: dims.width,
            height: dims.height,
            aspect_ratio: aspect,
            metadata: {},
          })
          .select()
          .single()
        if (dbErr) throw dbErr

        created.push(image)
      } catch (e: any) {
        errors.push({ name: file.name, error: e?.message || 'Upload failed' })
      }
    }

    return NextResponse.json({ images: created, errors })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

async function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: (img as any).naturalWidth || (img as any).width || 0, height: (img as any).naturalHeight || (img as any).height || 0 })
      URL.revokeObjectURL(img.src)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(blob)
  })
}


