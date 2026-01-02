import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { incrementUsage } from '@/lib/usage';

export const runtime = 'nodejs';

const bodySchema = z.object({
  metric: z.enum(['slideshows', 'ai_generations']),
  amount: z.number().int().min(1).optional().default(1),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({}));
    const { metric, amount } = bodySchema.parse(json);

    // Identify the user via auth cookies
    const userClient = await createServerSupabaseClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await incrementUsage(user.id, metric, amount);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[usage] endpoint error', err);
    return NextResponse.json({ error: err?.message || 'Bad request' }, { status: 400 });
  }
}
