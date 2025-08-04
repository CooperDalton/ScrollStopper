import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { getImageUrl } from '@/lib/images'
import * as fabric from 'fabric'

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
  index: number;
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
  date_modified: string;
  aspect_ratio: string;
  slides: Slide[];
}

interface RenderQueueItem {
  id: string;
  getSlideCanvas: (slideId: string) => Promise<fabric.Canvas | undefined>;
  onProgress?: (completed: number, total: number) => void;
  resolve?: () => void;
  reject?: (err: unknown) => void;
}

const parseAspectRatio = (ratio: string) => {
  const [w, h] = ratio.split(':').map(Number)
  return w && h ? w / h : 9 / 16
}

const getTextStyling = (fontSize: number = 24) => ({
  fontFamily: '"proxima-nova", sans-serif',
  fontWeight: '600',
  fontStyle: 'normal',
  fill: '#ffffff',
  textAlign: 'center' as const,
  originX: 'center' as const,
  originY: 'center' as const,
  stroke: 'black',
  charSpacing: -40,
  lineHeight: 1.0
})

const scaleImageToFillCanvas = (
  img: fabric.Image,
  canvasWidth: number,
  canvasHeight: number
) => {
  const imgWidth = img.width || 1
  const imgHeight = img.height || 1

  const scaleX = canvasWidth / imgWidth
  const scaleY = canvasHeight / imgHeight
  const scale = Math.max(scaleX, scaleY)

  img.set({
    scaleX: scale,
    scaleY: scale
  })

  const scaledWidth = imgWidth * scale
  const scaledHeight = imgHeight * scale
  img.set({
    left: (canvasWidth - scaledWidth) / 2,
    top: (canvasHeight - scaledHeight) / 2,
    originX: 'left',
    originY: 'top'
  })
}

const createGetSlideCanvas = (slideshow: Slideshow) => async (
  slideId: string
): Promise<fabric.Canvas | undefined> => {
  const aspectRatio = parseAspectRatio(slideshow.aspect_ratio)
  const CANVAS_WIDTH = 300
  const CANVAS_HEIGHT = Math.round(CANVAS_WIDTH / aspectRatio)

  const tempCanvasEl = document.createElement('canvas')
  tempCanvasEl.width = CANVAS_WIDTH
  tempCanvasEl.height = CANVAS_HEIGHT

  try {
    const canvas = new fabric.Canvas(tempCanvasEl, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#ffffff'
    })

    const slide = slideshow.slides.find(s => s.id === slideId)
    if (!slide) return undefined

    if (slide.backgroundImage) {
      const img = await fabric.Image.fromURL(slide.backgroundImage, {
        crossOrigin: 'anonymous'
      })
      img.set({ selectable: false, evented: false, isBackground: true })
      scaleImageToFillCanvas(img, CANVAS_WIDTH, CANVAS_HEIGHT)
      canvas.add(img)
    }

    if (slide.texts) {
      for (const textData of slide.texts) {
        const fabricText = new fabric.IText(textData.text, {
          ...getTextStyling(textData.size),
          left: textData.position_x,
          top: textData.position_y,
          fontSize: textData.size,
          angle: textData.rotation,
          textId: textData.id
        })
        canvas.add(fabricText)
      }
    }

    if (slide.overlays) {
      for (const overlayData of slide.overlays) {
        if (overlayData.imageUrl) {
          const img = await fabric.Image.fromURL(overlayData.imageUrl, {
            crossOrigin: 'anonymous'
          })
          img.set({
            left: overlayData.position_x,
            top: overlayData.position_y,
            scaleX: overlayData.size / 100,
            scaleY: overlayData.size / 100,
            angle: overlayData.rotation,
            selectable: false,
            evented: false
          })
          canvas.add(img)
        }
      }
    }

    canvas.renderAll()
    return canvas
  } catch (err) {
    console.error('Failed to create temporary canvas:', err)
    return undefined
  }
}

