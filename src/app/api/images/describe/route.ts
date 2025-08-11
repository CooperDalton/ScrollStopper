import { NextRequest, NextResponse } from 'next/server'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject, type ModelMessage } from 'ai'
import { z } from 'zod'

export const runtime = 'edge'

const schema = z.object({
  short_description: z.string().describe('A 1 sentence description of the image. Be factual so an LLM understands the image.'),
  long_description: z.string().describe('A 3-5 sentence description of the image. Be factua so an LLM understands the image. If people present describe them in detail.'),
  categories: z.array(z.string()).describe('List of high-level tags for the image'),
  objects: z.array(z.string()).describe('List of prominent objects in the image'),
})

const openai = createOpenAI()

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Missing OPENAI_API_KEY on server' }, { status: 500 })
    }
    const { imageUrl } = await req.json()
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'Missing imageUrl' }, { status: 400 })
    }

    console.log('AI describe request imageUrl:', imageUrl)
    // Optional reachability check (helps catch bad URLs early)
    try {
      const head = await fetch(imageUrl, { method: 'HEAD' })
      if (!head.ok) {
        console.warn('Image URL not reachable:', imageUrl, head.status)
      }
    } catch (e) {
      console.warn('HEAD check failed for image URL:', imageUrl, e)
    }

    // Gate by test Pro flag stored in localStorage on client; server cannot read it.
    // In MVP we allow calling this endpoint; pricing gate will be enforced later.

    const systemPrompt = `You are an assistant that describes a single image precisely for product showcase slideshows.
Return a concise JSON with:
- short_description: 1 sentence
- long_description: 3-5 sentences
- categories: high-level tags
- objects: list of prominent objects (1-10)
Be factual. Do not mention watermarks. Do not include brand names unless clearly visible.`

    const messages: ModelMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text' as const, text: 'Describe this image following the schema.' },
          { type: 'image' as const, image: imageUrl },
        ],
      },
    ]

    const { object } = await (generateObject as any)({
      model: openai('gpt-4o'),
      schema,
      messages,
    })
    console.log('AI image describe result:', object)
    return NextResponse.json(object)
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


