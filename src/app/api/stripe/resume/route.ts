import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

// POST /api/stripe/resume
// Resumes a subscription previously scheduled to cancel at period end.
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
      apiVersion: '2025-12-15.clover',
    });

    // Find an active/trialing/past_due subscription
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

    // If not scheduled to cancel, just acknowledge
    if (!subscription.cancel_at_period_end) {
      return NextResponse.json({
        ok: true,
        alreadyActive: true,
        currentPeriodEnd: (subscription as any).current_period_end
          ? new Date((subscription as any).current_period_end * 1000).toISOString()
          : null,
      });
    }

    const updated = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: false,
    });

    return NextResponse.json({
      ok: true,
      alreadyActive: false,
      currentPeriodEnd: (updated as any).current_period_end
        ? new Date((updated as any).current_period_end * 1000).toISOString()
        : null,
    });
  } catch (err) {
    console.error('Stripe resume error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

