import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createOpenAI } from '@ai-sdk/openai'
import { google } from "@ai-sdk/google"
import { generateObject, streamText, NoObjectGeneratedError, streamObject, tool, stepCountIs } from 'ai'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { incrementUsage } from '@/lib/usage'
import { FONT_SIZES, getMaxCharsForFontSize, getSafeTextBounds, validateTextPosition } from '@/lib/text-config'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const openai = createOpenAI()

// Tooling constraints
const MAX_TOOL_ROUNDS = 6
const MAX_LONGS_PER_ROUND = 40

// Slideshow schema factory
const createSlideshowSchema = (collectionRefs: string[], productRefs: string[], slideCount: number, canvasWidth: number, canvasMaxHeight: number) => {
  // Ensure we have at least one collection image for backgrounds
  if (collectionRefs.length === 0) {
    throw new Error('At least one collection image is required for backgrounds')
  }
  
  return z.object({
    caption: z.string().describe("Overall caption for the slideshow"),
    slides: z.array(z.object({
      background_image_ref: z.enum(collectionRefs as [string, ...string[]]).describe("Collection image ref for background (REQUIRED)"),
      texts: z.array(z.object({
        text: z.string().describe("Text content for the slide - use \\n for line breaks within the same paragraph, don't split paragraphs into multiple text objects"),
        position_x: z.number().min(40).max(canvasWidth - 40).describe(`Safe positioning X: ${40}-${canvasWidth - 40} pixels (text centers around this point, so avoid edges)`),
        position_y: z.number().min(40).max(canvasMaxHeight - 40).describe(`Safe positioning Y: ${40}-${canvasMaxHeight - 40} pixels (text centers around this point, so avoid edges)`),
        size: z.number().refine((val) => FONT_SIZES.includes(val as any), {
          message: `Font size must be one of: ${FONT_SIZES.join(', ')}`
        }).describe(`Font size - must be one of: ${FONT_SIZES.join(', ')}`),
      })).min(1).describe("Array of text overlays - at least one required"),
      overlays: z.array(z.object({
        image_ref: productRefs.length > 0 
          ? z.enum(productRefs as [string, ...string[]]).describe("Product image ref for overlay")
          : z.string().describe("Product image ref for overlay"),
        position_x: z.number().min(0).max(canvasWidth).describe(`0-${canvasWidth} pixels right`),
        position_y: z.number().min(0).max(canvasMaxHeight).describe(`0-${canvasMaxHeight} pixels down`),
        rotation: z.number().min(0).max(360).describe("0-360 degrees"),
        size: z.number().min(10).max(100).describe("10-100 size percentage")
      })).describe("Array of image overlays - usually empty"),
    })).min(slideCount).max(slideCount).describe(`MUST contain exactly ${slideCount} slide objects`),
  })
}

