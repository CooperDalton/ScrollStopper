import { supabase } from './supabase'

export interface Product {
  id: string
  name: string
  description: string
  user_id: string
  created_at: string
  // Note: updated_at column does not exist in database schema
}

export interface CreateProductData {
  name: string
  description: string
}

export interface UpdateProductData {
  name?: string
  description?: string
}

// Create a new product
export async function createProduct(data: CreateProductData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User must be authenticated')
    }

    const { data: product, error } = await supabase
      .from('products')
      .insert({
        name: data.name,
        description: data.description,
        user_id: user.id,
      })
      .select()
      .single()

    if (error) throw error
    return { product, error: null }
  } catch (error) {
    console.error('Error creating product:', error)
    return { product: null, error: error as Error }
  }
}

// Get all products for the current user
export async function getUserProducts() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User must be authenticated')
    }

    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { products: products || [], error: null }
  } catch (error) {
    console.error('Error fetching products:', error)
    return { products: [], error: error as Error }
  }
}

// Get a single product by ID
export async function getProduct(id: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User must be authenticated')
    }

    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) throw error
    return { product, error: null }
  } catch (error) {
    console.error('Error fetching product:', error)
    return { product: null, error: error as Error }
  }
}

// Update a product
export async function updateProduct(id: string, data: UpdateProductData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User must be authenticated')
    }

    const { data: product, error } = await supabase
      .from('products')
      .update(data)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    
    if (!product) {
      throw new Error('Product not found or you do not have permission to update it')
    }
    
    return { product, error: null }
  } catch (error) {
    console.error('Error updating product:', error)
    return { product: null, error: error as Error }
  }
}

// Delete a product
export async function deleteProduct(id: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User must be authenticated')
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('Error deleting product:', error)
    return { error: error as Error }
  }
} 