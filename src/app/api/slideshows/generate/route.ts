import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject, streamText } from 'ai'
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
          size: z.number().describe("24-60 pixel size"),
        })
      ),
    })
  ),
})

export async function POST(req: NextRequest) {
  try {
    const { productId, prompt, selectedImageIds, selectedCollectionIds, aspectRatio } = await req.json()
    if (!productId || typeof productId !== 'string') {
      return new Response('Missing productId', { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    // Fetch product and classification fields
    const { data: product } = await supabase
      .from('products')
      .select('id, name, description, industry, product_type, matching_industries, matching_product_types')
      .eq('id', productId)
      .eq('user_id', user.id)
      .single()

    if (!product) return new Response('Product not found', { status: 404 })

    // Fetch product images context (ai_description + user_description)
    let query = supabase
      .from('product_images')
      .select('id, ai_description, user_description')
      .eq('product_id', productId)
      .eq('user_id', user.id)
    if (Array.isArray(selectedImageIds) && selectedImageIds.length > 0) {
      query = query.in('id', selectedImageIds)
    }
    // Include images from selected collections, if provided (via join through images table)
    let extraCollectionImages: any[] = []
    if (Array.isArray(selectedCollectionIds) && selectedCollectionIds.length > 0) {
      const extraQuery = supabase
        .from('images')
        .select('id, metadata, collection_id')
        .in('collection_id', selectedCollectionIds)
      const { data: extraData } = await extraQuery
      extraCollectionImages = extraData || []
    }
    const { data: images } = await query

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

    const numImages = imageItems.length
    let imageContextStr = ''
    if (numImages < 100) {
      imageContextStr = JSON.stringify(imageItems)
    } else if (numImages <= 500) {
      imageContextStr = JSON.stringify(
        imageItems.map(({ ref, short_description, categories, objects }) => ({ ref, short_description, categories, objects }))
      )
    } else {
      imageContextStr = JSON.stringify(
        imageItems.map(({ ref, categories, objects }) => ({ ref, categories, objects }))
      )
    }

    // Example slideshow retrieval
    const industries = ((product as any).industry || []) as string[]
    const productTypes = ((product as any).product_type || []) as string[]
    const matchingIndustries = ((product as any).matching_industries || []) as string[]
    const matchingProductTypes = ((product as any).matching_product_types || []) as string[]

    const candidates = new Set<string>([
      ...industries,
      ...productTypes,
      ...matchingIndustries,
      ...matchingProductTypes,
    ])

    let exampleRows: any[] = []
    if (candidates.size > 0) {
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
    } else {
      const { data: exAll } = await supabase
        .from('slide_examples')
        .select('id, industry, product_type, format, call_to_action, summary')
        .limit(20)
      exampleRows = exAll || []
    }

    // Compute canvas bounds from aspect ratio (AI guidance)
    const ar = typeof aspectRatio === 'string' && /^(\d+):(\d+)$/.test(aspectRatio) ? aspectRatio : '9:16'
    const [aw, ah] = ar.split(':').map((n: string) => parseInt(n, 10) || 9)
    const CANVAS_WIDTH = 300
    const CANVAS_MAX_HEIGHT = Math.round((CANVAS_WIDTH * ah) / aw)

    // Prepare messages
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

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          // 1) Stream planning thoughts
          const plan = await streamText({
            model: openai('gpt-5'),
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: userPlan },
            ],
          })

          const reader = plan.textStream.getReader()
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            const chunk = typeof value === 'string' ? value : String(value)
            controller.enqueue(encoder.encode(`event: thought\n`))
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))
          }

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
                size: z.number().describe('24-60 pixel size'),
              }),
            }),
          })

          const { object } = await generateObject({
            model: openai('gpt-5'),
            schema: SchemaWithHints,
            messages: [
              { role: 'system', content: systemJson },
              { role: 'user', content: userJson },
            ],
          })

          controller.enqueue(encoder.encode(`event: thoughtln\n`))
          controller.enqueue(encoder.encode(`data: --- JSON READY ---\n\n`))
          controller.enqueue(encoder.encode(`event: json\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(object)}\n\n`))
        } catch (e) {
          controller.enqueue(encoder.encode(`event: thoughtln\n`))
          controller.enqueue(encoder.encode(`data: ERROR: ${(e as Error).message}\n\n`))
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    return new Response('Server error', { status: 500 })
  }
}


