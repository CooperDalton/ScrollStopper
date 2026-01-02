import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { subscriptionTiers } from '@/data/subscriptionTiers'

export async function GET(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('Missing STRIPE_SECRET_KEY');
      return new NextResponse('Missing STRIPE_SECRET_KEY', { status: 500 });
    }

    if (!subscriptionTiers.Pro.stripePriceId) {
      console.error('Missing STRIPE_PRO_PLAN_STRIPE_PRICE_ID');
      return new NextResponse('Missing STRIPE_PRO_PLAN_STRIPE_PRICE_ID', { status: 500 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    })

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    const origin = new URL(request.url).origin

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email || undefined,
      metadata: { userId: user.id },
      subscription_data: { metadata: { userId: user.id } },
      line_items: [
        {
          price: subscriptionTiers.Pro.stripePriceId,
          quantity: 1,
        },
      ],
      // On success, bounce through a confirm endpoint that updates the user's role
      // before landing in the app. This complements webhooks and fixes cases where
      // webhooks are misconfigured or delayed.
      success_url: `${origin}/api/stripe/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
    })

    return NextResponse.redirect(session.url!, 303)
  } catch (err: any) {
    console.error('Stripe checkout error:', err);
    return new NextResponse(err.message || 'Internal Server Error', { status: 500 });
  }
}
