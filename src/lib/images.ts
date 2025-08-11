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

    // First delete all images in the collection from storage
    const { data: images } = await supabase
      .from('images')
      .select('*')
      .eq('collection_id', id)

    if (images && images.length > 0) {
      const filePaths = images
        .map(img => (img as any).storage_path || (img as any).file_path)
        .filter(Boolean) as string[]
      await supabase.storage
        .from('user-images')
        .remove(filePaths)
    }

    // Delete the collection (cascade will delete images records)
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
    const filePath = `${user.id}/${collectionId}/${fileName}`

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

    // Delete from storage
    const path = (image as any).storage_path || (image as any).file_path
    const { error: storageError } = await supabase.storage
      .from('user-images')
      .remove([path])

    if (storageError) throw storageError

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

export function getImageUrl(filePath: string) {
  try {
    const { data } = supabase.storage
      .from('user-images')
      .getPublicUrl(filePath)
    
    return data.publicUrl
  } catch (error) {
    console.error('Error generating image URL:', error)
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