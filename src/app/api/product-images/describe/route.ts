import { NextRequest, NextResponse } from 'next/server'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText, type ModelMessage } from 'ai'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'edge'

const openai = createOpenAI()

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Missing OPENAI_API_KEY on server' }, { status: 500 })
    }

    const { imageId, imageUrl } = await req.json()
    if (!imageId || typeof imageId !== 'string') {
      return NextResponse.json({ error: 'Missing imageId' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    console.log('[api:product-images/describe] request body imageId=', imageId, 'imageUrl=', imageUrl)

    // Primary: look up the product image to get the storage path
    let storagePath: string | undefined
    {
      const { data: imageRow, error: imageFetchError } = await supabase
        .from('product_images')
        .select('id, storage_path')
        .eq('id', imageId)
        .single()

      console.log('[api:product-images/describe] fetched product_images row:', { err: imageFetchError, found: !!imageRow })
      if (!imageFetchError && imageRow) {
        storagePath = (imageRow as any).storage_path
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
      console.warn('[api:product-images/describe] storagePath not resolved for imageId', imageId)
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Generate a short-lived signed URL that OpenAI can access
    const { data: signed, error: signError } = await supabase.storage
      .from('user-images')
      .createSignedUrl(storagePath, 60 * 10) // 10 minutes

    if (signError || !signed?.signedUrl) {
      console.error('[api:product-images/describe] createSignedUrl failed:', signError)
      return NextResponse.json({ error: 'Failed to create signed URL' }, { status: 500 })
    }

    const signedUrl = signed.signedUrl

    console.log('AI describe (product image) using signed URL for image:', imageId)
    // Optional reachability check (helps catch bad URLs early)
    try {
      const head = await fetch(signedUrl, { method: 'HEAD' })
      if (!head.ok) {
        console.warn('Signed product image URL not reachable:', head.status)
      }
    } catch (e) {
      console.warn('HEAD check failed for signed product image URL:', e)
    }

    // Gate by plan later; allowed in MVP

    const systemPrompt = `You are an AI that describes a single product-related image precisely.
Return exactly three sentences suitable for internal product understanding.
Be factual. Do not mention watermarks. Do not include brand names unless clearly visible.`

    const messages: ModelMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text' as const, text: 'Describe this product image in three factual sentences.' },
          { type: 'image' as const, image: signedUrl },
        ],
      },
    ]

    const { text } = await (generateText as any)({
      model: openai('gpt-4o'),
      messages,
    })

    const description = (text || '').trim()
    console.log('[api:product-images/describe] model returned description len=', description.length)

    // Persist AI description on server under authenticated user
    const { data: updateData, error: updateError } = await supabase
      .from('product_images')
      .update({ ai_description: description })
      .eq('id', imageId)
      .select()
      .single()

    if (updateError) {
      console.error('Failed updating product image with AI description:', updateError)
      return NextResponse.json({ error: 'Failed to update product image description' }, { status: 500 })
    }

    console.log('AI product image description saved for image:', imageId, 'row:', updateData)
    return NextResponse.json({ description })
  } catch (err) {
    console.error('AI product image describe error:', err)
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    return NextResponse.json(
      {
        error: 'Failed to describe product image',
        details: process.env.NODE_ENV !== 'production' ? { message, stack } : undefined,
      },
      { status: 500 }
    )
  }
}


