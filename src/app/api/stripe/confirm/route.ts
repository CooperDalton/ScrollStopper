import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceSupabaseClient } from '@/lib/supabase-service';

export const runtime = 'nodejs';

// GET /api/stripe/confirm?session_id=cs_test_...
// Confirms a successful checkout, updates the user's role to `pro`,
// and then redirects to the editor. This is a safety net in case
// webhooks are delayed or misconfigured.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  const origin = url.origin;

  if (!sessionId) {
    // Missing session_id: just send the user back; nothing we can do
    return NextResponse.redirect(`${origin}/editor`);
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    // Only proceed if the session actually completed
    if (session.status !== 'complete') {
      return NextResponse.redirect(`${origin}/editor`);
    }

    // Lookup user id from metadata (we set this at checkout creation)
    const userId = (session.metadata?.userId as string) || undefined;

    // Extract subscription info for status + price
    const subscription = session.subscription as Stripe.Subscription | null;
    const status = subscription?.status;
    const priceId = subscription?.items?.data?.[0]?.price?.id as string | undefined;

    if (userId) {
      const supabase = createServiceSupabaseClient();

      // Consider `active` and `trialing` as paid
      const role = status === 'active' || status === 'trialing' ? 'pro' : 'free';

      await supabase
        .from('users')
        .update({
          role,
          stripe_customer_id: (session.customer as string) || null,
          stripe_subscription_status: status || null,
          stripe_price_id: priceId,
          current_period_end: subscription?.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
        })
        .eq('id', userId);
    }

    // Redirect to the app regardless; role update (if any) is done
    return NextResponse.redirect(`${origin}/editor`);
  } catch (err) {
    // If anything fails, fail soft and just continue to app
    console.error('Stripe confirm error:', err);
    return NextResponse.redirect(`${origin}/editor`);
  }
}

