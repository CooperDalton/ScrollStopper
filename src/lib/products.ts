import { supabase } from './supabase'

export interface Product {
  id: string
  name: string
  description: string
  user_id: string
  created_at: string
  // Note: updated_at column does not exist in database schema
}

export interface ProductImage {
  id: string
  product_id: string
  user_id: string
  storage_path: string
  width: number | null
  height: number | null
  mime_type: string | null
  bytes: number | null
  user_description: string | null
  ai_description?: string | null
  created_at: string
}

export interface CreateProductData {
  name: string
  description: string
}

export interface UpdateProductData {
  name?: string
  description?: string
}

// Internal: get image dimensions in browser
async function getImageDimensionsFromBlob(blob: Blob): Promise<{ width: number | null; height: number | null }> {
  try {
    const objectUrl = URL.createObjectURL(blob)
    const img = document.createElement('img')
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = reject
      img.src = objectUrl
    })
    URL.revokeObjectURL(objectUrl)
    return { width: dims.width || null, height: dims.height || null }
  } catch {
    return { width: null, height: null }
  }
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

// List images for a product
export async function getProductImages(productId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User must be authenticated')

    const { data, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', productId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { images: (data || []) as ProductImage[], error: null }
  } catch (error) {
    console.error('Error fetching product images:', error)
    return { images: [] as ProductImage[], error: error as Error }
  }
}

// Upload a single product image to storage and create DB row
export async function uploadProductImage(
  file: File,
  productId: string,
  userDescription?: string
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User must be authenticated')

    // Build unique storage path
    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
    const storagePath = `${user.id}/products/${productId}/${fileName}`

    // Upload to storage bucket
    const { error: uploadError } = await supabase.storage
      .from('user-images')
      .upload(storagePath, file)
    if (uploadError) throw uploadError

    // Dimensions + metadata
    const { width, height } = await getImageDimensionsFromBlob(file)

    const { data, error: dbError } = await supabase
      .from('product_images')
      .insert({
        product_id: productId,
        user_id: user.id,
        storage_path: storagePath,
        width,
        height,
        mime_type: file.type || null,
        bytes: typeof file.size === 'number' ? file.size : null,
        user_description: userDescription?.trim() || null,
      })
      .select()
      .single()

    if (dbError) throw dbError
    return { image: data as ProductImage, error: null }
  } catch (error) {
    console.error('Error uploading product image:', error)
    return { image: null as ProductImage | null, error: error as Error }
  }
}

// Update a product image's user description
export async function updateProductImageDescription(imageId: string, description: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User must be authenticated')

    const { data, error } = await supabase
      .from('product_images')
      .update({ user_description: description.trim() })
      .eq('id', imageId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    return { image: data as ProductImage, error: null }
  } catch (error) {
    console.error('Error updating product image description:', error)
    return { image: null as ProductImage | null, error: error as Error }
  }
}