import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createServiceSupabaseClient } from '@/lib/supabase-service';
import { subscriptionTiers } from '@/data/subscriptionTiers';
import Stripe from 'stripe';

export const runtime = 'nodejs';

const bodySchema = z.object({
  metric: z.enum(['slideshows', 'ai_generations']),
  amount: z.number().int().min(1).optional().default(1),
});

function toISODate(d: Date | number) {
  const date = typeof d === 'number' ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

async function getSubscriptionPeriod(service: ReturnType<typeof createServiceSupabaseClient>, userId: string) {
  // Try to base period on Stripe subscription if present
  const { data: profile } = await service
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  const customerId = profile?.stripe_customer_id as string | undefined;
  if (!customerId || !process.env.STRIPE_SECRET_KEY) {
    return null;
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-12-15.clover' });

  // Prefer active subscription; fallback to trialing
  const tryStatuses: Stripe.Subscription.Status[] = ['active', 'trialing'];
  for (const status of tryStatuses) {
    const list = await stripe.subscriptions.list({ customer: customerId, status, limit: 1 });
    const sub = list.data[0];
    if (sub) {
      return {
        period_start: toISODate((sub as any).current_period_start * 1000),
        period_end: toISODate((sub as any).current_period_end * 1000),
      };
    }
  }

  return null;
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
    // Compute period bounds: prefer Stripe subscription cycle; else calendar month
    let periodBounds = await getSubscriptionPeriod(service, user.id);
    if (!periodBounds) {
      const today = new Date();
      periodBounds = {
        period_start: toISODate(new Date(today.getFullYear(), today.getMonth(), 1)),
        period_end: toISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
      };
    }
    const { period_start, period_end } = periodBounds;

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
