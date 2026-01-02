import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createServiceSupabaseClient } from '@/lib/supabase-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
        console.log(`[Stripe Subscription] Found ${status} subscription:`, {
            id: subscription.id,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_end: subscription.current_period_end,
            status: subscription.status
        });
        break;
      }
    }

    // Sync the subscription status to Supabase to ensure consistency
    if (subscription) {
      const supabaseService = createServiceSupabaseClient();
      const status = subscription.status;
      const role = status === 'active' || status === 'trialing' ? 'pro' : 'free';
      
      // Determine cancellation status
      // In flexible billing / newer API versions, cancel_at_period_end might be false even if cancel_at is set.
      const isCanceling = Boolean(subscription.cancel_at_period_end || (subscription.cancel_at && subscription.cancel_at > Math.floor(Date.now() / 1000)));

      // Get current period end - check root first, then items (flexible billing fallback)
      const currentPeriodEndTimestamp = subscription.current_period_end ?? subscription.items.data[0]?.current_period_end;
      const currentPeriodEnd = currentPeriodEndTimestamp 
        ? new Date(currentPeriodEndTimestamp * 1000).toISOString() 
        : null;

      console.log('[Stripe Subscription] Syncing to Supabase:', {
          id: user.id,
          stripe_cancel_at_period_end: isCanceling,
          current_period_end: currentPeriodEnd
      });

      const { error: updateError } = await supabaseService.from('users').update({
        stripe_subscription_status: status,
        stripe_cancel_at_period_end: isCanceling,
        current_period_end: currentPeriodEnd,
        role: role,
        stripe_price_id: subscription.items.data[0]?.price.id
      }).eq('id', user.id);

      if (updateError) {
          console.error('[Stripe Subscription] Supabase update failed:', updateError);
      }
    }

    if (!subscription) {
      // Fall back to the most recent canceled subscription, if any
      const canceledList = await stripe.subscriptions.list({ customer: customerId, status: 'canceled', limit: 1 });
      const canceled = canceledList.data[0] || null;
      
      const canceledPeriodEndTimestamp = canceled?.current_period_end ?? canceled?.items.data[0]?.current_period_end;
      
      return NextResponse.json({
        hasCustomer: true,
        isSubscribed: false,
        status: canceled ? canceled.status : null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: canceledPeriodEndTimestamp
          ? new Date(canceledPeriodEndTimestamp * 1000).toISOString()
          : null,
        canceledAt: canceled?.canceled_at ? new Date(canceled.canceled_at * 1000).toISOString() : null,
      });
    }

    const currentPeriodEndTimestamp = subscription.current_period_end ?? subscription.items.data[0]?.current_period_end;
    const isCanceling = Boolean(subscription.cancel_at_period_end || (subscription.cancel_at && subscription.cancel_at > Math.floor(Date.now() / 1000)));

    return NextResponse.json({
      hasCustomer: true,
      isSubscribed: subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due',
      status: subscription.status,
      cancelAtPeriodEnd: isCanceling,
      currentPeriodEnd: currentPeriodEndTimestamp
        ? new Date(currentPeriodEndTimestamp * 1000).toISOString()
        : null,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    });
  } catch (err) {
    console.error('Stripe subscription status error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

