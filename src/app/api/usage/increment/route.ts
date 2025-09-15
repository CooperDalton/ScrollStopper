import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createServiceSupabaseClient } from '@/lib/supabase-service';
import { subscriptionTiers } from '@/data/subscriptionTiers';

export const runtime = 'nodejs';

const bodySchema = z.object({
  metric: z.enum(['slideshows', 'ai_generations']),
  amount: z.number().int().min(1).optional().default(1),
});

function getPeriodBounds(today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const toDate = (d: Date) => d.toISOString().slice(0, 10);
  return { period_start: toDate(start), period_end: toDate(end) };
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => ({}));
    const { metric, amount } = bodySchema.parse(json);

    // Identify the user via auth cookies
    const userClient = await createServerSupabaseClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const service = createServiceSupabaseClient();

    // Determine plan to set hard limits for the period
    const { data: profile } = await service
      .from('users')
      .select('role, stripe_subscription_status')
      .eq('id', user.id)
      .single();

    const isSubscribed =
      profile?.role === 'pro' ||
      profile?.stripe_subscription_status === 'active' ||
      profile?.stripe_subscription_status === 'trialing';

    const tier = isSubscribed ? subscriptionTiers.Pro : subscriptionTiers.Free;
    const { period_start, period_end } = getPeriodBounds();

    // Fetch existing
    const { data: existing } = await service
      .from('usage_counters')
      .select('used, hard_limit')
      .eq('user_id', user.id)
      .eq('metric', metric)
      .eq('period_start', period_start)
      .single();

    const hard_limit = metric === 'ai_generations'
      ? tier.maxNumberOfAIGenerations
      : tier.maxNumberOfSlideshows;

    if (!existing) {
      const { error: insertError } = await service
        .from('usage_counters')
        .insert({
          user_id: user.id,
          metric,
          period_start,
          period_end,
          used: amount,
          hard_limit,
        });
      if (insertError) {
        console.error('[usage] insert error', insertError);
        return NextResponse.json({ error: 'Failed to insert usage' }, { status: 500 });
      }
      return NextResponse.json({ ok: true, used: amount, hard_limit });
    }

    const newUsed = Number(existing.used || 0) + amount;
    const { error: updateError } = await service
      .from('usage_counters')
      .update({ used: newUsed, hard_limit })
      .eq('user_id', user.id)
      .eq('metric', metric)
      .eq('period_start', period_start);
    if (updateError) {
      console.error('[usage] update error', updateError);
      return NextResponse.json({ error: 'Failed to update usage' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, used: newUsed, hard_limit });
  } catch (err: any) {
    console.error('[usage] endpoint error', err);
    return NextResponse.json({ error: err?.message || 'Bad request' }, { status: 400 });
  }
}

