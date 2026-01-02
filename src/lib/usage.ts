import { createServiceSupabaseClient } from '@/lib/supabase-service';
import { subscriptionTiers } from '@/data/subscriptionTiers';
import Stripe from 'stripe';

export type UsageMetric = 'slideshows' | 'ai_generations';

function toISODate(d: Date | number) {
  const date = typeof d === 'number' ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export async function getSubscriptionPeriod(service: ReturnType<typeof createServiceSupabaseClient>, userId: string) {
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
        period_start: toISODate(sub.items.data[0]!.current_period_start * 1000),
        period_end: toISODate(sub.items.data[0]!.current_period_end * 1000),
      };
    }
  }

  return null;
}

export async function incrementUsage(userId: string, metric: UsageMetric, amount: number = 1) {
  const service = createServiceSupabaseClient();

  // Determine plan to set hard limits for the period
  const { data: profile } = await service
    .from('users')
    .select('role, stripe_subscription_status')
    .eq('id', userId)
    .single();

  const isSubscribed =
    profile?.role === 'pro' ||
    profile?.stripe_subscription_status === 'active' ||
    profile?.stripe_subscription_status === 'trialing';

  const tier = isSubscribed ? subscriptionTiers.Pro : subscriptionTiers.Free;
  
  // Compute period bounds: prefer Stripe subscription cycle; else calendar month
  let periodBounds = await getSubscriptionPeriod(service, userId);
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
    .eq('user_id', userId)
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
        user_id: userId,
        metric,
        period_start,
        period_end,
        used: amount,
        hard_limit,
      });
    if (insertError) {
      console.error('[usage] insert error', insertError);
      throw new Error('Failed to insert usage');
    }
    return { ok: true, used: amount, hard_limit };
  }

  const newUsed = Number(existing.used || 0) + amount;
  const { error: updateError } = await service
    .from('usage_counters')
    .update({ used: newUsed, hard_limit })
    .eq('user_id', userId)
    .eq('metric', metric)
    .eq('period_start', period_start);
    
  if (updateError) {
    console.error('[usage] update error', updateError);
    throw new Error('Failed to update usage');
  }
  return { ok: true, used: newUsed, hard_limit };
}
