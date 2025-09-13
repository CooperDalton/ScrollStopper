import { NextRequest, NextResponse } from 'next/server'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject, type ModelMessage } from 'ai'
import { z } from 'zod'
import { createServiceSupabaseClient } from '@/lib/supabase-service'

export const runtime = 'edge'

const schema = z.object({
  short_description: z.string(),
  long_description: z.string(),
  categories: z.array(z.string()),
  objects: z.array(z.string()),
})

const openai = createOpenAI()

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Missing OPENAI_API_KEY on server' }, { status: 500 })
    }
    const { imageId } = await req.json()
    if (!imageId || typeof imageId !== 'string') {
      return NextResponse.json({ error: 'Missing imageId' }, { status: 400 })
    }

    const supabase = createServiceSupabaseClient()

    // Lookup image and make sure it's in public_images
    const { data: imageRow, error: imageFetchError } = await supabase
      .from('public_images')
      .select('id, storage_path')
      .eq('id', imageId)
      .single()

    if (imageFetchError || !imageRow) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Signed URL not necessary for public bucket, but use short-lived signed URL to avoid hotlinking
    const { data: signed, error: signError } = await supabase.storage
      .from('public-images')
      .createSignedUrl(imageRow.storage_path, 60 * 10)
    if (signError || !signed?.signedUrl) {
      return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
    }
    const signedUrl = signed.signedUrl

    const systemPrompt = `You are an AI that describes a single image precisely.
Return a concise JSON with:
- short_description: 1 sentence
- long_description: 5-8 sentences
- categories: high-level tags
- objects: list of prominent objects (1-10)
Be factual. Do not mention watermarks. Do not include brand names unless clearly visible.`

    const messages: ModelMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: [ { type: 'text' as const, text: 'Describe this image following the schema.' }, { type: 'image' as const, image: signedUrl } ] },
    ]

    const { object } = await (generateObject as any)({
      model: openai('gpt-4o'),
      schema,
      messages,
    })

    const normalizedCategories = Array.isArray(object.categories)
      ? object.categories.filter((c: unknown) => typeof c === 'string').map((c: string) => c.toLowerCase())
      : []
    const normalizedObjects = Array.isArray(object.objects)
      ? object.objects.filter((o: unknown) => typeof o === 'string').map((o: string) => o.toLowerCase())
      : []

    // Persist AI metadata to public_images table
    const { error: updateError } = await supabase
      .from('public_images')
      .update({
        metadata: {
          short_description: object.short_description,
          long_description: object.long_description,
          categories: normalizedCategories,
          objects: normalizedObjects,
        },
        categories: normalizedCategories,
        objects: normalizedObjects,
      })
      .eq('id', imageId)

    if (updateError) {
      console.error('Failed updating public image metadata with AI result:', updateError)
      return NextResponse.json({ error: 'Failed to update image metadata' }, { status: 500 })
    }

    return NextResponse.json({
      short_description: object.short_description,
      long_description: object.long_description,
      categories: normalizedCategories,
      objects: normalizedObjects,
    })
  } catch (err) {
    console.error('Public AI describe error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Failed to describe image', details: process.env.NODE_ENV !== 'production' ? message : undefined }, { status: 500 })
  }
}


