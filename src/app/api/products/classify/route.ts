import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const runtime = 'edge'

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '' })

const classificationSchema = z.object({
  industry: z.array(z.string()).describe('One or more industries that the product belongs to. Use concise, general industry labels.'),
  product_type: z.array(z.string()).describe('One or more product type categories. Use concise, general product type labels.'),
})

const matchingSchema = z.object({
  matching_industries: z.array(z.string()).describe('Subset of provided slide example industries that best match the product.'),
  matching_product_types: z.array(z.string()).describe('Subset of provided slide example product_types that best match the product.'),
})

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({ error: 'Missing GOOGLE_GENERATIVE_AI_API_KEY on server' }, { status: 500 })
    }

    const { productId } = await req.json().catch(() => ({}))
    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ error: 'Missing productId' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch product (verify ownership)
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, description, user_id')
      .eq('id', productId)
      .eq('user_id', user.id)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Fetch product images descriptions to provide context
    const { data: images } = await supabase
      .from('product_images')
      .select('id, user_description, ai_description')
      .eq('product_id', productId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const imageSnippets = (images || [])
      .map((img) => [img.user_description, img.ai_description].filter(Boolean).join(' \n'))
      .filter(Boolean)
      .slice(0, 25) // cap context

    // 1) Classify product industry and product_type
    const classificationPrompt = [
      'You are an expert product classifier for marketing content creation.',
      'Given a product name, description, and related image descriptions, return JSON with:',
      '- industry: array of industries (concise, general labels)',
      '- product_type: array of product types (concise, general labels)',
      'Return empty arrays if uncertain. Do not invent highly niche labels unless clearly warranted.',
      '',
      `Product name: ${product.name || ''}`,
      `Product description: ${product.description || ''}`,
      '',
      'Image descriptions (may be empty):',
      imageSnippets.length ? imageSnippets.map((t, i) => `- [${i + 1}] ${t}`).join('\n') : '(none)'
    ].join('\n')

    const { object: classified } = await generateObject({
      model: google('gemini-3-flash-preview'),
      schema: classificationSchema,
      prompt: classificationPrompt,
    })

    const industry: string[] = Array.isArray((classified as any)?.industry) 
      ? (classified as any).industry.map((i: string) => i.toLowerCase().trim()).filter(Boolean)
      : []
    const product_type: string[] = Array.isArray((classified as any)?.product_type) 
      ? (classified as any).product_type.map((p: string) => p.toLowerCase().trim()).filter(Boolean)
      : []

    // 2) Pull slide example candidates
    const { data: slideExamples } = await supabase
      .from('slide_examples')
      .select('industry, product_type')

    const slideIndustries = Array.from(
      new Set(
        (slideExamples || [])
          .map((r) => (r.industry || '').toLowerCase().trim())
          .filter((v) => typeof v === 'string' && v.length > 0)
      )
    )
    const slideProductTypes = Array.from(
      new Set(
        (slideExamples || [])
          .map((r) => (r.product_type || '').toLowerCase().trim())
          .filter((v) => typeof v === 'string' && v.length > 0)
      )
    )

    let matching_industries: string[] = []
    let matching_product_types: string[] = []

    if (slideIndustries.length || slideProductTypes.length) {
      const matchingPrompt = [
        'Select the closest matches from provided slide example labels to the given product labels.',
        'Only pick from the given candidates. If none are good, return empty arrays.',
        '',
        `Product industries: ${JSON.stringify(industry)}`,
        `Product product_types: ${JSON.stringify(product_type)}`,
        '',
        `Candidate industries: ${JSON.stringify(slideIndustries)}`,
        `Candidate product_types: ${JSON.stringify(slideProductTypes)}`,
      ].join('\n')

      const { object: matching } = await generateObject({
        model: google('gemini-3-flash-preview'),
        schema: matchingSchema,
        prompt: matchingPrompt,
      })

      matching_industries = Array.isArray((matching as any)?.matching_industries) 
        ? (matching as any).matching_industries.map((i: string) => i.toLowerCase().trim()).filter(Boolean)
        : []
      matching_product_types = Array.isArray((matching as any)?.matching_product_types) 
        ? (matching as any).matching_product_types.map((p: string) => p.toLowerCase().trim()).filter(Boolean)
        : []
    }

    // Normalize empties to null for DB if desired
    const normalizedIndustry = industry.length ? industry : null
    const normalizedProductType = product_type.length ? product_type : null
    const normalizedMatchingIndustries = matching_industries.length ? matching_industries : null
    const normalizedMatchingProductTypes = matching_product_types.length ? matching_product_types : null

    // Update the product row
    await supabase
      .from('products')
      .update({
        industry: normalizedIndustry,
        product_type: normalizedProductType,
        matching_industries: normalizedMatchingIndustries,
        matching_product_types: normalizedMatchingProductTypes,
      })
      .eq('id', productId)
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      industry: normalizedIndustry,
      product_type: normalizedProductType,
      matching_industries: normalizedMatchingIndustries,
      matching_product_types: normalizedMatchingProductTypes,
    })
  } catch (error) {
    console.error('[api:products/classify] error:', error)
    return NextResponse.json({ error: 'Failed to classify product' }, { status: 500 })
  }
}


