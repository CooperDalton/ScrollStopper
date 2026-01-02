import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceSupabaseClient } from '@/lib/supabase-service'
import { getTierByPriceId } from '@/data/subscriptionTiers'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover',
  })

  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature') as string

  let event: Stripe.Event
  try {
    if (!webhookSecret) {
      throw new Error('Missing STRIPE_WEBHOOK_SECRET')
    }
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 })
  }

  try {
    const supabase = createServiceSupabaseClient()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = (session.metadata?.userId as string) || undefined
        const subscriptionId = session.subscription as string | undefined

        // Fetch subscription to get price_id reliably
        let priceId: string | undefined
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId)
          priceId = (sub.items.data[0]?.price?.id as string | undefined) || undefined
        }

        const tier = priceId ? getTierByPriceId(priceId) : undefined

        if (userId) {
          await supabase
            .from('users')
            .upsert(
              {
                id: userId,
                role: 'pro',
                stripe_customer_id: session.customer as string | null,
                stripe_subscription_status: 'active',
                stripe_price_id: priceId,
              },
              { onConflict: 'id' }
            )
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription
        const priceId = sub.items.data[0]?.price?.id as string | undefined
        // Recover userId from subscription metadata if present
        const userId = (sub.metadata?.userId as string) || undefined

        if (userId) {
          const status = sub.status
          const role = status === 'active' || status === 'trialing' ? 'pro' : 'free'
          
          // Flexible billing / new API version compatibility
          const isCanceling = Boolean(sub.cancel_at_period_end || (sub.cancel_at && sub.cancel_at > Math.floor(Date.now() / 1000)));
          const currentPeriodEndTimestamp = sub.items.data[0]?.current_period_end;

          await supabase
            .from('users')
            .upsert(
              {
                id: userId,
                role,
                stripe_customer_id: sub.customer as string | null,
                stripe_subscription_status: status,
                stripe_price_id: priceId,
                stripe_cancel_at_period_end: isCanceling,
                current_period_end: currentPeriodEndTimestamp
                  ? new Date(currentPeriodEndTimestamp * 1000).toISOString()
                  : null,
              },
              { onConflict: 'id' }
            )
        }
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = (sub.metadata?.userId as string) || undefined
        if (userId) {
          const currentPeriodEndTimestamp = sub.items.data[0]?.current_period_end;
          await supabase
            .from('users')
            .upsert(
              {
                id: userId,
                role: 'free',
                stripe_subscription_status: 'canceled',
                stripe_cancel_at_period_end: false,
                current_period_end: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : 
                                   (currentPeriodEndTimestamp ? new Date(currentPeriodEndTimestamp * 1000).toISOString() : null),
              },
              { onConflict: 'id' }
            )
        }
        break
      }
      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

