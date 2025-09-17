import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createServiceSupabaseClient } from '@/lib/supabase-service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Identify caller via auth cookies
    const userClient = await createServerSupabaseClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const json = await request.json().catch(() => ({} as any));
    const full_name = typeof json?.full_name === 'string' && json.full_name.trim().length > 0
      ? json.full_name.trim()
      : user.user_metadata?.full_name || user.user_metadata?.name || null;

    const service = createServiceSupabaseClient();
    const { error } = await service
      .from('users')
      .upsert({ id: user.id, full_name }, { onConflict: 'id' });

    if (error) {
      console.error('[insert-user] upsert error', error);
      return NextResponse.json({ error: 'Failed to upsert user' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[insert-user] error', err);
    return NextResponse.json({ error: err?.message || 'Bad request' }, { status: 400 });
  }
}

