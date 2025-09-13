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
    .select('role')
    .eq('id', user.id)
    .single()

  const tier = profile?.role === 'pro' ? subscriptionTiers.Pro : subscriptionTiers.Free

  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10)

  const { data: rows } = await supabase
    .from('usage_counters')
    .select('metric, used')
    .eq('user_id', user.id)
    .eq('period_start', periodStart)

  const usedSlides = rows?.find((r) => r.metric === 'slideshows')?.used ?? 0
  const usedGenerations = rows?.find((r) => r.metric === 'ai_generations')?.used ?? 0

  return NextResponse.json({
    isSubscribed: profile?.role === 'pro',
    remainingSlides: Math.max(0, tier.maxNumberOfSlideshows - usedSlides),
    remainingAIGenerations: Math.max(0, tier.maxNumberOfAIGenerations - usedGenerations),
  })
}
