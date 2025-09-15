import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { subscriptionTiers } from '@/data/subscriptionTiers'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ isSubscribed: false, remainingSlides: 0, remainingAIGenerations: 0 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role, stripe_subscription_status')
    .eq('id', user.id)
    .single()

  const isSubscribed =
    profile?.role === 'pro' ||
    (profile?.stripe_subscription_status === 'active' || profile?.stripe_subscription_status === 'trialing')

  const tier = isSubscribed ? subscriptionTiers.Pro : subscriptionTiers.Free

  const today = new Date().toISOString().slice(0, 10)

  const { data: rows } = await supabase
    .from('usage_counters')
    .select('metric, used, period_start, period_end')
    .eq('user_id', user.id)
    .lte('period_start', today)
    .gte('period_end', today)

  const usedSlides = rows?.find((r) => r.metric === 'slideshows')?.used ?? 0
  const usedGenerations = rows?.find((r) => r.metric === 'ai_generations')?.used ?? 0

  return NextResponse.json({
    isSubscribed,
    remainingSlides: Math.max(0, tier.maxNumberOfSlideshows - usedSlides),
    remainingAIGenerations: Math.max(0, tier.maxNumberOfAIGenerations - usedGenerations),
  })
}
