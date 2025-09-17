import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = new URL(request.url);

  // If not authenticated, send to home where user can initiate auth
  if (!user) {
    return NextResponse.redirect(new URL('/', url));
  }

  // Fetch subscription status
  const { data: profile } = await supabase
    .from('users')
    .select('role, stripe_subscription_status')
    .eq('id', user.id)
    .single();

  const isSubscribed =
    profile?.role === 'pro' ||
    profile?.stripe_subscription_status === 'active' ||
    profile?.stripe_subscription_status === 'trialing';

  // Redirect based on subscription
  if (isSubscribed) {
    return NextResponse.redirect(new URL('/products', url));
  }

  return NextResponse.redirect(new URL('/api/stripe/checkout', url));
}

