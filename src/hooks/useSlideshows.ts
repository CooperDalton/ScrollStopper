import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { getImageUrl } from '@/lib/images'

export interface SlideText {
  id: string;
  slide_id: string;
  text: string;
  position_x: number;
  position_y: number;
  size: number; // Effective font size (fontSize * scale)
  rotation: number;
  font: string;
  created_at: string;
}

export interface SlideOverlay {
  id: string;
  slide_id: string;
  image_id: string;
  crop?: any;
  position_x: number;
  position_y: number;
  rotation: number;
  size: number;
  created_at: string;
  imageUrl?: string;
}

export interface Slide {
  id: string;
  slideshow_id: string;
  background_image_id?: string;
  duration_seconds: number;
  created_at: string;
  backgroundImage?: string;
  texts?: SlideText[];
  overlays?: SlideOverlay[];
}

export interface Slideshow {
  id: string;
  user_id: string;
  product_id?: string;
  caption?: string;
  status: string;
  upload_status: string;
  tik_tok_post_id?: string;
  frame_paths?: string[];
  created_at: string;
  slides: Slide[];
}

export function useSlideshows() {
  const [slideshows, setSlideshows] = useState<Slideshow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const fetchSlideshows = async () => {
    if (!user) {
      setSlideshows([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Fetch slideshows with their slides
      const { data: slideshowsData, error: slideshowsError } = await supabase
        .from('slideshows')
        .select(`
          id,
          user_id,
          product_id,
          caption,
          status,
          upload_status,
          tik_tok_post_id,
          frame_paths,
          created_at,
          slides (
            id,
            slideshow_id,
            background_image_id,
            duration_seconds,
            created_at,
            background_image:images!background_image_id (
              id,
              file_path
            ),
            slide_texts (
              id,
              slide_id,
              text,
              position_x,
              position_y,
              size,
              rotation,
              font,
              created_at
            ),
            slide_overlays (
              id,
              slide_id,
              image_id,
              crop,
              position_x,
              position_y,
              rotation,
              size,
              created_at
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (slideshowsError) throw slideshowsError

      // Transform the data to match our interface
      const transformedSlideshows: Slideshow[] = (slideshowsData || []).map(slideshow => ({
        ...slideshow,
        slides: (slideshow.slides || []).map((slide: any) => ({
          ...slide,
          texts: slide.slide_texts || [],
          overlays: slide.slide_overlays || [],
          backgroundImage: slide.background_image?.file_path ? getImageUrl(slide.background_image.file_path) : undefined
        }))
      }))

      setSlideshows(transformedSlideshows)
    } catch (err) {
      console.error('Error fetching slideshows:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch slideshows')
    } finally {
      setLoading(false)
    }
  }

  const createSlideshow = async (caption?: string, productId?: string) => {
    if (!user) {
      throw new Error('User must be authenticated to create slideshows')
    }

    try {
      setError(null)

      // Create the slideshow
      const { data: slideshowData, error: slideshowError } = await supabase
        .from('slideshows')
        .insert({
          user_id: user.id,
          product_id: productId || null,
          caption: caption || 'Untitled Slideshow',
          status: 'draft',
          upload_status: 'pending'
        })
        .select()
        .single()

      if (slideshowError) throw slideshowError

      // Create the first blank slide
      const { data: slideData, error: slideError } = await supabase
        .from('slides')
        .insert({
          slideshow_id: slideshowData.id,
          duration_seconds: 3
        })
        .select()
        .single()

      if (slideError) throw slideError

      // Create the new slideshow object
      const newSlideshow: Slideshow = {
        ...slideshowData,
        slides: [{
          ...slideData,
          texts: [],
          overlays: []
        }]
      }

      // Add to local state
      setSlideshows(prev => [newSlideshow, ...prev])

      return newSlideshow
    } catch (err) {
      console.error('Error creating slideshow:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create slideshow'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  useEffect(() => {
    fetchSlideshows()
  }, [user])

  const addSlide = async (slideshowId: string) => {
    if (!user) {
      throw new Error('User must be authenticated to add slides')
    }

    try {
      setError(null)

      // Create the new slide in the database
      const { data: slideData, error: slideError } = await supabase
        .from('slides')
        .insert({
          slideshow_id: slideshowId,
          duration_seconds: 3
        })
        .select()
        .single()

      if (slideError) throw slideError

      // Update local state
      setSlideshows(prev => prev.map(slideshow => {
        if (slideshow.id === slideshowId) {
          return {
            ...slideshow,
            slides: [...slideshow.slides, {
              ...slideData,
              texts: [],
              overlays: []
            }]
          }
        }
        return slideshow
      }))

      return slideData
    } catch (err) {
      console.error('Error adding slide:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to add slide'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  const saveSlideTexts = async (slideId: string, texts: SlideText[]) => {
    if (!user) {
      throw new Error('User must be authenticated to save slide texts')
    }

    try {
      setError(null)

      // First, delete existing texts for this slide
      const { error: deleteError } = await supabase
        .from('slide_texts')
        .delete()
        .eq('slide_id', slideId)

      if (deleteError) throw deleteError

      // Then insert the new texts if there are any
      if (texts.length > 0) {
        const textsToInsert = texts.map(text => ({
          slide_id: slideId,
          text: text.text,
          position_x: Math.round(text.position_x),
          position_y: Math.round(text.position_y),
          size: Math.round(text.size),
          rotation: Math.round(text.rotation),
          font: text.font
        }))

        const { data: insertedTexts, error: insertError } = await supabase
          .from('slide_texts')
          .insert(textsToInsert)
          .select()

        if (insertError) throw insertError

        // Update local state with the inserted texts (which have IDs)
        setSlideshows(prev => prev.map(slideshow => ({
          ...slideshow,
          slides: slideshow.slides.map(slide => {
            if (slide.id === slideId) {
              return {
                ...slide,
                texts: insertedTexts
              }
            }
            return slide
          })
        })))
      } else {
        // If no texts, just update local state to empty array
        setSlideshows(prev => prev.map(slideshow => ({
          ...slideshow,
          slides: slideshow.slides.map(slide => {
            if (slide.id === slideId) {
              return {
                ...slide,
                texts: []
              }
            }
            return slide
          })
        })))
      }

      return true
    } catch (err) {
      console.error('Error saving slide texts:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to save slide texts'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

    const updateSlideBackground = async (slideId: string, imageId: string | null) => {
    if (!user) {
      throw new Error('User must be authenticated to update slide background')
    }

    try {
      setError(null)

      // Get the image file_path if imageId is provided
      let backgroundImageUrl: string | undefined = undefined
      if (imageId) {
        const { data: imageData, error: imageError } = await supabase
          .from('images')
          .select('file_path')
          .eq('id', imageId)
          .single()

        if (imageError) throw imageError
        backgroundImageUrl = getImageUrl(imageData.file_path)
      }

      // Update the slide's background_image_id in the database
      const { error: updateError } = await supabase
        .from('slides')
        .update({ background_image_id: imageId })
        .eq('id', slideId)

      if (updateError) throw updateError

      // Update local state
      setSlideshows(prev => prev.map(slideshow => ({
        ...slideshow,
        slides: slideshow.slides.map(slide => {
          if (slide.id === slideId) {
            return {
              ...slide,
              background_image_id: imageId || undefined,
              backgroundImage: backgroundImageUrl
            }
          }
          return slide
        })
      })))

      return true
    } catch (err) {
      console.error('Error updating slide background:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to update slide background'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  return {
    slideshows,
    loading,
    error,
    createSlideshow,
    addSlide,
    saveSlideTexts,
    updateSlideBackground,
    refetch: fetchSlideshows
  }
} 