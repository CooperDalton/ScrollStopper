import { createServerSupabaseClient } from './supabase-server'
import { Product } from './products'

// Get all products for the current user (server-side)
export async function getUserProductsServer() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return { products: [], error: null }
    }

    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { products: products || [], error: null }
  } catch (error) {
    console.error('Error fetching products (server):', error)
    return { products: [], error: error as Error }
  }
} 