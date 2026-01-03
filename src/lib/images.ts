import { supabase } from './supabase'

export interface ImageCollection {
  id: string
  user_id: string
  name: string
  created_at: string
  sample_images?: Image[] // Add sample images for thumbnails
  image_count?: number // Total number of images in the collection
}

export interface Image {
  id: string
  collection_id: string
  // Backward-compat: old rows had file_path; new rows use storage_path
  file_path?: string
  storage_path?: string
  // New metadata columns (non-AI)
  mime_type?: string | null
  bytes?: number | null
  width?: number | null
  height?: number | null
  aspect_ratio?: string | null
  // JSON metadata bag for extensible fields
  metadata?: Record<string, unknown> | null
  // Legacy AI fields may exist on old schema; keep optional for typing safety
  ai_description?: string | null
  ai_summary?: string | null
  ai_json?: any
  created_at: string
}

export interface CreateCollectionData {
  name: string
}

// Collection functions
export async function createCollection(data: CreateCollectionData) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User must be authenticated')
    }

    const { data: collection, error } = await supabase
      .from('image_collections')
      .insert({
        name: data.name,
        user_id: user.id,
      })
      .select()
      .single()

    if (error) throw error
    return { collection, error: null }
  } catch (error) {
    console.error('Error creating collection:', error)
    return { collection: null, error: error as Error }
  }
}

export async function getUserCollections() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User must be authenticated')
    }

    const { data: collections, error } = await supabase
      .from('image_collections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // For each collection, fetch up to 4 sample images for thumbnails and total count
    const collectionsWithImages = await Promise.all(
      (collections || []).map(async (collection) => {
        // Fetch sample images for thumbnails
        const { data: sampleImages } = await supabase
          .from('images')
          .select('*')
          .eq('collection_id', collection.id)
          .order('created_at', { ascending: false })
          .limit(4)

        // Fetch total count of images
        const { count: imageCount } = await supabase
          .from('images')
          .select('*', { count: 'exact', head: true })
          .eq('collection_id', collection.id)

        return {
          ...collection,
          sample_images: sampleImages || [],
          image_count: imageCount || 0
        }
      })
    )

    return { collections: collectionsWithImages, error: null }
  } catch (error) {
    console.error('Error fetching collections:', error)
    return { collections: [], error: error as Error }
  }
}

export async function deleteCollection(id: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User must be authenticated')
    }

    // Fetch images in the collection
    const { data: images } = await supabase
      .from('images')
      .select('*')
      .eq('collection_id', id)

    if (images && images.length > 0) {
      const imageIds = images.map(img => img.id)

      // Before deleting images, handle slide references
      // 1. Delete slide overlay references to any of these images
      const { error: overlaysDeleteError } = await supabase
        .from('slide_overlays')
        .delete()
        .in('image_id', imageIds)

      if (overlaysDeleteError) {
        console.warn('Error deleting slide overlays during collection delete:', overlaysDeleteError)
        // Continue anyway - try to clean up what we can
      }

      // 2. Set background_image_id to NULL for slides using any of these images as background
      const { error: backgroundUpdateError } = await supabase
        .from('slides')
        .update({ background_image_id: null })
        .in('background_image_id', imageIds)

      if (backgroundUpdateError) {
        console.warn('Error updating slide backgrounds during collection delete:', backgroundUpdateError)
        // Continue anyway - try to clean up what we can
      }

      // Best-effort: delete files from storage
      const filePaths = images
        .map(img => (img as any).storage_path || (img as any).file_path)
        .filter(Boolean) as string[]
      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('user-images')
          .remove(filePaths)
        // Do not block DB deletes on storage errors; log and continue
        if (storageError) {
          console.warn('Storage remove error during collection delete:', storageError)
        }
      }

      // Remove image rows explicitly to avoid FK restrictions if cascade is not configured
      const { error: imagesDeleteError } = await supabase
        .from('images')
        .delete()
        .eq('collection_id', id)
        .eq('user_id', user.id)
      if (imagesDeleteError) throw imagesDeleteError
    }

    // Delete the collection itself
    const { error } = await supabase
      .from('image_collections')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('Error deleting collection:', error)
    return { error: error as Error }
  }
}