export async function POST(req: NextRequest) {
  try {
    const { productId, prompt, selectedImageIds, selectedCollectionIds, selectedPublicCollectionIds, aspectRatio } = await req.json()
    if (!productId || typeof productId !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing productId' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Validate that at least one collection is selected (user or public)
    if ((!Array.isArray(selectedCollectionIds) || selectedCollectionIds.length === 0) && (!Array.isArray(selectedPublicCollectionIds) || selectedPublicCollectionIds.length === 0)) {
      return new Response(JSON.stringify({ 
        error: 'Please select at least one collection to generate a slideshow. Collection images are required for slide backgrounds.' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })

    // Increment usage counter (moved from client-side)
    try {
      await incrementUsage(user.id, 'ai_generations', 1)
    } catch (err: any) {
      // Note: We're not blocking generation on usage increment failure/limit for now,
      // as the user requested "crash if null" logic is not strictly applicable here but 
      // we want to ensure robustness. If you want to ENFORCE limits, throw here.
      // throw new Error('Usage limit reached or error tracking usage') 
    }

    // Fetch product and classification fields
    const { data: product } = await supabase
      .from('products')
      .select('id, name, description, industry, product_type, matching_industries, matching_product_types')
      .eq('id', productId)
      .eq('user_id', user.id)
      .single()

    if (!product) return new Response(JSON.stringify({ error: 'Product not found' }), { 
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })

    // Fetch product images context (ai_description + user_description)
    const { data: images } = await supabase
      .from('product_images')
      .select('id, ai_description, user_description')
      .eq('product_id', productId)
      .eq('user_id', user.id)

    // Include images from selected collections, if provided (via join through images table)
    let extraCollectionImages: any[] = []
    if ((Array.isArray(selectedCollectionIds) && selectedCollectionIds.length > 0) || (Array.isArray(selectedPublicCollectionIds) && selectedPublicCollectionIds.length > 0)) {
      // User collections (owned images)
      let userImages: any[] = []
      if (Array.isArray(selectedCollectionIds) && selectedCollectionIds.length > 0) {
        const { data: collectionsCheck } = await supabase
          .from('image_collections')
          .select('id, name, user_id')
          .in('id', selectedCollectionIds)
          .eq('user_id', user.id)

        const extraQuery = supabase
          .from('images')
          .select('id, metadata, collection_id, storage_path, user_id')
          .in('collection_id', selectedCollectionIds)
          .eq('user_id', user.id)
        const { data: extraData, error: queryError } = await extraQuery
        userImages = extraData || []
      }

      // Public collections
      let publicImages: any[] = []
      if (Array.isArray(selectedPublicCollectionIds) && selectedPublicCollectionIds.length > 0) {
        const { data: pubData, error: pubErr } = await supabase
          .from('public_images')
          .select('id, metadata, collection_id, storage_path')
          .in('collection_id', selectedPublicCollectionIds)
        if (pubErr) console.error('[slideshow-generate] Public query error:', pubErr)
        publicImages = pubData || []
      }

      // Merge (we will import public later on mapping if necessary)
      extraCollectionImages = [...userImages, ...publicImages]
      // Optional filtering by explicitly selectedImageIds
      if (Array.isArray(selectedImageIds) && selectedImageIds.length > 0) {
        const selectedSet = new Set<string>(selectedImageIds)
        extraCollectionImages = extraCollectionImages.filter((img: any) => selectedSet.has(img.id))
      }
    }

    // Build product images context with prompt-local refs
    const productImageItems = (images || []).map((img, idx) => {
      const ai = (img as any).ai_description || ''
      const userDesc = (img as any).user_description || ''
      const long_description = ai || userDesc
      const short_description = (long_description || '').split('.').slice(0, 1).join('.').trim()
      return {
        id: (img as any).id as string,
        ref: `p${String(idx + 1).padStart(2, '0')}`, // p01, p02, etc.
        short_description,
        long_description,
        categories: [] as string[],
        objects: [] as string[],
      }
    })

    // Build collection images context with prompt-local refs
    const collectionImageItems: any[] = []
    const extras = extraCollectionImages as any[]
    for (let i = 0; i < extras.length; i++) {
      const meta = (extras[i]?.metadata as any) || {}
      const short_description = typeof meta.short_description === 'string' ? meta.short_description : ''
      const long_description = typeof meta.long_description === 'string' ? meta.long_description : short_description
      const categories = Array.isArray(meta.categories) ? meta.categories : []
      const objects = Array.isArray(meta.objects) ? meta.objects : []
      collectionImageItems.push({
        id: (extras[i] as any).id as string,
        ref: `c${String(i + 1).padStart(2, '0')}`, // c01, c02, etc.
        short_description,
        long_description,
        categories,
        objects,
      })
    }

    // Create ref mapping for final JSON conversion
    const productRefMap = new Map<string, string>() // p01 -> uuid
    const collectionRefMap = new Map<string, string>() // c01 -> uuid
    productImageItems.forEach(item => productRefMap.set(item.ref, item.id))
    collectionImageItems.forEach(item => collectionRefMap.set(item.ref, item.id))


    // Serialize contexts separately so the AI can distinguish sources
    const toShortForm = ({ ref, short_description, categories, objects }: any) => ({ ref, short_description, categories, objects })
    const toMinimalForm = ({ ref, categories, objects }: any) => ({ ref, categories, objects })

    let productImageContextStr = ''
    productImageContextStr = JSON.stringify(productImageItems)

    const numCollectionImages = collectionImageItems.length
    let collectionImageContextStr = ''
    if (numCollectionImages < 100) {
      collectionImageContextStr = JSON.stringify(collectionImageItems)
    } else if (numCollectionImages <= 500) {
      collectionImageContextStr = JSON.stringify(collectionImageItems.map(toShortForm))
    } else {
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
          const result = (data || []).map((img: any) => {
            const meta = (img.metadata as any) || {}
            const long_description = typeof meta.long_description === 'string' ? meta.long_description : (typeof meta.short_description === 'string' ? meta.short_description : '')
            return { id: img.id as string, long: long_description }
          })
          return result
        },
      }),
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
    const planningPrompt = [
      'You are a TikTok/Instagram slideshow generator that creates engaging multi-slide content.',
      'CRITICAL: You must create MULTIPLE slides as requested by the user. The schema requires an array of slides.',
      '',
      'Process:',
      '1. First, use tools to explore available images and examples',
      '2. Plan your slideshow structure based on user requirements', 
      '3. Then generate structured JSON matching the exact schema',
      '',
      'Guidelines:',
      'Use a soft sell method. The user should not even realize they are being sold to. Such as casually recommending the product from the perspective of the user.',
      'The first slide is the most important and should hook the watcher in by creating a knowledge gap, curiosity, or problem.',
      '',
      '',
      'Tool usage rules:',
      `- Max tool rounds: ${MAX_TOOL_ROUNDS}. Use at most one brief and one long fetch per round.`,
      `- Always request more long descriptions than strictly needed (target ${MAX_LONGS_PER_ROUND}).`,
      `- If briefs are incoherent for the intended story, try a different (categories, objects) filter.`,
      `- If examples are requested or relevant, fetch 4–8 summaries, then at most 2 full example schemas.`,
      `- Use image_id references (the ref fields provided) in the final JSON.`,
      `- If no examples match, ignore examples and follow the user brief directly.`,
      '',
      'Image Usage Rules:',
      '- Background images: Use collection image refs (c01, c02, etc.) - EVERY slide MUST have a background',
      '- Overlay images: ONLY use product image refs (p01, p02, etc.), NEVER collection refs',
      '- If NO product images are available, do NOT add any overlays (leave overlays array empty)',
      '- Make sure all the background images have a similar',
      '- Even with product images available, use overlays SPARINGLY - most slides should have empty overlays',
      '- Only add overlays when they would significantly enhance the message or visual appeal',
      '- Use short refs like c01, p01 instead of full UUIDs - the system will map them automatically',
      '',
      'Text Formatting Rules:',
      `- Font sizes: Only use these exact values: ${FONT_SIZES.join(', ')}`,
      '- CRITICAL: Character limits per line by font size (MUST follow exactly):',
      ...FONT_SIZES.map(size => `  • ${size}px: MAX ${getMaxCharsForFontSize(size)} characters per line`),
      '- Almost always use less text than the character limit, it looks weird when the text spans the entire canvas',
      '- Use a smaller font size than you would normally use, it looks better when the text is smaller',
      '- When text exceeds character limits, use \\n within the SAME text object for line breaks',
      '- DO NOT split a single paragraph/sentence into multiple text objects',
      '- Multiple text objects should only be used for distinctly different text elements (e.g., title + body)',
      '- Each line after \\n must also respect the character limit for that font size',
      '',
      'Text Positioning Rules:',
      `- Canvas size: ${CANVAS_WIDTH}x${CANVAS_MAX_HEIGHT} pixels`,
      '- CRITICAL: Text positions are CENTER-ANCHORED - the coordinates specify where the text CENTER will be',
      '- Larger text and longer text takes more space, so avoid positioning large/long text near edges',
      '- Consider text length: longer text needs more horizontal spacing from edges',
      '',
      'JSON Requirements:',
      '- slides MUST be an array, even for single slides',
      '- texts and overlays MUST be arrays within each slide',
      '- Use short refs (c01, p01) from the provided image lists for background_image_ref and image_ref',
      '- Create the exact number of slides requested by the user',
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
      'Product Images (ONLY for overlays; use ref field like p01, p02):',
      productImageContextStr,
      '',
      'Collection Images (for backgrounds; use ref field like c01, c02):',
      collectionImageContextStr,
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
          // 1) Stream planning thoughts (no fallback)
          {
            const plan = await streamText({
              model: google("models/gemini-3-flash-preview"),
              messages: [
                { role: 'system', content: planningPrompt },
                { role: 'user', content: userPlan },
              ],
              tools: planningTools,
              stopWhen: stepCountIs(MAX_TOOL_ROUNDS),
            })
            const reader = plan.textStream.getReader()
            while (true) {
              const { value, done } = await reader.read()
              if (done) break
              const chunk = typeof value === 'string' ? value : String(value)
              controller.enqueue(encoder.encode(`event: thought\n`))
              controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))
            }
          }

          // 2) Generate final JSON strictly
          const slideCount = typeof prompt === 'string' && prompt.match(/(\d+)\s*slide/i) ? parseInt(prompt.match(/(\d+)\s*slide/i)![1], 10) : 3
          
          const systemJson = `You are a TikTok/Instagram slideshow generator. Reply ONLY with valid JSON matching the exact schema.

CRITICAL: You MUST generate exactly ${slideCount} slides in an array format.

REQUIRED JSON STRUCTURE:
{
  "caption": "string",
  "slides": [
    {
      "background_image_ref": "c01",
      "texts": [
        {
          "text": "Text on the slide",
          "position_x": 150,
          "position_y": 200,
          "size": 24
        }
      ],
      "overlays": []
    },
    {
      "background_image_ref": "c02", 
      "texts": [
        {
          "text": "Another slide text",
          "position_x": 150,
          "position_y": 200,
          "size": 16
        }
      ],
      "overlays": []
    }
    // ... repeat for ${slideCount} total slides
  ]
}

CONSTRAINTS:
- slides: MUST be array with ${slideCount} objects
- texts: MUST be array (even if just one text element)
- overlays: MUST be array (usually empty)
- background_image_ref: Use collection refs (c01, c02, etc.)
- Canvas: ${CANVAS_WIDTH}x${CANVAS_MAX_HEIGHT}px
- Font sizes: ONLY use these exact values: ${FONT_SIZES.join(', ')}
- CRITICAL CHARACTER LIMITS: Each line must not exceed the character limit for its font size:
  ${FONT_SIZES.map(size => `${size}px=MAX ${getMaxCharsForFontSize(size)} chars/line`).join(', ')}
- Use \\n within a single text object when text exceeds character limits
- DO NOT split paragraphs/sentences into multiple text objects - use \\n instead
- Multiple text objects only for different elements (e.g., separate title and body text)

TEXT POSITIONING (CENTER-ANCHORED):
- Text coordinates specify the CENTER point of the text, not top-left corner
- Account for text size when positioning near edges - larger text needs more space
- CRITICAL CHARACTER LIMITS: Each line must not exceed the character limit for its font size:
  ${FONT_SIZES.map(size => `• ${size}px: MAX ${getMaxCharsForFontSize(size)} characters per line`).join(', ')}
- Use \\n within a single text object when text exceeds character limits
- DO NOT split paragraphs/sentences into multiple text objects - use \\n instead
- Multiple text objects only for different elements (e.g., separate title and body text)
- Longer text needs more horizontal clearance from edges
- Prefer smaller font sizes than you would normally use, it looks better when the text is smaller
- Prefer center positions (X=${CANVAS_WIDTH / 2}) for better visual balance

Return ONLY the JSON object. No explanations, no markdown.`
          const userJson = [
            `Product: ${product.name || ''}`,
            `Description: ${product.description || ''}`,
            `Industry: ${JSON.stringify(industries)}`,
            `Product Type: ${JSON.stringify(productTypes)}`,
            `Matching Industries: ${JSON.stringify(matchingIndustries)}`,
            `Matching Product Types: ${JSON.stringify(matchingProductTypes)}`,
            `Prompt: ${typeof prompt === 'string' ? prompt : ''}`,
            '',
            'Product Images (ONLY for overlays; use ref field like p01, p02):',
            productImageContextStr,
            '',
            'Collection Images (for backgrounds; use ref field like c01, c02):',
            collectionImageContextStr,
            '',
            'Relevant Example Slideshows (summaries):',
            JSON.stringify(exampleRows, null, 2),
          ].join('\n')

          // Create dynamic schema with available refs
          const collectionRefs = collectionImageItems.map(item => item.ref)
          const productRefs = productImageItems.map(item => item.ref)
          
          if (collectionRefs.length === 0) {
            controller.enqueue(encoder.encode(`event: thoughtln\n`))
            controller.enqueue(encoder.encode(`data: ERROR: No collection images available for backgrounds. Please select at least one collection.\n\n`))
            return
          }
          
          // Create schema with all constraints
          const SchemaWithHints = createSlideshowSchema(collectionRefs, productRefs, slideCount, CANVAS_WIDTH, CANVAS_MAX_HEIGHT)

          try {
            // Try generateObject with explicit maxRetries
            const { object: finalObj, response, usage } = await generateObject({
              model: google("models/gemini-3-flash-preview"),
              schema: SchemaWithHints,
              schemaName: 'Slideshow',
              schemaDescription: `A slideshow with exactly ${slideCount} slides in array format. The slides array MUST contain ${slideCount} slide objects.`,
              messages: [
                { role: 'system', content: systemJson },
                { role: 'user', content: userJson },
              ],
              maxRetries: 3,
            })
            
            // Extensive validation and repair
            if (!finalObj || typeof finalObj !== 'object') {
              throw new Error('AI returned invalid object')
            }
            
            // Ensure slides is an array
            if (!Array.isArray((finalObj as any).slides)) {
              if (typeof (finalObj as any).slides === 'object' && (finalObj as any).slides !== null) {
                ;(finalObj as any).slides = [(finalObj as any).slides]
              } else {
                ;(finalObj as any).slides = Array.from({ length: slideCount }, (_, i) => ({
                  background_image_ref: collectionRefs[i % collectionRefs.length],
                  texts: [{ text: `Slide ${i + 1}`, position_x: 50, position_y: 100, size: 40 }],
                  overlays: []
                }))
              }
            }
            
            // Ensure we have the right number of slides
            const currentSlides = (finalObj as any).slides as any[]
            if (currentSlides.length < slideCount) {
              while (currentSlides.length < slideCount) {
                const template = currentSlides[currentSlides.length % currentSlides.length]
                currentSlides.push({
                  ...template,
                  background_image_ref: collectionRefs[currentSlides.length % collectionRefs.length]
                })
              }
            } else if (currentSlides.length > slideCount) {
              ;(finalObj as any).slides = currentSlides.slice(0, slideCount)
            }
            
            // Fix texts and overlays structure (ensure they're arrays)
            ;(finalObj as any).slides = (finalObj as any).slides.map((slide: any, index: number) => ({
              ...slide,
              background_image_ref: slide.background_image_ref || collectionRefs[index % collectionRefs.length],
              texts: Array.isArray(slide.texts) ? slide.texts : (slide.texts ? [slide.texts] : [{ text: `Slide ${index + 1}`, position_x: 50, position_y: 100, size: 40 }]),
              overlays: Array.isArray(slide.overlays) ? slide.overlays : (slide.overlays ? [slide.overlays] : [])
            }))

            // Validate and adjust text positions to prevent offscreen text
            let adjustmentCount = 0
            ;(finalObj as any).slides = (finalObj as any).slides.map((slide: any, slideIndex: number) => {
              if (!Array.isArray(slide.texts)) return slide
              
              const adjustedTexts = slide.texts.map((textObj: any, textIndex: number) => {
                const { text, position_x, position_y, size } = textObj
                
                if (typeof text !== 'string' || typeof position_x !== 'number' || 
                    typeof position_y !== 'number' || typeof size !== 'number') {
                  return textObj // Skip validation for invalid text objects
                }
                
                const validation = validateTextPosition(
                  text, size, position_x, position_y, CANVAS_WIDTH, CANVAS_MAX_HEIGHT
                )
                
                if (validation.adjusted) {
                  adjustmentCount++
                  return {
                    ...textObj,
                    position_x: validation.x,
                    position_y: validation.y
                  }
                }
                
                return textObj
              })
              
              return { ...slide, texts: adjustedTexts }
            })
            
            if (adjustmentCount > 0) {
            }
            
            // Map prompt-local refs to UUIDs then to proxied URLs for client rendering
            let mappedObj = finalObj
            try {
              const collectUUIDs = () => {
                const uuids = new Set<string>()
                const slides = (finalObj as any)?.slides
                if (Array.isArray(slides)) {
                  for (const s of slides) {
                    const bgRef = s?.background_image_ref
                    if (typeof bgRef === 'string' && collectionRefMap.has(bgRef)) {
                      uuids.add(collectionRefMap.get(bgRef)!)
                    }
                    const ovs = s?.overlays
                    if (Array.isArray(ovs)) {
                      for (const o of ovs) {
                        const imgRef = o?.image_ref
                        if (typeof imgRef === 'string' && productRefMap.has(imgRef)) {
                          uuids.add(productRefMap.get(imgRef)!)
                        }
                      }
                    }
                  }
                }
                return Array.from(uuids)
              }
              
              const allUUIDs = collectUUIDs()
              
              // Use the data we already fetched - no need to query again!
              const uuidToUrl = new Map<string, string>()
              const toUserUrl = (p?: string | null) => (p ? `/api/storage/user-images?path=${encodeURIComponent(p)}` : '')
              const toPublicUrl = (p?: string | null) => (p ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-images/${p}` : '')
              
              // Map collection images using data we already have (user + public)
              for (const img of extraCollectionImages) {
                const imgId = (img as any).id as string
                const path = (img as any).storage_path
                if (allUUIDs.includes(imgId) && path) {
                  // Heuristic: user images have user_id; public images do not
                  const isUser = typeof (img as any).user_id === 'string'
                  const url = isUser ? toUserUrl(path) : toPublicUrl(path)
                  if (url) {
                    uuidToUrl.set(imgId, url)
                  }
                }
              }
              
              // Map product images (if any)
              for (const img of images || []) {
                const imgId = (img as any).id as string
                const path = (img as any).storage_path
                if (allUUIDs.includes(imgId) && path) {
                  const url = toUserUrl(path)
                  if (url) {
                    uuidToUrl.set(imgId, url)
                  }
                }
              }
              

              const slides = (finalObj as any)?.slides
              if (Array.isArray(slides)) {
                mappedObj = {
                  ...(finalObj as any),
                  slides: slides.map((s: any, index: number) => {
                    const bgRef = s.background_image_ref
                    let mappedBg = bgRef
                    let mappedBgId = null

                    if (typeof bgRef === 'string' && collectionRefMap.has(bgRef)) {
                      const uuid = collectionRefMap.get(bgRef)!
                      const url = uuidToUrl.get(uuid)
                      if (url) {
                        mappedBg = url
                        mappedBgId = uuid
                      }
                    }

                    return {
                      ...s,
                      background_image_ref: mappedBg,
                      background_image_id: mappedBgId, // Add the UUID for database storage
                      overlays: Array.isArray(s.overlays)
                        ? s.overlays.map((o: any) => ({
                            ...o,
                            image_ref: typeof o.image_ref === 'string' && productRefMap.has(o.image_ref)
                              ? uuidToUrl.get(productRefMap.get(o.image_ref)!) || o.image_ref
                              : o.image_ref,
                          }))
                        : s.overlays,
                    }
                  }),
                }
              }
            } catch (mapErr) {
              console.error('[slideshow-generate] Failed to map refs to URLs:', mapErr)
            }
            try {
              await response
            } catch {}
            if (usage) {
              try {
                const u = await usage
              } catch {}
            }

            controller.enqueue(encoder.encode(`event: thoughtln\n`))
            controller.enqueue(encoder.encode(`data: --- JSON READY ---\n\n`))
            controller.enqueue(encoder.encode(`event: json\n`))
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(mappedObj)}\n\n`))
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

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[slideshow-generate] Top-level error:', error)
    return new Response(JSON.stringify({ error: 'Server error' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}


