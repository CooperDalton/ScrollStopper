import SettingsLayout from '@/components/SettingsLayout';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { subscriptionTiers } from '@/data/subscriptionTiers';

export default async function UsagePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <SettingsLayout>
        <div className="flex-1 p-8">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold text-[var(--color-text)] mb-6">Usage</h1>
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-8 text-[var(--color-text)]">
              Please sign in to view your usage.
            </div>
          </div>
        </div>
      </SettingsLayout>
    );
  }

  // Period start: first day of current month (YYYY-MM-DD)
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Determine tier for limits
  const { data: profile } = await supabase
    .from('users')
    .select('role, stripe_subscription_status')
    .eq('id', user.id)
    .single();
  const isSubscribed =
    profile?.role === 'pro' ||
    (profile?.stripe_subscription_status === 'active' || profile?.stripe_subscription_status === 'trialing');
  const tier = isSubscribed ? subscriptionTiers.Pro : subscriptionTiers.Free;

  // Total slideshows (all time)
  const { count: totalSlideshows = 0 } = await supabase
    .from('slideshows')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  // Slideshows this cycle (aligned with usage counters)
  // Use usage_counters 'slideshows' metric for current cycle instead of calendar month
  let createdThisCycle = 0;

  // AI generations this month (usage_counters)
  const { data: usageRows } = await supabase
    .from('usage_counters')
    .select('metric, used, period_start, period_end')
    .eq('user_id', user.id)
    .lte('period_start', today)
    .gte('period_end', today);

  const usedGenerations = usageRows?.find((r) => r.metric === 'ai_generations')?.used ?? 0;
  const usedSlidesCounter = usageRows?.find((r) => r.metric === 'slideshows')?.used ?? 0;
  createdThisCycle = usedSlidesCounter;

  const remainingSlides = Math.max(0, tier.maxNumberOfSlideshows - usedSlidesCounter);
  const remainingAIGenerations = Math.max(0, tier.maxNumberOfAIGenerations - usedGenerations);

  return (
    <SettingsLayout>
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">Usage</h1>
            <p className="text-[var(--color-text-muted)]">
              Plan: {isSubscribed ? 'Pro' : 'Free'} · Limits reflect your current plan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6">
              <div className="text-sm text-[var(--color-text-muted)]">Videos this cycle</div>
              <div className="text-3xl font-bold text-[var(--color-text)] mt-2">{createdThisCycle}</div>
            </div>

            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6">
              <div className="text-sm text-[var(--color-text-muted)]">AI generated (this cycle)</div>
              <div className="text-3xl font-bold text-[var(--color-text)] mt-2">{usedGenerations}</div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">Remaining: {remainingAIGenerations}</div>
            </div>

            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6">
              <div className="text-sm text-[var(--color-text-muted)]">Total videos (all time)</div>
              <div className="text-3xl font-bold text-[var(--color-text)] mt-2">{totalSlideshows}</div>
            </div>
          </div>

          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-2">Plan limits</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Slideshows this cycle: {usedSlidesCounter} / {tier.maxNumberOfSlideshows} &nbsp;·&nbsp; Remaining: {remainingSlides}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              AI generations this cycle: {usedGenerations} / {tier.maxNumberOfAIGenerations} &nbsp;·&nbsp; Remaining: {remainingAIGenerations}
            </p>
          </div>
        </div>
      </div>
      </SettingsLayout>
  );
}
