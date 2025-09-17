import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

type Body = {
  flow?: 'cancel' | 'default';
};

export async function POST(request: NextRequest) {
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

    const body = (await request.json().catch(() => ({}))) as Body;
    const flow = body.flow ?? 'default';

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });

    const origin = new URL(request.url).origin;
    const returnUrl = `${origin}/settings/account`;

    let flow_data: Stripe.BillingPortal.SessionCreateParams.FlowData | undefined = undefined;

    if (flow === 'cancel') {
      // Try to locate the current subscription so we can deep-link directly
      // into the portal's cancellation flow for a smoother UX.
      const statuses: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due'];
      let subscriptionId: string | null = null;
      for (const status of statuses) {
        const list = await stripe.subscriptions.list({ customer: customerId, status, limit: 1 });
        if (list.data.length > 0) {
          subscriptionId = list.data[0]!.id;
          break;
        }
      }

      if (subscriptionId) {
        flow_data = {
          type: 'subscription_cancel',
          subscription_cancel: {
            subscription: subscriptionId,
            // Let Dashboard configuration drive which options show.
            // Enabling ensures Stripe records a reason if configured.
            cancellation_reason: { enabled: true },
          },
        };
      }
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
      // If we couldn't find a subscription, we still create a generic portal session.
      ...(flow_data ? { flow_data } : {}),
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Stripe portal error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

