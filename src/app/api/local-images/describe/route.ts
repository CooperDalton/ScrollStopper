import { NextRequest, NextResponse } from 'next/server'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject, type ModelMessage } from 'ai'
import { z } from 'zod'

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

		const { imageDataUrl } = await req.json()
		if (!imageDataUrl || typeof imageDataUrl !== 'string') {
			return NextResponse.json({ error: 'Missing imageDataUrl' }, { status: 400 })
		}

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
					{ type: 'image' as const, image: imageDataUrl },
				],
			},
		]

		const { object } = await (generateObject as any)({
			model: openai('gpt-4o'),
			schema,
			messages,
		})

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

		return NextResponse.json({
			short_description: object.short_description,
			long_description: object.long_description,
			categories: normalizedCategories,
			objects: normalizedObjects,
		})
	} catch (err) {
		console.error('Local image describe error:', err)
		const message = err instanceof Error ? err.message : String(err)
		const stack = err instanceof Error ? err.stack : undefined
		return NextResponse.json(
			{
				error: 'Failed to describe local image',
				details: process.env.NODE_ENV !== 'production' ? { message, stack } : undefined,
			},
			{ status: 500 }
		)
	}
}


