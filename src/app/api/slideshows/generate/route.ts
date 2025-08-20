import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createOpenAI } from '@ai-sdk/openai'
import { google } from "@ai-sdk/google"
import { generateObject, streamText, NoObjectGeneratedError, streamObject, tool, stepCountIs } from 'ai'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const openai = createOpenAI()

// Tooling constraints
const MAX_TOOL_ROUNDS = 6
const MAX_LONGS_PER_ROUND = 40

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
      // Optional filtering by explicitly selectedImageIds
      if (Array.isArray(selectedImageIds) && selectedImageIds.length > 0) {
        const selectedSet = new Set<string>(selectedImageIds)
        extraCollectionImages = extraCollectionImages.filter((img: any) => selectedSet.has(img.id))
      }
      console.log('[slideshow-generate] Found', extraCollectionImages.length, 'extra collection images')
    }

    // Build product images context (from product_images)
    const productImageItems = (images || []).map((img, idx) => {
      const ai = (img as any).ai_description || ''
      const userDesc = (img as any).user_description || ''
      const long_description = ai || userDesc
      const short_description = (long_description || '').split('.').slice(0, 1).join('.').trim()
      return {
        ref: (img as any).id as string, // use actual database id as ref
        short_description,
        long_description,
        categories: [] as string[],
        objects: [] as string[],
      }
    })

    // Build collection images context (from images table -> selected collections)
    const collectionImageItems: any[] = []
    const extras = extraCollectionImages as any[]
    for (let i = 0; i < extras.length; i++) {
      const meta = (extras[i]?.metadata as any) || {}
      const short_description = typeof meta.short_description === 'string' ? meta.short_description : ''
      const long_description = typeof meta.long_description === 'string' ? meta.long_description : short_description
      const categories = Array.isArray(meta.categories) ? meta.categories : []
      const objects = Array.isArray(meta.objects) ? meta.objects : []
      collectionImageItems.push({
        ref: (extras[i] as any).id as string, // use actual database id as ref
        short_description,
        long_description,
        categories,
        objects,
      })
    }

    console.log('[slideshow-generate] Product image items:', productImageItems.length)
    console.log('[slideshow-generate] Collection image items:', collectionImageItems.length)

    // Serialize contexts separately so the AI can distinguish sources
    const toShortForm = ({ ref, short_description, categories, objects }: any) => ({ ref, short_description, categories, objects })
    const toMinimalForm = ({ ref, categories, objects }: any) => ({ ref, categories, objects })

    let productImageContextStr = ''
    productImageContextStr = JSON.stringify(productImageItems)

    const numCollectionImages = collectionImageItems.length
    let collectionImageContextStr = ''
    if (numCollectionImages < 100) {
      console.log('[slideshow-generate] Using full collection image context (< 100 images)')
      collectionImageContextStr = JSON.stringify(collectionImageItems)
    } else if (numCollectionImages <= 500) {
      console.log('[slideshow-generate] Using short collection image context (100-500 images)')
      collectionImageContextStr = JSON.stringify(collectionImageItems.map(toShortForm))
    } else {
      console.log('[slideshow-generate] Using minimal collection image context (> 500 images)')
      collectionImageContextStr = JSON.stringify(collectionImageItems.map(toMinimalForm))
    }

    // Define tools available during the planning step
    const planningTools = {
      getExampleSummaries: tool({
        description: 'Summaries of successful slideshows by filters',
        inputSchema: z.object({
          industry: z.string().optional(),
          product_type: z.string().optional(),
          format: z.string().optional(),
          limit: z.number().int().min(1).max(12).default(8),
        }),
        execute: async ({ industry, product_type, format, limit }) => {
          let query = supabase
            .from('slide_examples')
            .select('id, industry, product_type, format, call_to_action, summary')
            .limit(limit ?? 8)

          if (industry) query = query.eq('industry', industry)
          if (product_type) query = query.eq('product_type', product_type)
          if (format) query = query.eq('format', format)
          const { data } = await query
          return data || []
        },
      }),

      getExampleSchemas: tool({
        description: 'Full slideshow examples by id (reconstructed from frames)',
        inputSchema: z.object({ ids: z.array(z.string()).min(1).max(6) }),
        execute: async ({ ids }) => {
          const { data } = await supabase
            .from('slide_example_frames')
            .select('example_id, frame_index, image_url, description, text_on_slide')
            .in('example_id', ids)
          const grouped: Record<string, any> = {}
          for (const row of data || []) {
            const list = (grouped[row.example_id] ||= [])
            list.push({
              frame_index: row.frame_index,
              image_url: row.image_url,
              description: row.description,
              text_on_slide: row.text_on_slide,
            })
          }
          const result = Object.entries(grouped).map(([example_id, frames]) => ({
            id: example_id,
            frames: (frames as any[]).sort((a, b) => a.frame_index - b.frame_index),
          }))
          return result
        },
      }),

      listImagesBrief: tool({
        description: 'List candidate images as briefs from selected collections',
        inputSchema: z.object({
          collection_ids: z.array(z.string()).min(1),
          filters: z.object({
            categories: z.array(z.string()).optional(),
            objects: z.array(z.string()).optional(),
          }).optional(),
          limit: z.number().int().min(1).max(500).default(200),
        }),
        execute: async ({ collection_ids, filters, limit }) => {
          const { data } = await supabase
            .from('images')
            .select('id, metadata, categories, objects, collection_id')
            .in('collection_id', collection_ids)
            .limit(limit ?? 200)

          let items = (data || []).map((img: any) => {
            const meta = (img.metadata as any) || {}
            return {
              id: img.id as string,
              short: typeof meta.short_description === 'string' ? meta.short_description : '',
              categories: Array.isArray(img.categories) ? img.categories : [],
              objects: Array.isArray(img.objects) ? img.objects : [],
            }
          })

          if (filters?.categories?.length) {
            const set = new Set(filters.categories)
            items = items.filter(i => i.categories?.some((c: string) => set.has(c)))
          }
          if (filters?.objects?.length) {
            const set = new Set(filters.objects)
            items = items.filter(i => i.objects?.some((o: string) => set.has(o)))
          }
          return items
        },
      }),

      getImagesLong: tool({
        description: 'Fetch long descriptions for images by id',
        inputSchema: z.object({ ids: z.array(z.string()).min(1).max(50) }),
        execute: async ({ ids }) => {
          const { data } = await supabase
            .from('images')
            .select('id, metadata')
            .in('id', ids)
          return (data || []).map((img: any) => {
            const meta = (img.metadata as any) || {}
            const long_description = typeof meta.long_description === 'string' ? meta.long_description : (typeof meta.short_description === 'string' ? meta.short_description : '')
            return { id: img.id as string, long: long_description }
          })
        },
      }),
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
    const system = [
      'You are a TikTok/Instagram ad slideshow generator.',
      'First, think out loud to plan. Later you will return ONLY JSON.',
      `Tool usage rules:`,
      `- Max tool rounds: ${MAX_TOOL_ROUNDS}. Use at most one brief and one long fetch per round.`,
      `- Always request more long descriptions than strictly needed (target ${MAX_LONGS_PER_ROUND}).`,
      `- If briefs are incoherent for the intended story, try a different (categories, objects) filter.`,
      `- If examples are requested or relevant, fetch 4–8 summaries, then at most 2 full example schemas.`,
      `- Use image_id references (the ref fields provided) in the final plan.`,
      `- If no examples match, ignore examples and follow the user brief directly.`,
      `- Stop and produce the slideshow JSON once you have enough high-confidence images.`,
    ].join('\n')
    const userPlan = [
      `Product: ${product.name || ''}`,
      `Description: ${product.description || ''}`,
      `Industry: ${JSON.stringify(industries)}`,
      `Product Type: ${JSON.stringify(productTypes)}`,
      `Matching Industries: ${JSON.stringify(matchingIndustries)}`,
      `Matching Product Types: ${JSON.stringify(matchingProductTypes)}`,
      `Prompt: ${typeof prompt === 'string' ? prompt : ''}`,
      '',
      'Allowed Product Images (use ref field only; refs are actual database ids):',
      productImageContextStr,
      '',
      'Allowed Collection Images (use ref field only; refs are actual database ids):',
      collectionImageContextStr,
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
              tools: planningTools,
              stopWhen: stepCountIs(MAX_TOOL_ROUNDS),
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
          const systemJson = `You are a TikTok/Instagram ad slideshow generator. Reply only with JSON matching the schema. Use provided image refs (actual database ids) and examples as inspiration. The canvas is ${CANVAS_WIDTH}x${CANVAS_MAX_HEIGHT} pixels.`
          const userJson = [
            `Product: ${product.name || ''}`,
            `Description: ${product.description || ''}`,
            `Industry: ${JSON.stringify(industries)}`,
            `Product Type: ${JSON.stringify(productTypes)}`,
            `Matching Industries: ${JSON.stringify(matchingIndustries)}`,
            `Matching Product Types: ${JSON.stringify(matchingProductTypes)}`,
            `Prompt: ${typeof prompt === 'string' ? prompt : ''}`,
            '',
            'Allowed Product Images (use ref field only; refs are actual database ids):',
            productImageContextStr,
            '',
            'Allowed Collection Images (use ref field only; refs are actual database ids):',
            collectionImageContextStr,
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
            // Map image refs (ids) to proxied URLs for client rendering
            let mappedObj = finalObj
            try {
              const collectIds = () => {
                const ids = new Set<string>()
                const slides = (finalObj as any)?.slides
                if (Array.isArray(slides)) {
                  for (const s of slides) {
                    const bg = s?.background_image_ref
                    if (typeof bg === 'string' && bg.length > 0) ids.add(bg)
                    const ovs = s?.overlays
                    if (Array.isArray(ovs)) {
                      for (const o of ovs) {
                        const ir = o?.image_ref
                        if (typeof ir === 'string' && ir.length > 0) ids.add(ir)
                      }
                    }
                  }
                }
                return Array.from(ids)
              }
              const allIds = collectIds()
              if (allIds.length > 0) {
                const [imgRes, prodImgRes] = await Promise.all([
                  supabase
                    .from('images')
                    .select('id, storage_path, file_path')
                    .in('id', allIds),
                  supabase
                    .from('product_images')
                    .select('id, storage_path')
                    .in('id', allIds),
                ])

                const rowsA = imgRes.data || []
                const rowsB = prodImgRes.data || []
                const idToUrl = new Map<string, string>()
                const toUrl = (p?: string | null) => (p ? `/api/storage/user-images?path=${encodeURIComponent(p)}` : '')
                for (const r of rowsA as any[]) {
                  const path = r.storage_path || r.file_path
                  const url = toUrl(path)
                  if (url) idToUrl.set(r.id as string, url)
                }
                for (const r of rowsB as any[]) {
                  const path = r.storage_path
                  const url = toUrl(path)
                  if (url) idToUrl.set(r.id as string, url)
                }

                const slides = (finalObj as any)?.slides
                if (Array.isArray(slides)) {
                  mappedObj = {
                    ...(finalObj as any),
                    slides: slides.map((s: any) => ({
                      ...s,
                      background_image_ref: typeof s.background_image_ref === 'string' && idToUrl.has(s.background_image_ref)
                        ? idToUrl.get(s.background_image_ref)
                        : s.background_image_ref,
                      overlays: Array.isArray(s.overlays)
                        ? s.overlays.map((o: any) => ({
                            ...o,
                            image_ref: typeof o.image_ref === 'string' && idToUrl.has(o.image_ref)
                              ? idToUrl.get(o.image_ref)
                              : o.image_ref,
                          }))
                        : s.overlays,
                    })),
                  }
                }
              }
            } catch (mapErr) {
              console.error('[slideshow-generate] Failed to map image refs to URLs:', mapErr)
            }
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
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(mappedObj)}\n\n`))
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


