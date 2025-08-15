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

// Trigger background product classification (server-side API)
async function classifyProductBackground(productId: string) {
  try {
    await fetch('/api/products/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    })
  } catch (error) {
    console.error('Failed to call product classification API:', error)
  }
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
    // Fire-and-forget: enqueue background classification
    try {
      if (product?.id) {
        // Do not await to avoid blocking UI
        classifyProductBackground(product.id)
          .catch((e) => console.error('[products] classify background failed:', e))
      }
    } catch (e) {
      console.error('[products] failed to enqueue classification:', e)
    }
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
    
    // Fire-and-forget: enqueue background classification on updates as well
    try {
      if (product?.id) {
        classifyProductBackground(product.id)
          .catch((e) => console.error('[products] classify background failed:', e))
      }
    } catch (e) {
      console.error('[products] failed to enqueue classification:', e)
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
    const inserted = data as ProductImage

    // Fire-and-forget: trigger server-side AI description generation
    try {
      console.log('[products] Trigger AI description for product image:', inserted.id)
      // Not awaiting to avoid blocking UI flow
      describeProductImageAI(inserted.id)
        .then((res) => {
          if (res.error) {
            console.error('[products] AI description error:', res.error)
          } else {
            console.log('[products] AI description saved for image:', inserted.id, 'len=', res.description?.length || 0)
          }
        })
        .catch((e) => {
          console.error('[products] AI description call failed:', e)
        })
    } catch (e) {
      console.error('[products] Failed to enqueue AI description:', e)
    }

    return { image: inserted, error: null }
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

// Delete a product image (removes storage object and DB row)
export async function deleteProductImage(imageId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User must be authenticated')

    // Fetch the image to get its storage_path and verify ownership
    const { data: image, error: fetchError } = await supabase
      .from('product_images')
      .select('*')
      .eq('id', imageId)
      .eq('user_id', user.id)
      .single()

    if (fetchError) throw fetchError

    const storagePath = (image as any).storage_path as string

    // Remove file from storage (ignore missing files gracefully)
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from('user-images')
        .remove([storagePath])
      if (storageError && storageError.message && !/No such file or directory/i.test(storageError.message)) {
        throw storageError
      }
    }

    // Delete DB row
    const { error: dbError } = await supabase
      .from('product_images')
      .delete()
      .eq('id', imageId)
      .eq('user_id', user.id)

    if (dbError) throw dbError
    return { error: null }
  } catch (error) {
    console.error('Error deleting product image:', error)
    return { error: error as Error }
  }
}

// Trigger AI description for a product image (server-side processing)
export async function describeProductImageAI(imageId: string, imageUrl?: string) {
  try {
    const res = await fetch('/api/product-images/describe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageId, imageUrl }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error || 'Failed to describe product image')
    }
    const data = await res.json()
    return { description: (data?.description as string) || '', error: null as Error | null }
  } catch (error) {
    console.error('Error describing product image (AI):', error)
    return { description: '', error: error as Error }
  }
}