import { NextRequest, NextResponse } from 'next/server'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject, type ModelMessage } from 'ai'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'edge'

const schema = z.object({
  short_description: z.string().describe('A 1 sentence description of the image. Be factual so an LLM understands the image.'),
  long_description: z.string().describe('A 5-8 sentence description of the image. Be factual so an LLM understands the image. If people present describe them in detail so an AI could differentiate between them, such as race and facial features.'),
  categories: z.array(z.string()).describe('List of high-level tags for the image'),
  objects: z.array(z.string()).describe('List of prominent objects in the image'),
})

const openai = createOpenAI()

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Missing OPENAI_API_KEY on server' }, { status: 500 })
    }
    const { imageUrl, imageId } = await req.json()
    if (!imageId || typeof imageId !== 'string') {
      return NextResponse.json({ error: 'Missing imageId' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    // Primary: look up the image to get the storage path
    let storagePath: string | undefined
    {
      const { data: imageRow, error: imageFetchError } = await supabase
        .from('images')
        .select('id, storage_path, file_path')
        .eq('id', imageId)
        .single()

      if (!imageFetchError && imageRow) {
        storagePath = (imageRow as any).storage_path || (imageRow as any).file_path
      }
    }

    // Fallback: if not found (race/session), try deriving from provided imageUrl
    if (!storagePath && imageUrl && typeof imageUrl === 'string') {
      try {
        const url = new URL(imageUrl, 'http://localhost')
        // Expect format: /api/storage/user-images?path=<encoded>
        const maybePath = url.searchParams.get('path')
        if (maybePath) storagePath = maybePath
      } catch {}
    }

    if (!storagePath) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Generate a short-lived signed URL that OpenAI can access
    const { data: signed, error: signError } = await supabase.storage
      .from('user-images')
      .createSignedUrl(storagePath, 60 * 10) // 10 minutes

    if (signError || !signed?.signedUrl) {
      return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
    }

    const signedUrl = signed.signedUrl

    console.log('AI describe using signed URL for image:', imageId)
    // Optional reachability check (helps catch bad URLs early)
    try {
      const head = await fetch(signedUrl, { method: 'HEAD' })
      if (!head.ok) {
        console.warn('Signed image URL not reachable:', head.status)
      }
    } catch (e) {
      console.warn('HEAD check failed for signed image URL:', e)
    }

    // Gate by test Pro flag stored in localStorage on client; server cannot read it.
    // In MVP we allow calling this endpoint; pricing gate will be enforced later.

    const systemPrompt = `You are an AI that describes a single image precisely.
Return a concise JSON with:
- short_description: 1 sentence
- long_description: 5-8 sentences
- categories: high-level tags
- objects: list of prominent objects (1-10)
Be factual. Do not mention watermarks. Do not include brand names unless clearly visible.`

    const messages: ModelMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text' as const, text: 'Describe this image following the schema.' },
          { type: 'image' as const, image: signedUrl },
        ],
      },
    ]

    const { object } = await (generateObject as any)({
      model: openai('gpt-4o'),
      schema,
      messages,
    })

    // Normalize arrays to lowercase for consistency
    const normalizedCategories = Array.isArray(object.categories)
      ? object.categories
          .filter((c: unknown) => typeof c === 'string')
          .map((c: string) => c.toLowerCase())
      : []
    const normalizedObjects = Array.isArray(object.objects)
      ? object.objects
          .filter((o: unknown) => typeof o === 'string')
          .map((o: string) => o.toLowerCase())
      : []

    // Persist AI metadata on server (under the authenticated user)
    // Use the same supabase client to persist metadata

    // Fetch existing metadata to merge safely
    const { data: existing, error: fetchError } = await supabase
      .from('images')
      .select('id, metadata')
      .eq('id', imageId)
      .single()

    if (fetchError) {
      console.error('Failed fetching image for metadata merge:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch image for update' }, { status: 500 })
    }

    const existingMetadata = (existing?.metadata as Record<string, unknown> | null) || {}
    const mergedMetadata: Record<string, unknown> = {
      ...existingMetadata,
      short_description: object.short_description,
      long_description: object.long_description,
      categories: normalizedCategories,
      objects: normalizedObjects,
    }

    const { error: updateError, data: updated } = await supabase
      .from('images')
      .update({ metadata: mergedMetadata })
      .eq('id', imageId)
      .select()
      .single()

    if (updateError) {
      console.error('Failed updating image metadata with AI result:', updateError)
      return NextResponse.json({ error: 'Failed to update image metadata' }, { status: 500 })
    }

    console.log('AI image describe result saved for image:', imageId)
    return NextResponse.json({
      ...object,
      categories: normalizedCategories,
      objects: normalizedObjects,
    })
  } catch (err) {
    console.error('AI describe error:', err)
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    return NextResponse.json(
      {
        error: 'Failed to describe image',
        details: process.env.NODE_ENV !== 'production' ? { message, stack } : undefined,
      },
      { status: 500 }
    )
  }
}


