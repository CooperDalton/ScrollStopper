import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createOpenAI } from '@ai-sdk/openai'
import { google } from "@ai-sdk/google"
import { generateObject, streamText, NoObjectGeneratedError, streamObject } from 'ai'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const openai = createOpenAI()

const SlideshowSchema = z.object({
  caption: z.string(),
  slides: z.array(
    z.object({
      background_image_ref: z.string().nullable().optional(),
      texts: z.array(
        z.object({
          text: z.string(),
          position_x: z.number().describe("0-300 pixels right (where 0 is left edge)"),
          position_y: z.number().describe("0-500 pixels down (where 0 is top edge)"),
          size: z.number().describe("24-60 pixel size"),
        })
      ),
      overlays: z.array(
        z.object({
          image_ref: z.string(),
          position_x: z.number().describe("0-300 pixels right (where 0 is left edge)"),
          position_y: z.number().describe("0-500 pixels down (where 0 is top edge)"),
          rotation: z.number().describe("0-360 degrees"),
          size: z.number() // TODO: add size description
        })
      ),
    })
  ),
})

export async function POST(req: NextRequest) {
  try {
    console.log('[slideshow-generate] Starting generation request')
    const { productId, prompt, selectedImageIds, selectedCollectionIds, aspectRatio } = await req.json()
    if (!productId || typeof productId !== 'string') {
      console.log('[slideshow-generate] Missing productId')
      return new Response('Missing productId', { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })
    console.log('[slideshow-generate] User authenticated:', user.id)

    // Fetch product and classification fields
    console.log('[slideshow-generate] Fetching product:', productId)
    const { data: product } = await supabase
      .from('products')
      .select('id, name, description, industry, product_type, matching_industries, matching_product_types')
      .eq('id', productId)
      .eq('user_id', user.id)
      .single()

    if (!product) return new Response('Product not found', { status: 404 })
    console.log('[slideshow-generate] Product found:', product.name)

    // Fetch product images context (ai_description + user_description)
    console.log('[slideshow-generate] Fetching product images')
    const { data: images } = await supabase
      .from('product_images')
      .select('id, ai_description, user_description')
      .eq('product_id', productId)
      .eq('user_id', user.id)
    console.log('[slideshow-generate] Found', images?.length || 0, 'product images')

    // Include images from selected collections, if provided (via join through images table)
    let extraCollectionImages: any[] = []
    if (Array.isArray(selectedCollectionIds) && selectedCollectionIds.length > 0) {
      console.log('[slideshow-generate] Fetching images from selected collections:', selectedCollectionIds)
      const extraQuery = supabase
        .from('images')
        .select('id, metadata, collection_id')
        .in('collection_id', selectedCollectionIds)
      const { data: extraData } = await extraQuery
      extraCollectionImages = extraData || []
      console.log('[slideshow-generate] Found', extraCollectionImages.length, 'extra collection images')
    }

    const imageItems = (images || []).map((img, idx) => {
      const ai = (img as any).ai_description || ''
      const userDesc = (img as any).user_description || ''
      const long_description = ai || userDesc
      const short_description = (long_description || '').split('.').slice(0, 1).join('.').trim()
      return {
        ref: `img_${idx + 1}`,
        short_description,
        long_description,
        categories: [] as string[],
        objects: [] as string[],
      }
    })

    // Append extra images from selected collections (metadata-based context only)
    const extras = extraCollectionImages as any[]
    for (let i = 0; i < extras.length; i++) {
      const meta = (extras[i]?.metadata as any) || {}
      const short_description = typeof meta.short_description === 'string' ? meta.short_description : ''
      const long_description = typeof meta.long_description === 'string' ? meta.long_description : short_description
      const categories = Array.isArray(meta.categories) ? meta.categories : []
      const objects = Array.isArray(meta.objects) ? meta.objects : []
      imageItems.push({
        ref: `col_${i + 1}`,
        short_description,
        long_description,
        categories,
        objects,
      })
    }
    console.log('[slideshow-generate] Total image context items:', imageItems.length)

    const numImages = imageItems.length
    let imageContextStr = ''
    if (numImages < 100) {
      console.log('[slideshow-generate] Using full image context (< 100 images)')
      imageContextStr = JSON.stringify(imageItems)
    } else if (numImages <= 500) {
      console.log('[slideshow-generate] Using short image context (100-500 images)')
      imageContextStr = JSON.stringify(
        imageItems.map(({ ref, short_description, categories, objects }) => ({ ref, short_description, categories, objects }))
      )
    } else {
      console.log('[slideshow-generate] Using minimal image context (> 500 images)')
      imageContextStr = JSON.stringify(
        imageItems.map(({ ref, categories, objects }) => ({ ref, categories, objects }))
      )
    }

    // Example slideshow retrieval
    console.log('[slideshow-generate] Fetching example slideshows')
    const industries = ((product as any).industry || []) as string[]
    const productTypes = ((product as any).product_type || []) as string[]
    const matchingIndustries = ((product as any).matching_industries || []) as string[]
    const matchingProductTypes = ((product as any).matching_product_types || []) as string[]
    console.log('[slideshow-generate] Product classifications:', { industries, productTypes, matchingIndustries, matchingProductTypes })

    const candidates = new Set<string>([
      ...industries,
      ...productTypes,
      ...matchingIndustries,
      ...matchingProductTypes,
    ])

    let exampleRows: any[] = []
    if (candidates.size > 0) {
      console.log('[slideshow-generate] Looking for examples matching candidates:', Array.from(candidates))
      const { data: ex1 } = await supabase
        .from('slide_examples')
        .select('id, industry, product_type, format, call_to_action, summary')
        .in('industry', Array.from(candidates))
        .limit(15)
      const { data: ex2 } = await supabase
        .from('slide_examples')
        .select('id, industry, product_type, format, call_to_action, summary')
        .in('product_type', Array.from(candidates))
        .limit(15)
      exampleRows = [ ...(ex1 || []), ...(ex2 || []) ]
      console.log('[slideshow-generate] Found', exampleRows.length, 'matching examples')
    } else {
      console.log('[slideshow-generate] No candidates, fetching general examples')
      const { data: exAll } = await supabase
        .from('slide_examples')
        .select('id, industry, product_type, format, call_to_action, summary')
        .limit(20)
      exampleRows = exAll || []
      console.log('[slideshow-generate] Found', exampleRows.length, 'general examples')
    }

    // Compute canvas bounds from aspect ratio (AI guidance)
    const ar = typeof aspectRatio === 'string' && /^(\d+):(\d+)$/.test(aspectRatio) ? aspectRatio : '9:16'
    const [aw, ah] = ar.split(':').map((n: string) => parseInt(n, 10) || 9)
    const CANVAS_WIDTH = 300
    const CANVAS_MAX_HEIGHT = Math.round((CANVAS_WIDTH * ah) / aw)
    console.log('[slideshow-generate] Canvas dimensions:', { aspectRatio: ar, width: CANVAS_WIDTH, maxHeight: CANVAS_MAX_HEIGHT })

    // Prepare messages
    console.log('[slideshow-generate] Preparing AI messages')
    const system = 'You are a TikTok/Instagram ad slideshow generator. You will first think out loud to plan. Later you will return ONLY JSON.'
    const userPlan = [
      `Product: ${product.name || ''}`,
      `Description: ${product.description || ''}`,
      `Industry: ${JSON.stringify(industries)}`,
      `Product Type: ${JSON.stringify(productTypes)}`,
      `Matching Industries: ${JSON.stringify(matchingIndustries)}`,
      `Matching Product Types: ${JSON.stringify(matchingProductTypes)}`,
      `Prompt: ${typeof prompt === 'string' ? prompt : ''}`,
      '',
      'Allowed Images (use ref field only):',
      imageContextStr,
      '',
      'Relevant Example Slideshows (summaries):',
      JSON.stringify(exampleRows, null, 2),
      '',
      'Plan out loud how you will: choose a format, pick images by ref, write slide texts, and timing. Do not output JSON yet.'
    ].join('\n')
    console.log('[slideshow-generate] Starting streaming response')

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          console.log('[slideshow-generate] Starting planning phase')
          // 1) Stream planning thoughts (no fallback)
          {
            const plan = await streamText({
              model: google("models/gemini-2.5-flash"),
              messages: [
                { role: 'system', content: system },
                { role: 'user', content: userPlan },
              ],
            })
            console.log('[slideshow-generate] Planning stream created, reading chunks')
            const reader = plan.textStream.getReader()
            while (true) {
              const { value, done } = await reader.read()
              if (done) break
              const chunk = typeof value === 'string' ? value : String(value)
              console.log('[slideshow-generate] Planning chunk:', chunk.length, 'chars')
              controller.enqueue(encoder.encode(`event: thought\n`))
              controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))
            }
          }
          console.log('[slideshow-generate] Planning complete, starting JSON generation')

          // 2) Generate final JSON strictly
          const systemJson = `You are a TikTok/Instagram ad slideshow generator. Reply only with JSON matching the schema. Use provided image refs and examples as inspiration. The canvas is ${CANVAS_WIDTH}x${CANVAS_MAX_HEIGHT} pixels.`
          const userJson = [
            `Product: ${product.name || ''}`,
            `Description: ${product.description || ''}`,
            `Industry: ${JSON.stringify(industries)}`,
            `Product Type: ${JSON.stringify(productTypes)}`,
            `Matching Industries: ${JSON.stringify(matchingIndustries)}`,
            `Matching Product Types: ${JSON.stringify(matchingProductTypes)}`,
            `Prompt: ${typeof prompt === 'string' ? prompt : ''}`,
            '',
            'Allowed Images (use ref field only):',
            imageContextStr,
            '',
            'Relevant Example Slideshows (summaries):',
            JSON.stringify(exampleRows, null, 2),
          ].join('\n')

          // Update schema field descriptions with computed bounds
          const SchemaWithHints = SlideshowSchema.extend({
            slides: SlideshowSchema.shape.slides.element.extend({
              texts: SlideshowSchema.shape.slides.element.shape.texts.element.extend({
                position_x: z.number().describe(`0-${CANVAS_WIDTH} pixels right (where 0 is left edge)`),
                position_y: z.number().describe(`0-${CANVAS_MAX_HEIGHT} pixels down (where 0 is top edge)`),
                size: z.number().describe('24-60 pixel size'),
              }),
              overlays: SlideshowSchema.shape.slides.element.shape.overlays.element.extend({
                position_x: z.number().describe(`0-${CANVAS_WIDTH} pixels right (where 0 is left edge)`),
                position_y: z.number().describe(`0-${CANVAS_MAX_HEIGHT} pixels down (where 0 is top edge)`),
                rotation: z.number().describe('0-360 degrees'),
                size: z.number() // TODO: add size description
              }),
            }),
          })
          console.log('[slideshow-generate] Calling streamObject for structured JSON')

          try {
            const { partialObjectStream, object, response, usage } = await streamObject({
              model: google("models/gemini-2.5-flash"),
              schema: SchemaWithHints,
              schemaName: 'Slideshow',
              schemaDescription: 'A slideshow specification with caption and slides.',
              messages: [
                { role: 'system', content: systemJson },
                { role: 'user', content: userJson },
              ],
            })

            // forward partials
            for await (const partial of partialObjectStream) {
              try {
                controller.enqueue(encoder.encode(`event: json.partial\n`))
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(partial)}\n\n`))
              } catch {}
            }

            const finalObj = await object
            console.log('[slideshow-generate] JSON generation successful, object keys:', Object.keys(finalObj || {}))
            try {
              const meta = await response
              console.log('[slideshow-generate] Provider response metadata:', meta)
            } catch {}
            if (usage) {
              try {
                const u = await usage
                if (u) console.log('[slideshow-generate] Token usage:', u)
              } catch {}
            }

            controller.enqueue(encoder.encode(`event: thoughtln\n`))
            controller.enqueue(encoder.encode(`data: --- JSON READY ---\n\n`))
            controller.enqueue(encoder.encode(`event: json\n`))
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalObj)}\n\n`))
            console.log('[slideshow-generate] Stream complete')
          } catch (err) {
            if ((NoObjectGeneratedError as any).isInstance?.(err)) {
              const e: any = err
              console.error('[slideshow-generate] NoObjectGeneratedError: cause=', e?.cause)
              console.error('[slideshow-generate] NoObjectGeneratedError: text=', e?.text)
              console.error('[slideshow-generate] NoObjectGeneratedError: response=', e?.response)
              console.error('[slideshow-generate] NoObjectGeneratedError: usage=', e?.usage)
            }
            throw err
          }
        } catch (e) {
          console.error('[slideshow-generate] Error in stream:', e)
          controller.enqueue(encoder.encode(`event: thoughtln\n`))
          controller.enqueue(encoder.encode(`data: ERROR: ${(e as Error).message}\n\n`))
        } finally {
          controller.close()
        }
      }
    })
    console.log('[slideshow-generate] Returning stream response')

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[slideshow-generate] Top-level error:', error)
    return new Response('Server error', { status: 500 })
  }
}