export function useSlideshows() {
  const [slideshows, setSlideshows] = useState<Slideshow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [rerenderIds, setRerenderIds] = useState<string[]>([])
  const { user } = useAuth()

  const renderQueue = useRef<RenderQueueItem[]>([])
  const processingQueue = useRef(false)

  const processRenderQueue = async () => {
    if (processingQueue.current) return
    processingQueue.current = true
    while (renderQueue.current.length > 0) {
      const item = renderQueue.current.shift()!
      try {
        await renderSlideshow(item.id, item.getSlideCanvas, item.onProgress)
        item.resolve?.()
      } catch (err) {
        item.reject?.(err)
      }
    }
    processingQueue.current = false
  }

  const queueSlideshowRender = async (
    slideshowId: string,
    getSlideCanvas?: (slideId: string) => Promise<fabric.Canvas | undefined>,
    onProgress?: (completed: number, total: number) => void
  ) => {
    if (!user) throw new Error('User must be authenticated to render slideshows')

    let getCanvas = getSlideCanvas
    if (!getCanvas) {
      const slideshow = slideshows.find(s => s.id === slideshowId)
      if (!slideshow) throw new Error('Slideshow not found')
      getCanvas = createGetSlideCanvas(slideshow)
    }

    const { error: statusError } = await supabase
      .from('slideshows')
      .update({ status: 'queued' })
      .eq('id', slideshowId)
    if (statusError) {
      console.error('Failed to set slideshow status to queued:', statusError)
      throw statusError
    }

    setSlideshows(prev =>
      prev.map(s => (s.id === slideshowId ? { ...s, status: 'queued' } : s))
    )

    return new Promise<void>((resolve, reject) => {
      renderQueue.current.push({
        id: slideshowId,
        getSlideCanvas: getCanvas!,
        onProgress,
        resolve,
        reject
      })
      processRenderQueue()
    })
  }

  const fetchSlideshows = async () => {
    if (!user) {
      setSlideshows([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      setNotice(null)

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
          date_modified,
          aspect_ratio,
          created_at,
          slides (
            id,
            slideshow_id,
            background_image_id,
            duration_seconds,
            index,
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
              created_at,
              overlay_image:images!image_id (
                id,
                file_path
              )
            )
          )
        `)
        .eq('user_id', user.id)
        .order('date_modified', { ascending: false })

      if (slideshowsError) throw slideshowsError

      // Transform the data to match our interface
      let transformedSlideshows: Slideshow[] = (slideshowsData || []).map(slideshow => ({
        ...slideshow,
        slides: (slideshow.slides || [])
          .sort((a: any, b: any) => (a.index || 0) - (b.index || 0)) // Sort by index, treating null as 0
          .map((slide: any) => ({
            ...slide,
            texts: slide.slide_texts || [],
            overlays: (slide.slide_overlays || []).map((overlay: any) => ({
              ...overlay,
              imageUrl: overlay.overlay_image?.file_path ? getImageUrl(overlay.overlay_image.file_path) : undefined
            })),
            backgroundImage: slide.background_image?.file_path ? getImageUrl(slide.background_image.file_path) : undefined
          }))
      }))

      // Find slideshows left in rendering state and prepare them for restart
      const interruptedIds: string[] = []
      for (const s of transformedSlideshows) {
        if (s.status === 'rendering') {
          const bucket = 'rendered-slides'
          const folder = `${user.id}/${s.id}`
          const { data: files, error: listError } = await supabase.storage
            .from(bucket)
            .list(folder, { limit: 1000 })
          if (listError) {
            console.error('Failed to list rendered slides:', listError)
          } else if (files && files.length > 0) {
            const paths = files.map(f => `${folder}/${f.name}`)
            const { error: removeError } = await supabase.storage
              .from(bucket)
              .remove(paths)
            if (removeError) {
              console.error('Failed to remove rendered slides:', removeError)
            }
          }

          const { error: updateError } = await supabase
            .from('slideshows')
            .update({ frame_paths: [], status: 'rendering' })
            .eq('id', s.id)
          if (updateError) {
            console.error('Failed to reset slideshow:', updateError)
          } else {
            s.frame_paths = []
          }
          interruptedIds.push(s.id)
        }
      }

      if (interruptedIds.length > 0) {
        setNotice('Render was interrupted. Restarting render.')
        setRerenderIds(interruptedIds)
      } else {
        setRerenderIds([])
      }

      setSlideshows(transformedSlideshows)

      // Resume any slideshows still queued
      transformedSlideshows
        .filter(s => s.status === 'queued')
        .forEach(s => {
          queueSlideshowRender(s.id, createGetSlideCanvas(s)).catch(err =>
            console.error('Failed to queue slideshow render:', err)
          )
        })
    } catch (err) {
      console.error('Error fetching slideshows:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch slideshows')
    } finally {
      setLoading(false)
    }
  }

  const createSlideshow = async (
    caption?: string,
    productId?: string,
    aspectRatio: string = '9:16'
  ) => {
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
          upload_status: 'pending',
          aspect_ratio: aspectRatio,
          date_modified: new Date().toISOString()
        })
        .select()
        .single()

      if (slideshowError) throw slideshowError

      // Create the first blank slide
      const { data: slideData, error: slideError } = await supabase
        .from('slides')
        .insert({
          slideshow_id: slideshowData.id,
          duration_seconds: 3,
          index: 0
        })
        .select()
        .single()

      if (slideError) throw slideError

      // Create the new slideshow object
      const newSlideshow: Slideshow = {
        ...slideshowData,
        date_modified: slideshowData.date_modified || new Date().toISOString(),
        slides: [
          {
            ...slideData,
            texts: [],
            overlays: []
          }
        ]
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

  const touchSlideshow = async (slideshowId: string) => {
    const now = new Date().toISOString()
    // Update local state immediately
    setSlideshows(prev =>
      prev.map(s => (s.id === slideshowId ? { ...s, date_modified: now } : s))
    )
    await supabase.from('slideshows').update({ date_modified: now }).eq('id', slideshowId)
  }

  const addSlide = async (slideshowId: string) => {
    if (!user) {
      throw new Error('User must be authenticated to add slides')
    }

    try {
      setError(null)

      // Find the current slideshow to determine the next index
      const currentSlideshow = slideshows.find(s => s.id === slideshowId)
      if (!currentSlideshow) {
        throw new Error('Slideshow not found')
      }

      // Calculate the next index
      const nextIndex = Math.max(...currentSlideshow.slides.map(s => s.index || 0), -1) + 1

      // Create the new slide in the database
      const { data: slideData, error: slideError } = await supabase
        .from('slides')
        .insert({
          slideshow_id: slideshowId,
          duration_seconds: 3,
          index: nextIndex
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

      await touchSlideshow(slideshowId)

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

      const parent = slideshows.find(s => s.slides.some(slide => slide.id === slideId))
      if (parent) {
        await touchSlideshow(parent.id)
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

      const parent = slideshows.find(s => s.slides.some(slide => slide.id === slideId))
      if (parent) {
        await touchSlideshow(parent.id)
      }

      return true
    } catch (err) {
      console.error('Error updating slide background:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to update slide background'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  const saveSlideOverlays = async (slideId: string, overlays: SlideOverlay[]) => {
    if (!user) {
      throw new Error('User must be authenticated to save slide overlays')
    }

    try {
      setError(null)

      // First, delete all existing overlays for this slide
      const { error: deleteError } = await supabase
        .from('slide_overlays')
        .delete()
        .eq('slide_id', slideId)

      if (deleteError) throw deleteError

      // Then insert all current overlays
      if (overlays.length > 0) {
        const overlayInserts = overlays.map(overlay => ({
          slide_id: slideId,
          image_id: overlay.image_id,
          crop: overlay.crop || null,
          position_x: Math.round(overlay.position_x),
          position_y: Math.round(overlay.position_y),
          rotation: Math.round(overlay.rotation),
          size: Math.round(overlay.size)
        }))

        const { data: insertedOverlays, error: insertError } = await supabase
          .from('slide_overlays')
          .insert(overlayInserts)
          .select()

        if (insertError) throw insertError

        // Update local state with the inserted overlays (which have new IDs)
        setSlideshows(prev => prev.map(slideshow => ({
          ...slideshow,
          slides: slideshow.slides.map(slide => {
            if (slide.id === slideId) {
              return {
                ...slide,
                overlays: insertedOverlays.map(overlay => ({
                  ...overlay,
                  imageUrl: overlays.find(o => o.image_id === overlay.image_id)?.imageUrl
                }))
              }
            }
            return slide
          })
        })))
      } else {
        // If no overlays, just update local state to empty array
        setSlideshows(prev => prev.map(slideshow => ({
          ...slideshow,
          slides: slideshow.slides.map(slide => {
            if (slide.id === slideId) {
              return {
                ...slide,
                overlays: []
              }
            }
            return slide
          })
        })))
      }
      const parent = slideshows.find(s => s.slides.some(slide => slide.id === slideId))
      if (parent) {
        await touchSlideshow(parent.id)
      }

      return true
    } catch (err) {
      console.error('Error saving slide overlays:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to save slide overlays'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  const deleteSlide = async (slideId: string) => {
    if (!user) {
      throw new Error('User must be authenticated to delete slides')
    }

    try {
      setError(null)

      // Find the slide to get its slideshow_id and index
      const slideshowWithSlide = slideshows.find(slideshow => 
        slideshow.slides.some(slide => slide.id === slideId)
      )
      
      if (!slideshowWithSlide) {
        throw new Error('Slide not found')
      }

      const slideToDelete = slideshowWithSlide.slides.find(slide => slide.id === slideId)
      if (!slideToDelete) {
        throw new Error('Slide not found')
      }

      // Prevent deleting the last remaining slide
      if (slideshowWithSlide.slides.length === 1) {
        throw new Error('Cannot delete the last slide in a slideshow')
      }

      // Immediately update local state for instant UI feedback
      setSlideshows(prev => prev.map(slideshow => {
        if (slideshow.id === slideshowWithSlide.id) {
          return {
            ...slideshow,
            slides: slideshow.slides
              .filter(slide => slide.id !== slideId)
              .map(slide => ({
                ...slide,
                index: slide.index > slideToDelete.index ? slide.index - 1 : slide.index
              }))
          }
        }
        return slideshow
      }))

      // Now perform database operations in the background
      // Delete associated slide_texts and slide_overlays first
      const { error: deleteTextsError } = await supabase
        .from('slide_texts')
        .delete()
        .eq('slide_id', slideId)

      if (deleteTextsError) throw deleteTextsError

      const { error: deleteOverlaysError } = await supabase
        .from('slide_overlays')
        .delete()
        .eq('slide_id', slideId)

      if (deleteOverlaysError) throw deleteOverlaysError

      // Now delete the slide itself
      const { error: deleteSlideError } = await supabase
        .from('slides')
        .delete()
        .eq('id', slideId)

      if (deleteSlideError) throw deleteSlideError

      // Update indexes of subsequent slides in the database
      const subsequentSlides = slideshowWithSlide.slides.filter(slide => 
        slide.index > slideToDelete.index
      )

      if (subsequentSlides.length > 0) {
        const updates = subsequentSlides.map(slide => ({
          id: slide.id,
          index: slide.index - 1
        }))

        for (const update of updates) {
          const { error: updateError } = await supabase
            .from('slides')
            .update({ index: update.index })
            .eq('id', update.id)

          if (updateError) throw updateError
        }
      }

      await touchSlideshow(slideshowWithSlide.id)

      return {
        deletedSlide: slideToDelete,
        remainingSlides: slideshowWithSlide.slides.filter(slide => slide.id !== slideId)
      }
    } catch (err) {
      console.error('Error deleting slide:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete slide'
      setError(errorMessage)
      
      // If database operations failed, we should restore the slide in the UI
      // For now, we'll let the component handle this by showing an error message
      throw new Error(errorMessage)
    }
  }

  const updateSlideDuration = async (slideId: string, durationSeconds: number) => {
    if (!user) {
      throw new Error('User must be authenticated to update slide duration')
    }

    try {
      setError(null)

      // Store original duration for potential rollback
      const originalDuration = slideshows
        .flatMap(slideshow => slideshow.slides)
        .find(slide => slide.id === slideId)?.duration_seconds || 3

      // Immediately update local state for instant UI feedback
      setSlideshows(prev => prev.map(slideshow => ({
        ...slideshow,
        slides: slideshow.slides.map(slide => {
          if (slide.id === slideId) {
            return {
              ...slide,
              duration_seconds: durationSeconds
            }
          }
          return slide
        })
      })))

      // Now update the database in the background
      const { error: updateError } = await supabase
        .from('slides')
        .update({ duration_seconds: durationSeconds })
        .eq('id', slideId)

      if (updateError) {
        // Rollback local state on database error
        setSlideshows(prev => prev.map(slideshow => ({
          ...slideshow,
          slides: slideshow.slides.map(slide => {
            if (slide.id === slideId) {
              return {
                ...slide,
                duration_seconds: originalDuration
              }
            }
            return slide
          })
        })))
        throw updateError
      }

      const parent = slideshows.find(s => s.slides.some(slide => slide.id === slideId))
      if (parent) {
        await touchSlideshow(parent.id)
      }

      return true
    } catch (err) {
      console.error('Error updating slide duration:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to update slide duration'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  const deleteSlideshow = async (slideshowId: string) => {
    if (!user) {
      throw new Error('User must be authenticated to delete slideshows')
    }

    try {
      setError(null)

      // Optimistically remove the slideshow from local state
      setSlideshows(prev => prev.filter(s => s.id !== slideshowId))

      // Remove rendered frames from storage
      const bucket = 'rendered-slides'
      const folder = `${user.id}/${slideshowId}`
      const { data: files, error: listError } = await supabase.storage
        .from(bucket)
        .list(folder, { limit: 1000 })

      if (!listError && files && files.length > 0) {
        const paths = files.map(f => `${folder}/${f.name}`)
        const { error: removeError } = await supabase.storage
          .from(bucket)
          .remove(paths)
        if (removeError) {
          console.error('Failed to remove rendered slides:', removeError)
        }
      } else if (listError) {
        console.error('Failed to list rendered slides:', listError)
      }

      // Fetch slide IDs to remove related data
      const { data: slideData, error: slidesError } = await supabase
        .from('slides')
        .select('id')
        .eq('slideshow_id', slideshowId)

      if (slidesError) throw slidesError
      const slideIds = (slideData || []).map(s => s.id)

      if (slideIds.length > 0) {
        const { error: deleteTextsError } = await supabase
          .from('slide_texts')
          .delete()
          .in('slide_id', slideIds)
        if (deleteTextsError) throw deleteTextsError

        const { error: deleteOverlaysError } = await supabase
          .from('slide_overlays')
          .delete()
          .in('slide_id', slideIds)
        if (deleteOverlaysError) throw deleteOverlaysError

        const { error: deleteSlidesError } = await supabase
          .from('slides')
          .delete()
          .in('id', slideIds)
        if (deleteSlidesError) throw deleteSlidesError
      }

      const { error: deleteSlideshowError } = await supabase
        .from('slideshows')
        .delete()
        .eq('id', slideshowId)
      if (deleteSlideshowError) throw deleteSlideshowError

      return true
    } catch (err) {
      console.error('Error deleting slideshow:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete slideshow'
      setError(errorMessage)
      await fetchSlideshows()
      throw new Error(errorMessage)
    }
  }

  const renderSlideshow = async (
    slideshowId: string,
    getSlideCanvas: (slideId: string) => fabric.Canvas | undefined | Promise<fabric.Canvas | undefined>,
    onProgress?: (completed: number, total: number) => void
  ) => {
    if (!user) {
      throw new Error('User must be authenticated to render slideshows')
    }

    const slideshow = slideshows.find(s => s.id === slideshowId)
    if (!slideshow) throw new Error('Slideshow not found')

    const total = slideshow.slides.length

    const { error: statusError } = await supabase
      .from('slideshows')
      .update({ status: 'rendering', frame_paths: [] })
      .eq('id', slideshowId)

    if (statusError) {
      console.error('Failed to set slideshow status to rendering:', statusError)
      throw statusError
    }

    setSlideshows(prev =>
      prev.map(s =>
        s.id === slideshowId ? { ...s, status: 'rendering', frame_paths: [] } : s
      )
    )

    try {
      const bucket = 'rendered-slides'

      // Skip bucket creation - assume it exists or handle errors gracefully
      const framePaths: string[] = []

      for (let i = 0; i < slideshow.slides.length; i++) {
        const slide = slideshow.slides[i]
        console.log(`Processing slide ${i + 1}/${total}:`, slide.id)
        
        const canvas = await getSlideCanvas(slide.id)
        console.log(`Canvas lookup result for slide ${slide.id}:`, canvas ? 'Found' : 'Not found')
        
        if (!canvas) {
          console.log(`No canvas found for slide ${slide.id}, skipping...`)
          console.log(`Available slides in slideshow:`, slideshow.slides.map(s => ({ id: s.id, index: s.index })))
          continue
        }
        
        console.log(`Canvas found for slide ${slide.id}, rendering...`)

        const multiplier = 1080 / 300
        const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 1, multiplier })
        const file = await (await fetch(dataUrl)).blob()
        const path = `${user.id}/${slideshowId}/${slide.id}.jpg`
        
        console.log(`Uploading slide ${slide.id} to path:`, path)
        
        try {
          const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
            upsert: true,
            contentType: 'image/jpeg'
          })
          
          if (uploadError) {
            console.error('Upload error for slide', slide.id, ':', uploadError)
            throw uploadError
          }
          
          console.log(`Successfully uploaded slide ${slide.id}`)
          
          // Note: frame_paths is stored in slideshows table, not slides table
          // Individual slide frame paths are tracked in the slideshows.frame_paths array
          
          framePaths.push(path)
          console.log(`Added slide ${slide.id} to framePaths. Total frames:`, framePaths.length)
        } catch (uploadError) {
          console.error('Failed to upload slide frame:', uploadError)
          // Continue with other slides even if one fails
        }

        onProgress?.(i + 1, total)
        console.log(`Completed slide ${i + 1}/${total}`)
      }

      console.log('All slides processed. Final framePaths:', framePaths)
      
      const { error: finalUpdateError } = await supabase
        .from('slideshows')
        .update({ status: 'completed', frame_paths: framePaths })
        .eq('id', slideshowId)
        
      if (finalUpdateError) {
        console.error('Error updating slideshow status:', finalUpdateError)
        throw finalUpdateError
      }
      
      console.log('Successfully updated slideshow status to completed')

      setSlideshows(prev =>
        prev.map(s =>
          s.id === slideshowId ? { ...s, status: 'completed', frame_paths: framePaths } : s
        )
      )
    } catch (err) {
      console.error('Error rendering slideshow:', err)
      // Rollback status
      setSlideshows(prev =>
        prev.map(s => (s.id === slideshowId ? { ...s, status: 'draft' } : s))
      )
      throw err
    }
  }

  return {
    slideshows,
    loading,
    error,
    createSlideshow,
    addSlide,
    deleteSlide,
    deleteSlideshow,
    saveSlideTexts,
    saveSlideOverlays,
    updateSlideBackground,
    updateSlideDuration,
    queueSlideshowRender,
    refetch: fetchSlideshows,
    notice,
    rerenderIds,
    clearRerenderIds: () => setRerenderIds([])
  }
}