// Image functions
export async function uploadImageToCollection(file: File, collectionId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User must be authenticated')
    }

    // Generate unique file path
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`
    // New folder layout: <uid>/collections/<collectionId>/<filename>
    const filePath = `${user.id}/collections/${collectionId}/${fileName}`

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('user-images')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    // Extract intrinsic width/height from the file
    const getImageDimensions = (blob: Blob) =>
      new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          resolve({ width: img.naturalWidth || (img as any).width || 0, height: img.naturalHeight || (img as any).height || 0 })
          URL.revokeObjectURL(img.src)
        }
        img.onerror = reject
        img.src = URL.createObjectURL(blob)
      })

    let width: number | null = null
    let height: number | null = null
    try {
      const dims = await getImageDimensions(file)
      width = Number.isFinite(dims.width) ? dims.width : null
      height = Number.isFinite(dims.height) ? dims.height : null
    } catch (_) {
      // Ignore; leave nulls
    }

    const aspectRatio = width && height ? `${width}:${height}` : null

    // Save image record to database
    const { data: image, error: dbError } = await supabase
      .from('images')
      .insert({
        collection_id: collectionId,
        user_id: user.id,
        storage_path: filePath,
        mime_type: file.type || null,
        bytes: file.size ?? null,
        width,
        height,
        aspect_ratio: aspectRatio,
        metadata: {},
      })
      .select()
      .single()

    if (dbError) throw dbError
    return { image, error: null }
  } catch (error) {
    console.error('Error uploading image:', error)
    return { image: null, error: error as Error }
  }
}

export async function getCollectionImages(collectionId: string) {
  try {
    const { data: images, error } = await supabase
      .from('images')
      .select('*')
      .eq('collection_id', collectionId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { images: images || [], error: null }
  } catch (error) {
    console.error('Error fetching collection images:', error)
    return { images: [], error: error as Error }
  }
}

export async function deleteImage(imageId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User must be authenticated')
    }

    // Get the image file path first
    const { data: image, error: fetchError } = await supabase
      .from('images')
      .select('*')
      .eq('id', imageId)
      .single()

    if (fetchError) throw fetchError

    // Before deleting the image, handle slide references
    // 1. Delete slide overlay references to this image
    const { error: overlaysDeleteError } = await supabase
      .from('slide_overlays')
      .delete()
      .eq('image_id', imageId)

    if (overlaysDeleteError) {
      console.warn('Error deleting slide overlays:', overlaysDeleteError)
      // Continue anyway - try to clean up what we can
    }

    // 2. Set background_image_id to NULL for slides using this image as background
    const { error: backgroundUpdateError } = await supabase
      .from('slides')
      .update({ background_image_id: null })
      .eq('background_image_id', imageId)

    if (backgroundUpdateError) {
      console.warn('Error updating slide backgrounds:', backgroundUpdateError)
      // Continue anyway - try to clean up what we can
    }

    // Delete from storage
    const path = (image as any).storage_path || (image as any).file_path
    const { error: storageError } = await supabase.storage
      .from('user-images')
      .remove([path])

    if (storageError) {
      console.warn('Storage remove error during image delete:', storageError)
      // Continue to delete DB record even if storage fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('images')
      .delete()
      .eq('id', imageId)

    if (dbError) throw dbError
    return { error: null }
  } catch (error) {
    console.error('Error deleting image:', error)
    return { error: error as Error }
  }
}

// Copy a product image to the regular images table for use in overlays
export async function copyProductImageForOverlay(productImageId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('User must be authenticated')
    }

    // First, fetch the product image details
    const { data: productImage, error: fetchError } = await supabase
      .from('product_images')
      .select('*')
      .eq('id', productImageId)
      .eq('user_id', user.id)
      .single()

    if (fetchError) throw fetchError
    if (!productImage) throw new Error('Product image not found')

    // Create a new entry in the images table
    const { data: newImage, error: insertError } = await supabase
      .from('images')
      .insert({
        collection_id: null, // No collection for overlay images
        user_id: user.id,
        storage_path: productImage.storage_path,
        mime_type: productImage.mime_type,
        bytes: productImage.bytes,
        width: productImage.width,
        height: productImage.height,
        aspect_ratio: productImage.width && productImage.height ? `${productImage.width}:${productImage.height}` : null,
        metadata: {
          source: 'product_image',
          product_id: productImage.product_id,
          original_product_image_id: productImage.id
        }
      })
      .select()
      .single()

    if (insertError) throw insertError

    return { image: newImage as Image, error: null }
  } catch (error) {
    console.error('Error copying product image for overlay:', error)
    return { image: null, error: error as Error }
  }
}

export function getImageUrl(filePath: string) {
  try {
    // Use authenticated proxy so private buckets work client-side
    const encoded = encodeURIComponent(filePath)
    return `/api/storage/user-images?path=${encoded}`
  } catch (error) {
    console.error('Error generating image URL:', error)
    return ''
  }
} 

// Public demo image URL helper for the public-images bucket (no auth required)
export function getPublicImageUrlFromPath(filePath: string) {
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!base) return ''
    // Direct public object URL; files are readable by anyone
    return `${base}/storage/v1/object/public/public-images/${filePath}`
  } catch (error) {
    console.error('Error generating public image URL:', error)
    return ''
  }
}

export interface ImageAIDescriptionResult {
  short_description: string
  long_description: string
  categories: string[]
  objects: string[]
}

export async function updateImageAIData(
  imageId: string,
  ai: ImageAIDescriptionResult
) {
  try {
    // Fetch existing metadata to merge safely
    const { data: existing, error: fetchError } = await supabase
      .from('images')
      .select('id, metadata')
      .eq('id', imageId)
      .single()

    if (fetchError) throw fetchError

    const existingMetadata = (existing?.metadata as Record<string, unknown> | null) || {}
    const mergedMetadata: Record<string, unknown> = {
      ...existingMetadata,
      short_description: ai.short_description,
      long_description: ai.long_description,
      categories: ai.categories,
      objects: ai.objects,
    }
    // Remove legacy nested `ai` key if present
    if ('ai' in mergedMetadata) {
      delete (mergedMetadata as any).ai
    }

    const { data, error } = await supabase
      .from('images')
      .update({ metadata: mergedMetadata })
      .eq('id', imageId)
      .select()
      .single()

    if (error) throw error
    return { image: data as Image, error: null }
  } catch (error) {
    console.error('Error updating image AI data:', error)
    return { image: null, error: error as Error }
  }
}

// Import a public image (from the public-images bucket) into the user's images bucket
// by downloading it from its public URL and uploading into user-images, then creating
// a corresponding row in the images table. This avoids schema changes and preserves FKs.
export async function importPublicImageToUserImages(
  publicStoragePath: string,
  opts?: { publicImageId?: string; suggestedFileName?: string }
): Promise<{ image: Image | null; imageUrl: string | null; error: Error | null }> {
  try {
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) {
      throw new Error('User must be authenticated')
    }

    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!base) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')

    // Build the public URL and fetch the file
    const publicUrl = `${base}/storage/v1/object/public/public-images/${publicStoragePath}`
    const res = await fetch(publicUrl)
    if (!res.ok) {
      throw new Error(`Failed fetching public image: ${res.status} ${res.statusText}`)
    }
    const blob = await res.blob()

    // Pick a destination path in user-images bucket
    const origName = opts?.suggestedFileName || publicStoragePath.split('/').pop() || `imported-${Date.now()}`
    const destPath = `${user.id}/public-imports/${Date.now()}_${origName}`

    // Upload into user-images
    const { error: uploadError } = await supabase.storage
      .from('user-images')
      .upload(destPath, blob, { upsert: false })

    if (uploadError) throw uploadError

    // Create images row pointing to the uploaded user image
    const metadata: Record<string, unknown> = {
      source: 'public_image',
    }
    if (opts?.publicImageId) metadata.original_public_image_id = opts.publicImageId

    const { data: newImage, error: insertError } = await supabase
      .from('images')
      .insert({
        collection_id: null,
        user_id: user.id,
        storage_path: destPath,
        metadata,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Build user-images proxy URL for the client
    const encoded = encodeURIComponent(destPath)
    const imageUrl = `/api/storage/user-images?path=${encoded}`

    return { image: newImage as unknown as Image, imageUrl, error: null }
  } catch (error) {
    console.error('Error importing public image:', error)
    return { image: null, imageUrl: null, error: error as Error }
  }
}
