import { supabase } from './supabase'

export interface ImageCollection {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface Image {
  id: string
  collection_id: string
  file_path: string
  ai_description?: string
  ai_summary?: string
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
    return { collections: collections || [], error: null }
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
      .select('file_path')
      .eq('collection_id', id)

    if (images && images.length > 0) {
      const filePaths = images.map(img => img.file_path)
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

    // Save image record to database
    const { data: image, error: dbError } = await supabase
      .from('images')
      .insert({
        collection_id: collectionId,
        file_path: filePath,
        ai_description: null, // Will be filled later with AI
        ai_summary: null,     // Will be filled later with AI
        ai_json: null,        // Will be filled later with AI
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
      .select('file_path')
      .eq('id', imageId)
      .single()

    if (fetchError) throw fetchError

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('user-images')
      .remove([image.file_path])

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
    console.log('Getting image URL for path:', filePath)
    
    const { data } = supabase.storage
      .from('user-images')
      .getPublicUrl(filePath)
    
    console.log('Generated URL:', data.publicUrl)
    return data.publicUrl
  } catch (error) {
    console.error('Error generating image URL:', error)
    return ''
  }
} 