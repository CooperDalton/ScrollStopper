import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

// POST /api/stripe/cancel
// Schedules the active subscription to cancel at period end for the current user.
export async function POST(_request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
    }

    const customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      return NextResponse.json({ error: 'No Stripe customer found' }, { status: 404 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });

    // Find an active or trialing subscription
    const statuses: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due'];
    let subscription: Stripe.Subscription | null = null;
    for (const status of statuses) {
      const list = await stripe.subscriptions.list({ customer: customerId, status, limit: 1 });
      if (list.data.length > 0) {
        subscription = list.data[0]!;
        break;
      }
    }

    if (!subscription) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    // If already set to cancel at period end, just acknowledge
    if (subscription.cancel_at_period_end) {
      return NextResponse.json({
        ok: true,
        alreadyCanceled: true,
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
      });
    }

    const updated = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    return NextResponse.json({
      ok: true,
      alreadyCanceled: false,
      currentPeriodEnd: updated.current_period_end
        ? new Date(updated.current_period_end * 1000).toISOString()
        : null,
    });
  } catch (err) {
    console.error('Stripe cancel error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

