import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function assertAdminOrThrow() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const allowedEmail = process.env.ADMIN_EMAIL
  const allowedId = process.env.ADMIN_USER_ID
  const isAllowed = (allowedEmail && user.email === allowedEmail) || (allowedId && user.id === allowedId)
  if (!isAllowed) throw new Error('Forbidden')

  return user
}


