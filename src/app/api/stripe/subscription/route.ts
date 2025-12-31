import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

// GET /api/stripe/subscription
// Returns the user’s current Stripe subscription status and cancellation flags.
export async function GET(_request: NextRequest) {
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
      return NextResponse.json({
        hasCustomer: false,
        isSubscribed: false,
        status: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        canceledAt: null,
      });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-12-15.clover',
    });

    // Prefer an active/trialing/past_due subscription; else report last canceled if present.
    const preferredStatuses: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due'];
    let subscription: Stripe.Subscription | null = null;
    for (const status of preferredStatuses) {
      const list = await stripe.subscriptions.list({ customer: customerId, status, limit: 1 });
      if (list.data.length > 0) {
        subscription = list.data[0]!;
        break;
      }
    }

    if (!subscription) {
      // Fall back to the most recent canceled subscription, if any
      const canceledList = await stripe.subscriptions.list({ customer: customerId, status: 'canceled', limit: 1 });
      const canceled = canceledList.data[0] || null;
      return NextResponse.json({
        hasCustomer: true,
        isSubscribed: false,
        status: canceled ? canceled.status : null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: (canceled as any)?.current_period_end ? new Date((canceled as any).current_period_end * 1000).toISOString() : null,
        canceledAt: canceled?.canceled_at ? new Date(canceled.canceled_at * 1000).toISOString() : null,
      });
    }

    return NextResponse.json({
      hasCustomer: true,
      isSubscribed: subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due',
      status: subscription.status,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      currentPeriodEnd: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000).toISOString() : null,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    });
  } catch (err) {
    console.error('Stripe subscription status error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

