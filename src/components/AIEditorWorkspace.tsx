'use client';

import React from 'react';
import AISidebar from '@/components/AISidebar';
import ImageSelectionModal from '@/components/ImageSelectionModal';
import CollectionSelectionModal from '@/components/CollectionSelectionModal';
import ControlPanel from '@/components/editor/ControlPanel';
import SaveButtonOverlay from '@/components/editor/SaveButtonOverlay';
import DeleteButtonOverlay from '@/components/editor/DeleteButtonOverlay';
import TextResizeOverlay from '@/components/editor/TextResizeOverlay';
import SlidesRow, { SlidesLeftSpacer, SlidesRightSpacer } from '@/components/editor/SlidesRow';
import SlidesList from '@/components/editor/SlidesList';
import EmptyState from '@/components/editor/EmptyState';
import { fabric } from 'fabric';
import { animateScrollX, animateScrollY, FAST_SCROLL_DURATION_X_MS, FAST_SCROLL_DURATION_Y_MS } from '@/lib/scroll';
import { scaleImageToFillCanvas, loadFabricImage } from '@/components/editor/fabricUtils';
import { FONT_SIZES, STROKE_WIDTHS, getStrokeWidthForFontSize, TEXT_STYLING } from '@/lib/text-config';
import type { Slideshow, Slide, SlideText, SlideOverlay } from '@/hooks/useSlideshows';
import { useSlideshows } from '@/hooks/useSlideshows';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Icon components for the control panel
const BackgroundIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
    <circle cx="9" cy="9" r="2"/>
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
  </svg>
);

const TextIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 16 2.536-7.328a1.02 1.02 1 0 1 1.928 0L22 16"/>
    <path d="M15.697 14h5.606"/>
    <path d="m2 16 4.039-9.69a.5.5 0 0 1 .923 0L11 16"/>
    <path d="M3.304 13h6.392"/>
  </svg>
);

const ImageIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 22H4a2 2 0 0 1-2-2V6"/>
    <path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18"/>
    <circle cx="12" cy="8" r="2"/>
    <rect width="16" height="16" x="6" y="2" rx="2"/>
  </svg>
);

const SaveIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17,21 17,13 7,13 7,21"/>
    <polyline points="7,3 7,8 15,8"/>
  </svg>
);

interface JSONText {
  text: string;
  position_x: number;
  position_y: number;
  size: number;
}

interface JSONOverlay {
  image_ref: string;
  position_x: number;
  position_y: number;
  rotation: number;
  size: number;
}

interface JSONSlide {
  background_image_ref?: string | null;
  texts?: JSONText[];
  overlays?: JSONOverlay[];
}

interface JSONSlideshow {
  caption: string;
  slides: JSONSlide[];
}

export default function AIEditorWorkspace() {
  // Hooks for saving to database
  const { 
    createSlideshow, 
    saveSlideTexts, 
    saveSlideOverlays, 
    updateSlideBackground,
    updateSlideDuration
  } = useSlideshows();
  const router = useRouter();
  
  // Follow the same pattern as SlideshowEditor: use localSlideshows state
  const [localSlideshows, setLocalSlideshows] = React.useState<any[]>([]);
  const [selectedSlideshowId, setSelectedSlideshowId] = React.useState<string>('');
  const [selectedSlideId, setSelectedSlideId] = React.useState<string>('');
  const [slideRenderKey, setSlideRenderKey] = React.useState<number>(0);
  const [isEditorCleared, setIsEditorCleared] = React.useState<boolean>(true);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  // Computed value: use local slideshows (similar to main editor)  
  const displaySlideshows = localSlideshows;
  const currentSlideshow = displaySlideshows.find((s: any) => s.id === selectedSlideshowId);
  const currentSlide = currentSlideshow?.slides.find((s: Slide) => s.id === selectedSlideId);
  
  // Control panel state
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = React.useState<boolean>(false);
  const [isImageModalOpen, setIsImageModalOpen] = React.useState<boolean>(false);
  // Track selected text object for resize controls (same as main editor)
  const [selectedTextObject, setSelectedTextObject] = React.useState<{
    fabricObject: fabric.IText;
    textId: string;
    position: { x: number; y: number };
  } | null>(null);
  const selectedTextObjectRef = React.useRef<{
    fabricObject: fabric.IText;
    textId: string;
    position: { x: number; y: number };
  } | null>(null);
  
  const [isTextDragging, setIsTextDragging] = React.useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState<boolean>(false);
  const [forceCanvasRefresh, setForceCanvasRefresh] = React.useState<number>(0);
  
  // Scroll durations now come from global config in '@/lib/scroll'

  // Layout/aspect
  const parseAspectRatio = (ratio: string) => {
    const [w, h] = ratio.split(':').map(Number);
    return w && h ? w / h : 9 / 16;
  };
  const aspectRatio = parseAspectRatio('9:16');
  const CANVAS_WIDTH = 300;
  const CANVAS_HEIGHT = Math.round(CANVAS_WIDTH / aspectRatio);
  const MINI_CANVAS_WIDTH = 200;
  const MINI_CANVAS_HEIGHT = Math.round(MINI_CANVAS_WIDTH / aspectRatio);



  const scaleImageToFillCanvas = (
    img: fabric.Image,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    const imgWidth = img.width || 1;
    const imgHeight = img.height || 1;
    const scale = Math.max(canvasWidth / imgWidth, canvasHeight / imgHeight);
    img.set({ scaleX: scale, scaleY: scale });
    const scaledWidth = imgWidth * scale;
    const scaledHeight = imgHeight * scale;
    img.set({
      left: (canvasWidth - scaledWidth) / 2,
      top: (canvasHeight - scaledHeight) / 2,
      originX: 'left',
      originY: 'top'
    });
  };

  // Fabric refs
  const canvasRefs = React.useRef<{ [key: string]: fabric.Canvas }>({});
  const miniCanvasRefs = React.useRef<{ [key: string]: fabric.Canvas }>({});
  const canvasElementRefs = React.useRef<{ [key: string]: HTMLCanvasElement }>({});
  const miniCanvasElementRefs = React.useRef<{ [key: string]: HTMLCanvasElement }>({});
  const initializingCanvasesRef = React.useRef<Set<string>>(new Set());
  const initializingMiniCanvasesRef = React.useRef<Set<string>>(new Set());
  const scrollContainerRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const verticalScrollRef = React.useRef<HTMLDivElement>(null);
  const aiThoughtsRef = React.useRef<HTMLDivElement>(null);
  // Thumbnail store for unselected slides
  const [thumbnails, setThumbnails] = React.useState<Record<string, string>>({});
  const [verticalPad, setVerticalPad] = React.useState<number>(0);
  const [aiThoughts, setAiThoughts] = React.useState<string>('');
  const [slideshowJson, setSlideshowJson] = React.useState<string>('');
  const [isSelectImagesOpen, setIsSelectImagesOpen] = React.useState<boolean>(false);
  const [selectedImageIds, setSelectedImageIds] = React.useState<string[]>([]);
  const [isSelectCollectionsOpen, setIsSelectCollectionsOpen] = React.useState<boolean>(false);
  const [selectedCollectionIds, setSelectedCollectionIds] = React.useState<string[]>([]);
  const [selectedAspectRatio, setSelectedAspectRatio] = React.useState<string>('9:16');
  const [isGenerating, setIsGenerating] = React.useState<boolean>(false);
  const [generationCompleted, setGenerationCompleted] = React.useState<boolean>(false);

  // Load saved collection IDs from localStorage on mount (same pattern as AISidebar)
  React.useEffect(() => {
    try {
      const savedCollectionIds = localStorage.getItem('aiEditorSelectedCollectionIds');
      if (savedCollectionIds) {
        const ids = JSON.parse(savedCollectionIds) as string[];
        setSelectedCollectionIds(ids);
      }
    } catch (_) {
      // Ignore localStorage errors
    }
  }, []);

  const createPlaceholderThumbnail = React.useCallback((slideId: string) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
      const dataUrl = canvas.toDataURL('image/png');
      setThumbnails(prev => ({ ...prev, [slideId]: dataUrl }));
    } catch {}
  }, [CANVAS_WIDTH, CANVAS_HEIGHT]);

  const ensureThumbnailsForSlides = React.useCallback((slideIds: string[]) => {
    setTimeout(() => {
      slideIds.forEach((id) => {
        setThumbnails(prev => {
          if (prev[id]) return prev;
          // Create placeholder if no thumbnail exists yet
          const canvas = document.createElement('canvas');
          canvas.width = CANVAS_WIDTH;
          canvas.height = CANVAS_HEIGHT;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#f5f5f5';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          }
          const dataUrl = canvas.toDataURL('image/png');
          return { ...prev, [id]: dataUrl };
        });
      });
    }, 0);
  }, [CANVAS_WIDTH, CANVAS_HEIGHT]);

  // Auto-scroll AI thoughts to bottom when new content is added
  React.useEffect(() => {
    const aiThoughtsDiv = aiThoughtsRef.current;
    if (aiThoughtsDiv && aiThoughts) {
      // Use requestAnimationFrame to ensure DOM has updated before scrolling
      requestAnimationFrame(() => {
        aiThoughtsDiv.scrollTop = aiThoughtsDiv.scrollHeight;
      });
    }
  }, [aiThoughts]);

  // Observe vertical container size to compute top/bottom padding that enables perfect centering
  React.useEffect(() => {
    const el = verticalScrollRef.current;
    if (!el) return;
    const update = () => {
      const h = el.clientHeight || 0;
      setVerticalPad(Math.max(0, Math.floor(h / 2)));
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      try { ro.disconnect(); } catch {}
      window.removeEventListener('resize', update);
    };
  }, []);

  // Helpers
  // animateScrollX/Y imported from '@/lib/scroll'

  const centerSlide = (slideId: string, delay: number = 50, options?: { fastVertical?: boolean; fastHorizontal?: boolean }) => {
    setTimeout(() => {
      const yContainer = verticalScrollRef.current;
      if (!yContainer) return;

      const slideElement = yContainer.querySelector(`[data-slide-id="${slideId}"]`) as HTMLElement | null;
      if (!slideElement) return;

      // Horizontal centering: find the row container that holds this slide
      let rowContainer: HTMLDivElement | null = null;
      for (const container of scrollContainerRefs.current) {
        if (container && container.contains(slideElement)) {
          rowContainer = container as HTMLDivElement;
          break;
        }
      }

      if (rowContainer) {
        const rowRect = rowContainer.getBoundingClientRect();
        const slideRect = slideElement.getBoundingClientRect();
        const targetLeft = rowContainer.scrollLeft + (slideRect.left - rowRect.left) - (rowRect.width / 2) + (slideRect.width / 2);
        // Always use the configurable X duration so same-row and cross-row selections are consistent
        animateScrollX(rowContainer, targetLeft, FAST_SCROLL_DURATION_X_MS);
      }

      // Vertical centering: use the main vertical container
      const containerRect = yContainer.getBoundingClientRect();
      const slideRect = slideElement.getBoundingClientRect();
      const targetTop = yContainer.scrollTop + (slideRect.top - containerRect.top) - (containerRect.height / 2) + (slideRect.height / 2);
      if (options?.fastVertical) {
        // Shorter duration for row switches to feel snappier
        animateScrollY(yContainer, targetTop, FAST_SCROLL_DURATION_Y_MS);
      } else {
        yContainer.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    }, delay);
  };

  const disposeCanvas = (slideId: string) => {
    const c = canvasRefs.current[slideId];
    if (c) {
      // Capture a fresh thumbnail before disposing, if possible
      try {
        const dataUrl = c.toDataURL({ format: 'png' });
        setThumbnails(prev => ({ ...prev, [slideId]: dataUrl }));
      } catch {}
      // Do NOT call dispose() here to avoid DOM mutations conflicting with React unmount
      try { c.clear(); } catch {}
      delete canvasRefs.current[slideId];
      delete canvasElementRefs.current[slideId];
    }
  };

  const disposeMiniCanvas = (slideId: string) => {
    const c = miniCanvasRefs.current[slideId];
    if (c) {
      // Capture thumbnail from mini canvas as well for redundancy
      try {
        const dataUrl = c.toDataURL({ format: 'png' });
        setThumbnails(prev => ({ ...prev, [slideId]: dataUrl }));
      } catch {}
      // Do NOT call dispose() here to avoid DOM mutations conflicting with React unmount
      try { c.clear(); } catch {}
      delete miniCanvasRefs.current[slideId];
      delete miniCanvasElementRefs.current[slideId];
    }
  };

  React.useEffect(() => {
    return () => {
      Object.keys(canvasRefs.current).forEach(disposeCanvas);
      Object.keys(miniCanvasRefs.current).forEach(disposeMiniCanvas);
    };
  }, []);

  // Force canvas refresh when local state changes to ensure elements persist
  React.useEffect(() => {
    if (forceCanvasRefresh > 0 && selectedSlideId) {
      console.log('[AIEditor] Forcing canvas refresh for slide:', selectedSlideId);
      
      // Small delay to ensure state updates have flushed
      setTimeout(() => {
        const canvas = canvasRefs.current[selectedSlideId];
        if (canvas) {
          // Get the current slide data with latest updates
          console.log('[AIEditor] Refreshing canvas with slide data:', currentSlide);
          
          if (currentSlide) {
            // Refresh canvas without disposing - just ensure all elements are present
            canvas.renderAll();
            
            // Update thumbnail to reflect changes
            try {
              const dataUrl = canvas.toDataURL({ format: 'png' });
              setThumbnails(prev => ({ ...prev, [selectedSlideId]: dataUrl }));
            } catch {}
          }
        }
      }, 10);
    }
  }, [forceCanvasRefresh, selectedSlideId, currentSlide]);

  // Keyboard event listener for delete functionality (same pattern as main editor)
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const canvas = canvasRefs.current[selectedSlideId];
        if (canvas) {
          const activeObject = canvas.getActiveObject();
          if (activeObject && !activeObject.get('isBackground')) {
            // Check if it's a text object in editing mode
            if (activeObject.get('textId')) {
              // For text objects, only delete if not in editing mode
              const textObject = activeObject as fabric.IText;
              if (textObject.isEditing) {
                // User is editing text content, don't delete the text object
                return;
              }
            }

            // Prevent default behavior (like navigating back in browser for Backspace)
            e.preventDefault();

            // Remove from canvas
            canvas.remove(activeObject);
            canvas.renderAll();

            // Remove from slide data
            if (activeObject.get('textId')) {
              // It's a text object
              const textId = activeObject.get('textId');
              if (currentSlide?.texts) {
                currentSlide.texts = currentSlide.texts.filter((t: any) => t.id !== textId);
                // Update local state to persist deletion when switching slides
                updateLocalSlideshow(selectedSlideshowId, selectedSlideId, {
                  texts: currentSlide.texts
                });
                // Mark as having unsaved changes
                setHasUnsavedChanges(true);
                // Clear text selection
                updateSelectedTextObject(null);
              }
            } else if (activeObject.get('overlayId')) {
              // It's an image overlay
              const overlayId = activeObject.get('overlayId');
              if (currentSlide?.overlays) {
                currentSlide.overlays = currentSlide.overlays.filter((o: any) => o.id !== overlayId);
                // Update local state to persist deletion when switching slides
                updateLocalSlideshow(selectedSlideshowId, selectedSlideId, {
                  overlays: currentSlide.overlays
                });
                // Mark as having unsaved changes
                setHasUnsavedChanges(true);
              }
            }
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [selectedSlideId, currentSlide, currentSlideshow]);

  // Text selection helpers (same as main editor)
  const getButtonPosition = (textObj: fabric.IText) => {
    textObj.setCoords();
    const rect = textObj.getBoundingRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height
    };
  };

  const updateSelectedTextObject = (
    obj: {
      fabricObject: fabric.IText;
      textId: string;
    } | null
  ) => {
    if (!obj) {
      setSelectedTextObject(null);
      selectedTextObjectRef.current = null;
      return;
    }
    const position = getButtonPosition(obj.fabricObject);
    const updated = { ...obj, position };
    setSelectedTextObject(updated);
    selectedTextObjectRef.current = updated;
  };

  const adjustFontSize = (delta: number) => {
    const current = selectedTextObjectRef.current;
    if (!current) return;
    
    const obj = current.fabricObject;
    const currentSize = obj.fontSize || 24;
    
    const findNearestIndex = (size: number) => {
      let nearest = 0;
      for (let i = 1; i < FONT_SIZES.length; i++) {
        if (Math.abs(FONT_SIZES[i] - size) < Math.abs(FONT_SIZES[nearest] - size)) {
          nearest = i;
        }
      }
      return nearest;
    };
    
    const currentIndex = findNearestIndex(currentSize);
    const newIndex = Math.min(
      FONT_SIZES.length - 1,
      Math.max(0, currentIndex + (delta > 0 ? 1 : -1))
    );
    const newSize = FONT_SIZES[newIndex];
    const newStroke = STROKE_WIDTHS[newIndex];
    
    obj.set({ fontSize: newSize, scaleX: 1, scaleY: 1 });
    obj.set('strokeWidth', newStroke);
    obj.setCoords();
    obj.canvas?.renderAll();
    
    updateTextData(current.textId, obj);
    // Update button position based on new size
    updateSelectedTextObject({ fabricObject: obj, textId: current.textId });
  };



  // Helper function to update local slideshow state (same pattern as main editor)
  const updateLocalSlideshow = (slideshowId: string, slideId: string, updates: Partial<Slide>) => {
    const updatedSlideshows = displaySlideshows.map((slideshow: any) => {
      if (slideshow.id === slideshowId) {
        return {
          ...slideshow,
          slides: slideshow.slides.map((slide: any) => {
            if (slide.id === slideId) {
              return { ...slide, ...updates };
            }
            return slide;
          })
        };
      }
      return slideshow;
    });
    setLocalSlideshows(updatedSlideshows);
    setHasUnsavedChanges(true);
  };

  // Direct mutation approach (same as main editor)
  const updateTextData = (textId: string, fabricText: fabric.IText) => {
    if (!currentSlide?.texts) return;

    const textData = currentSlide.texts.find((t: any) => t.id === textId);
    if (textData) {
      // Direct mutation (same as main editor)
      textData.text = fabricText.text || 'text';
      textData.position_x = fabricText.left || 0;
      textData.position_y = fabricText.top || 0;
      textData.rotation = fabricText.angle || 0;
      
      // Handle font size scaling
      const effectiveFontSize = (fabricText.fontSize || 24) * (fabricText.scaleX || 1);
      textData.size = effectiveFontSize;
      
      setHasUnsavedChanges(true);
      console.log('[AIEditor] Text data updated:', textData);
    }
  };

  const updateOverlayData = (overlayId: string, fabricImg: fabric.Image) => {
    if (!currentSlide?.overlays) return;

    const overlayData = currentSlide.overlays.find((o: any) => o.id === overlayId);
    if (overlayData) {
      // Direct mutation (same pattern as main editor)
      overlayData.position_x = fabricImg.left || 0;
      overlayData.position_y = fabricImg.top || 0;
      overlayData.rotation = fabricImg.angle || 0;
      overlayData.size = Math.round((fabricImg.scaleX || 1) * 100);
      
      setHasUnsavedChanges(true);
      console.log('[AIEditor] Overlay data updated:', overlayData);
    }
  };

  // Ensure proper layering: background -> overlays -> text (modified to preserve background scaling)
  const ensureProperLayering = (canvas: fabric.Canvas) => {
    const objects: any[] = canvas.getObjects() as any;
    
    // Sort objects by type: background -> overlays -> text
    const backgroundObjects = objects.filter(obj => (obj as any).get('isBackground'));
    const overlayObjects = objects.filter(obj => (obj as any).get('overlayId'));  
    const textObjects = objects.filter(obj => (obj as any).get('textId'));
    
    // If objects are already in correct order, no need to reorganize
    const correctOrder = [...backgroundObjects, ...overlayObjects, ...textObjects];
    const currentOrder = objects;
    
    let needsReordering = false;
    for (let i = 0; i < correctOrder.length; i++) {
      const cur = currentOrder[i] as any;
      const cor = correctOrder[i] as any;
      if (cur !== cor) {
        needsReordering = true;
        break;
      }
    }
    
    if (needsReordering) {
      // For background objects, just send them to back instead of removing/re-adding
      // This preserves their properties and prevents the gray flash
      backgroundObjects.forEach((obj: any) => canvas.sendToBack(obj));
      
      // Remove and re-add only non-background objects
      const nonBackgroundObjects = [...overlayObjects, ...textObjects];
      nonBackgroundObjects.forEach((obj: any) => canvas.remove(obj));
      correctOrder.slice(backgroundObjects.length).forEach((obj: any) => canvas.add(obj));
      
      canvas.renderAll();
    }
  };

  // Text editing functions
  const getTextStyling = (fontSize: number = 24) => ({
    fontFamily: TEXT_STYLING.fontFamily,
    fontWeight: TEXT_STYLING.fontWeight,
    fill: TEXT_STYLING.fill,
    stroke: 'black',
    strokeWidth: getStrokeWidthForFontSize(fontSize),
    textAlign: 'center' as const,
    originX: 'center' as const,
    originY: 'center' as const,
    charSpacing: -40,
    lineHeight: 1.0,
    fontSize
  });



  const addTextElement = () => {
    if (!currentSlide) {
      console.warn('[AIEditor] No current slide found when adding text');
      return;
    }

    console.log('[AIEditor] Adding text element to slide:', selectedSlideId);

    const textId = `text-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const newText: SlideText = {
      id: textId,
      slide_id: selectedSlideId,
      text: 'New Text',
      position_x: CANVAS_WIDTH / 2,
      position_y: CANVAS_HEIGHT / 2,
      size: 32,
      rotation: 0,
      font: TEXT_STYLING.fontFamily,
      created_at: new Date().toISOString()
    };

    // CRITICAL: Direct mutation FIRST (same as main editor)
    if (!currentSlide.texts) {
      currentSlide.texts = [];
    }
    currentSlide.texts.push(newText);
    
    // Update local state to persist when switching slides
    if (!currentSlideshow) {
      console.warn('[AIEditor] No slideshow found when adding text');
      return;
    }
    
    updateLocalSlideshow(selectedSlideshowId, selectedSlideId, {
      texts: currentSlide.texts
    });

    // Add text to canvas immediately
    const canvas = canvasRefs.current[selectedSlideId];
    if (canvas) {
      const fabricText = new fabric.IText(newText.text, {
        ...getTextStyling(newText.size),
        left: newText.position_x,
        top: newText.position_y,
        angle: newText.rotation,
        lockUniScaling: true,
      });

      // Disable resize controls
      fabricText.setControlsVisibility({
        ml: false, mb: false, mr: false, mt: false,
        tl: false, tr: false, bl: false, br: false,
      });

      // Store text ID for reference
      (fabricText as any).textId = textId;

              // Listen for text changes (now the text data exists so direct mutation will work)
        fabricText.on('changed', () => updateTextData(textId, fabricText));
        fabricText.on('moving', () => updateTextData(textId, fabricText));
        fabricText.on('rotating', () => updateTextData(textId, fabricText));
        fabricText.on('scaling', () => updateTextData(textId, fabricText));

      canvas.add(fabricText);
      canvas.setActiveObject(fabricText);
      
      // Ensure proper layering after adding text (same as main editor)
      ensureProperLayering(canvas);
      canvas.renderAll();
      
      console.log('[AIEditor] Text added to canvas successfully');
    } else {
      console.warn('[AIEditor] No canvas found for slide:', selectedSlideId);
    }
  };

  const handleBackgroundImageSelect = (imageUrl: string, imageId: string) => {
    if (!currentSlide) return;

    console.log('[AIEditor] Updating background image:', { imageUrl, imageId });

    // Direct mutation FIRST (same as main editor)
    currentSlide.background_image_id = imageId;
    currentSlide.backgroundImage = imageUrl;
    
    // Update local state to persist when switching slides
    if (!currentSlideshow) {
      console.warn('[AIEditor] No slideshow found when updating background');
      return;
    }
    
    updateLocalSlideshow(selectedSlideshowId, selectedSlideId, {
      background_image_id: imageId,
      backgroundImage: imageUrl
    });

    // Update canvas background immediately (same approach as main editor)
    const canvas = canvasRefs.current[selectedSlideId];
    if (canvas) {
      // Clear existing background images
      const objects = canvas.getObjects();
      objects.forEach((obj: any) => {
        if (obj.get('isBackground')) {
          canvas.remove(obj);
        }
      });

      // Add new background image
      loadFabricImage(imageUrl, { crossOrigin: 'anonymous' }).then((img: fabric.Image) => {
        img.set({
          selectable: false,
          evented: false,
          isBackground: true
        });
        
        // Scale image to fill entire canvas background
        scaleImageToFillCanvas(img, CANVAS_WIDTH, CANVAS_HEIGHT);
        canvas.add(img);
        
        // CRITICAL: Ensure proper layering after adding background (same as main editor)
        ensureProperLayering(canvas);
        canvas.renderAll();
        
        console.log('[AIEditor] Background image updated successfully');
      }).catch((error: unknown) => {
        console.warn('[AIEditor] Failed to load background image:', imageUrl, error);
      });
    } else {
      console.warn('[AIEditor] No canvas found for slide:', selectedSlideId);
    }
  };

  const handleImageOverlaySelect = (imageUrl: string, imageId: string) => {
    if (!currentSlide) {
      console.warn('[AIEditor] No current slide found when adding overlay');
      return;
    }

    console.log('[AIEditor] Adding image overlay to slide:', selectedSlideId);

    const overlayId = `overlay-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const newOverlay: SlideOverlay = {
      id: overlayId,
      slide_id: selectedSlideId,
      image_id: imageId,
      position_x: CANVAS_WIDTH / 2,
      position_y: CANVAS_HEIGHT / 2,
      rotation: 0,
      size: 50,
      created_at: new Date().toISOString(),
      imageUrl: imageUrl // Store the URL for canvas restoration
    };

    // CRITICAL: Direct mutation FIRST (same as main editor)
    if (!currentSlide.overlays) {
      currentSlide.overlays = [];
    }
    currentSlide.overlays.push(newOverlay);
    
    // Update local state to persist when switching slides
    if (!currentSlideshow) {
      console.warn('[AIEditor] No slideshow found when adding overlay');
      return;
    }
    
    updateLocalSlideshow(selectedSlideshowId, selectedSlideId, {
      overlays: currentSlide.overlays
    });

    // Add to canvas immediately
    const canvas = canvasRefs.current[selectedSlideId];
    if (canvas) {
      loadFabricImage(imageUrl, { crossOrigin: 'anonymous' }).then((img: fabric.Image) => {
        const scale = newOverlay.size / 100;
        img.set({
          left: newOverlay.position_x,
          top: newOverlay.position_y,
          scaleX: scale,
          scaleY: scale,
          angle: newOverlay.rotation,
          originX: 'center',
          originY: 'center',
          selectable: true,
          evented: true,
        });

        // Disable some controls for overlays
        img.setControlsVisibility({
          ml: false, mb: false, mr: false, mt: false,
        });

        // Store overlay ID for reference  
        (img as any).overlayId = overlayId;

        // Listen for overlay changes and update data (now overlay data exists so direct mutation will work)
        const handleOverlayChange = () => {
          updateOverlayData(overlayId, img);
        };

        img.on('moving', handleOverlayChange);
        img.on('rotating', handleOverlayChange);
        img.on('scaling', handleOverlayChange);

        canvas.add(img);
        canvas.setActiveObject(img);
        
        // Ensure proper layering after adding overlay (same as main editor) 
        ensureProperLayering(canvas);
        canvas.renderAll();
        
        console.log('[AIEditor] Overlay added to canvas successfully');
      }).catch((error: unknown) => {
        console.warn('[AIEditor] Failed to load overlay image:', imageUrl, error);
      });
    } else {
      console.warn('[AIEditor] No canvas found for slide:', selectedSlideId);
    }
  };

  const handleDurationChange = () => {
    // For now, just cycle through common durations
    if (!currentSlide) return;

    const durations = [1, 2, 3, 4, 5];
    const currentDuration = currentSlide.duration_seconds || 3;
    const currentIndex = durations.indexOf(currentDuration);
    const nextIndex = (currentIndex + 1) % durations.length;
    const newDuration = durations[nextIndex];

    if (currentSlideshow) {
      updateLocalSlideshow(selectedSlideshowId, selectedSlideId, { duration_seconds: newDuration });
    }
  };

  // Fabric initializers (blank canvases only)
  const initializeCanvas = (slideId: string, canvasElement: HTMLCanvasElement) => {
    if (!canvasElement || !canvasElement.parentNode) return;
    if (canvasRefs.current[slideId]) return;

    // Get the slide data from current slideshow (same pattern as main editor)
          const slide = currentSlideshow?.slides.find((s: any) => s.id === slideId);
    if (!slide) {
      console.warn('[AIEditor] No slide found for canvas initialization:', slideId);
      return;
    }

    console.log('[AIEditor] Initializing canvas for slide:', slideId);
    console.log('[AIEditor] Slide data during initialization:', slide);

    try {
      const canvas = new fabric.Canvas(canvasElement, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: '#f5f5f5'
      });
      
      // Track the DOM element so we can avoid disposing when React is unmounting
      canvasElementRefs.current[slideId] = canvasElement;
      canvasRefs.current[slideId] = canvas;

      // Restore slide elements from current state
      console.log('[AIEditor] Restoring elements - Texts:', slide.texts?.length || 0, 'Overlays:', slide.overlays?.length || 0);

      if (slide.backgroundImage) {
        fabric.Image.fromURL(
          slide.backgroundImage,
          (img: fabric.Image) => {
            img.set({ 
              selectable: false, 
              evented: false,
              isBackground: true
            });
            scaleImageToFillCanvas(img, CANVAS_WIDTH, CANVAS_HEIGHT);
            canvas.add(img);
            canvas.sendToBack(img);
            canvas.renderAll();
            try {
              const dataUrl = canvas.toDataURL({ format: 'png' });
              setThumbnails(prev => ({ ...prev, [slideId]: dataUrl }));
            } catch {}
          },
          { crossOrigin: 'anonymous' }
        );
      }
      
      slide.texts?.forEach((textData: any) => {
        const fabricText = new fabric.IText(textData.text, {
          ...getTextStyling(textData.size),
          left: textData.position_x,
          top: textData.position_y,
          angle: textData.rotation || 0,
          lockUniScaling: true,
        });

        // Disable resize controls for text - only allow rotation and movement
        fabricText.setControlsVisibility({
          ml: false, // middle left
          mb: false, // middle bottom  
          mr: false, // middle right
          mt: false, // middle top
          tl: false, // top left corner
          tr: false, // top right corner
          bl: false, // bottom left corner
          br: false, // bottom right corner
        });

        // Store the text ID for reference
        (fabricText as any).textId = textData.id;

        // Listen for text changes and update data
        fabricText.on('changed', () => updateTextData(textData.id, fabricText));
        fabricText.on('moving', () => updateTextData(textData.id, fabricText));
        fabricText.on('rotating', () => updateTextData(textData.id, fabricText));

        canvas.add(fabricText);
      });
      
      console.log('[AIEditor] Restored', slide.texts?.length || 0, 'text elements');
      
      slide.overlays?.forEach((overlayData: any) => {
        if (overlayData.imageUrl) {
          fabric.Image.fromURL(
            overlayData.imageUrl,
            (img: fabric.Image) => {
              img.set({
                  left: overlayData.position_x,
                  top: overlayData.position_y,
                  scaleX: overlayData.size / 100,
                  scaleY: overlayData.size / 100,
                  angle: overlayData.rotation,
                  originX: 'center',
                  originY: 'center',
                  selectable: true,
                evented: true,
              });

              // Disable some controls for overlays
              img.setControlsVisibility({
                ml: false, // middle left
                mb: false, // middle bottom  
                mr: false, // middle right
                mt: false, // middle top
              });

              // Store overlay ID for reference
              (img as any).overlayId = overlayData.id;

              // Listen for overlay changes and update data (direct mutation like main editor)
              const handleOverlayChange = () => {
                updateOverlayData(overlayData.id, img);
              };

              img.on('moving', handleOverlayChange);
              img.on('rotating', handleOverlayChange);
              img.on('scaling', handleOverlayChange);

              canvas.add(img);
              
              // Ensure proper layering after adding restored overlay
              ensureProperLayering(canvas);
              canvas.renderAll();
              
              try {
                const dataUrl = canvas.toDataURL({ format: 'png' });
                setThumbnails(prev => ({ ...prev, [slideId]: dataUrl }));
              } catch {}
            },
            { crossOrigin: 'anonymous' }
          );
        }
      });
      
      console.log('[AIEditor] Restored', slide.overlays?.length || 0, 'overlay elements');

      // Ensure proper layering after restoring all elements (same as main editor)
      ensureProperLayering(canvas);
      
      // Add text selection event handlers (same as main editor)
      const handleSelectionChange = () => {
        const activeObject = canvas.getActiveObject();
        if (activeObject && activeObject.get('textId')) {
          updateSelectedTextObject({
            fabricObject: activeObject as fabric.IText,
            textId: activeObject.get('textId')
          });
        } else {
          updateSelectedTextObject(null);
        }
      };

      canvas.on('selection:cleared', () => {
        setTimeout(() => {
          const activeObject = canvas.getActiveObject();
          if (!activeObject || !activeObject.get('textId')) {
            updateSelectedTextObject(null);
          }
        }, 50);
      });
      
      canvas.on('selection:created', handleSelectionChange);
      canvas.on('selection:updated', handleSelectionChange);
      
      // Hide controls while dragging and show when released
      canvas.on('mouse:down', () => {
        const activeObject = canvas.getActiveObject();
        if (activeObject && activeObject.get('textId')) {
          setIsTextDragging(true);
        }
      });

      canvas.on('mouse:up', () => {
        setTimeout(() => {
          setIsTextDragging(false);
          const activeObject = canvas.getActiveObject();
          if (activeObject && activeObject.get('textId')) {
            updateSelectedTextObject({
              fabricObject: activeObject as fabric.IText,
              textId: activeObject.get('textId')
            });
          }
        }, 25);
      });


      
      canvas.renderAll();
      // After first render, capture a thumbnail for when this slide becomes mini
      try {
        const dataUrl = canvas.toDataURL({ format: 'png' });
        setThumbnails(prev => ({ ...prev, [slideId]: dataUrl }));
      } catch {}
    } catch (err) {
      console.error('Failed to initialize canvas:', err);
      disposeCanvas(slideId);
    }
  };

  const initializeMiniCanvas = (slideId: string, canvasElement: HTMLCanvasElement) => {
    if (!canvasElement || !canvasElement.parentNode) return;
    
    // Check if slide exists in current slideshow (same pattern as main editor)
    const slideExists = currentSlideshow?.slides.some((slide: any) => slide.id === slideId);
    if (!slideExists) return;
    
    if (miniCanvasRefs.current[slideId]) return;

    try {
      const canvas = new fabric.Canvas(canvasElement, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: '#f5f5f5'
      });
      canvas.selection = false;
      canvas.skipTargetFind = true;
      miniCanvasElementRefs.current[slideId] = canvasElement;
      miniCanvasRefs.current[slideId] = canvas;
      canvas.renderAll();
      // Immediately capture a thumbnail to avoid white/invisible state
      try {
        const dataUrl = canvas.toDataURL({ format: 'png' });
        setThumbnails(prev => ({ ...prev, [slideId]: dataUrl }));
      } catch {}
    } catch (err) {
      console.error('Failed to initialize mini canvas:', err);
      disposeMiniCanvas(slideId);
    }
  };

  // Save function to persist slideshow to database
  const handleSave = async () => {
    if (!currentSlideshow || !currentSlideshow.slides || currentSlideshow.slides.length === 0) {
      alert('No slideshow to save');
      return;
    }

    setIsSaving(true);
    
    try {
      console.log('[AIEditor] Starting save process for slideshow:', currentSlideshow.name);
      
      // Create the slideshow in the database
      const savedSlideshow = await createSlideshow(
        currentSlideshow.name || 'AI Generated Slideshow',
        undefined, // productId - can be added later if needed
        currentSlideshow.aspect_ratio || '9:16'
      );
      
      console.log('[AIEditor] Created slideshow in database:', savedSlideshow.id);
      
      // Delete the initial blank slide that createSlideshow creates
      if (savedSlideshow.slides.length > 0) {
        const { error } = await supabase
          .from('slides')
          .delete()
          .eq('id', savedSlideshow.slides[0].id);
        if (error) throw error;
      }
      
      // Create all slides in the database
      const slideInserts = currentSlideshow.slides.map((slide: any, index: number) => ({
        slideshow_id: savedSlideshow.id,
        background_image_id: slide.background_image_id || null,
        duration_seconds: slide.duration_seconds || 3,
        index: index
      }));
      
      const { data: createdSlides, error: slideError } = await supabase
        .from('slides')
        .insert(slideInserts)
        .select();
        
      if (slideError) throw slideError;
      
      console.log('[AIEditor] Created slides in database:', createdSlides?.length);
      
      // Save texts and overlays for each slide
      for (let i = 0; i < currentSlideshow.slides.length; i++) {
        const localSlide = currentSlideshow.slides[i];
        const dbSlide = createdSlides?.[i];
        
        if (!dbSlide) continue;
        
        console.log(`[AIEditor] Saving slide ${i + 1}/${currentSlideshow.slides.length} - texts: ${localSlide.texts?.length || 0}, overlays: ${localSlide.overlays?.length || 0}`);
        
        // Save texts
        if (localSlide.texts && localSlide.texts.length > 0) {
          const textsToSave = localSlide.texts.map((text: any) => ({
            ...text,
            slide_id: dbSlide.id
          }));
          await saveSlideTexts(dbSlide.id, textsToSave);
        }
        
        // Save overlays 
        if (localSlide.overlays && localSlide.overlays.length > 0) {
          const overlaysToSave = localSlide.overlays.map((overlay: any) => ({
            ...overlay,
            slide_id: dbSlide.id
          }));
          await saveSlideOverlays(dbSlide.id, overlaysToSave);
        }
      }
      
      console.log('[AIEditor] Slideshow saved successfully, navigating to editor');
      
      // Navigate to the main slideshow editor in drafts mode
      router.push('/editor?mode=drafts');
      
    } catch (error) {
      console.error('[AIEditor] Error saving slideshow:', error);
      alert('Failed to save slideshow. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Actions
  const handleGenerate = () => {
    // Dispose existing canvases to avoid stale refs
    Object.keys(canvasRefs.current).forEach(disposeCanvas);
    Object.keys(miniCanvasRefs.current).forEach(disposeMiniCanvas);
    
    // Reset generation state when creating new slideshow
    setGenerationCompleted(false);

    const createdAt = new Date().toISOString();
    const slideshowId = `ai-generated-${Date.now()}`;
    const newSlides: Slide[] = Array.from({ length: 5 }).map((_, idx) => ({
      id: `ai-slide-${Date.now()}-${idx}`,
      slideshow_id: slideshowId,
      duration_seconds: 3,
      index: idx,
      created_at: createdAt,
      texts: [],
      overlays: []
    }));

    const newSlideshow: any = {
      id: slideshowId,
      user_id: '',
      name: 'AI Generated Slideshow',
      status: 'draft',
      aspect_ratio: '9:16',
      created_at: createdAt,
      slides: newSlides
    };

    setLocalSlideshows([newSlideshow]);
    setSelectedSlideshowId(newSlideshow.id);
    setSelectedSlideId(newSlides[0].id);
    setSlideRenderKey(prev => prev + 1);
    setIsEditorCleared(false);
    ensureThumbnailsForSlides(newSlides.map(s => s.id));
    centerSlide(newSlides[0].id, 100);
  };

  const handleGenerateFromJson = (jsonString: string) => {
    // Dispose existing canvases to avoid stale refs
    Object.keys(canvasRefs.current).forEach(disposeCanvas);
    Object.keys(miniCanvasRefs.current).forEach(disposeMiniCanvas);

    let data: JSONSlideshow;
    try {
      data = JSON.parse(jsonString) as JSONSlideshow;
    } catch {
      alert('Invalid JSON');
      return;
    }
    const rawSlides: any[] = Array.isArray((data as any).slides)
      ? ((data as any).slides as any[])
      : ((data as any).slides ? [((data as any).slides as any)] : []);
    if (!data || rawSlides.length === 0) {
      alert('JSON must contain slides');
      return;
    }

    const createdAt = new Date().toISOString();
    const newSlides: Slide[] = rawSlides.map((slide: any, idx: number) => {
      const slideId = `json-slide-${Date.now()}-${idx}`;
      return {
        id: slideId,
        slideshow_id: 'ai-local',
        duration_seconds: 3,
        index: idx,
        created_at: createdAt,
        background_image_id: slide.background_image_id || undefined,
        backgroundImage: slide.background_image_url || slide.background_image_ref || undefined,
        texts: (Array.isArray(slide.texts) ? slide.texts : (slide.texts ? [slide.texts] : [])).map((t: any, tIdx: number) => ({
          id: `${slideId}-text-${tIdx}`,
          slide_id: slideId,
          text: t.text,
          position_x: t.position_x,
          position_y: t.position_y,
          size: t.size,
          rotation: 0,
          font: '"proxima-nova", sans-serif',
          created_at: createdAt
        })),
        overlays: (Array.isArray(slide.overlays) ? slide.overlays : (slide.overlays ? [slide.overlays] : [])).map((o: any, oIdx: number) => ({
          id: `${slideId}-overlay-${oIdx}`,
          slide_id: slideId,
          image_id: o.image_id || '',
          position_x: o.position_x,
          position_y: o.position_y,
          rotation: o.rotation,
          size: o.size,
          created_at: createdAt,
          imageUrl: o.image_url || o.image_ref
        }))
      };
    });

    // Create a proper Slideshow object (same pattern as main editor)
    const newSlideshow: any = {
      id: `ai-slideshow-${Date.now()}`,
      user_id: '',
      name: data.caption || 'AI Generated Slideshow',
      status: 'draft',
      aspect_ratio: '9:16',
      created_at: createdAt,
      slides: newSlides
    };

    setLocalSlideshows([newSlideshow]);
    setSelectedSlideshowId(newSlideshow.id);
    if (newSlides.length > 0) {
      setSelectedSlideId(newSlides[0].id);
      centerSlide(newSlides[0].id, 100);
    }
    setSlideRenderKey(prev => prev + 1);
    setIsEditorCleared(false);
    ensureThumbnailsForSlides(newSlides.map(s => s.id));
  };

  const handleSlideSelect = (slideId: string, options?: { fastVertical?: boolean; fastHorizontal?: boolean }) => {
    console.log('[AIEditor] Selecting slide:', slideId, 'from current:', selectedSlideId);
    
    // Clear text selection when changing slides (same as main editor)
    updateSelectedTextObject(null);
    
    // Save current canvas state before disposing
    const currentCanvas = canvasRefs.current[selectedSlideId];
    if (currentCanvas && selectedSlideId) {
      console.log('[AIEditor] Saving canvas state for current slide:', selectedSlideId);
      try {
        const dataUrl = currentCanvas.toDataURL({ format: 'png' });
        setThumbnails(prev => ({ ...prev, [selectedSlideId]: dataUrl }));
      } catch {}
    }
    
    // Dispose other full canvases to keep one active at a time
    Object.keys(canvasRefs.current).forEach(id => {
      if (id !== slideId) disposeCanvas(id);
    });
    if (miniCanvasRefs.current[slideId]) disposeMiniCanvas(slideId);
    
    // Clear old thumbnail for selected slide to encourage fresh capture
    setThumbnails(prev => {
      const copy = { ...prev };
      delete copy[slideId];
      return copy;
    });
    
    setSelectedSlideId(slideId);
    centerSlide(slideId, 50, options);
    
    console.log('[AIEditor] Slide selection complete:', slideId);
  };

  // Create a new slideshow with 5 blank slides
  const handleAddRow = () => {
    // Reset generation state when creating new slideshow
    setGenerationCompleted(false);
    
    const createdAt = new Date().toISOString();
    const slideshowId = `blank-slideshow-${Date.now()}`;
    const newSlides: Slide[] = Array.from({ length: 5 }).map((_, idx) => ({
      id: `ai-slide-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      slideshow_id: slideshowId,
      duration_seconds: 3,
      index: idx,
      created_at: createdAt,
      texts: [],
      overlays: []
    }));

    const newSlideshow: any = {
      id: slideshowId,
      user_id: '',
      name: 'Blank Slideshow',
      status: 'draft',
      aspect_ratio: '9:16',
      created_at: createdAt,
      slides: newSlides
    };

    setLocalSlideshows([newSlideshow]);
    setSelectedSlideshowId(newSlideshow.id);
    setSelectedSlideId(newSlides[0].id);
    setSlideRenderKey(prev => prev + 1);
    setIsEditorCleared(false);
    ensureThumbnailsForSlides(newSlides.map(s => s.id));
    // Center after DOM updates
    setTimeout(() => centerSlide(newSlides[0].id, 100), 0);
  };



  return (
    <div className="flex h-screen bg-[var(--color-bg)] overflow-hidden flex-1">
      <AISidebar
        onAddRow={handleAddRow}
        onRunGenerate={({ productId, prompt }) => {
          try {
            setAiThoughts('');
            setIsGenerating(true);
            setGenerationCompleted(false); // Reset completion state when starting new generation
            let finalJson = '';
            
            const run = async () => {
              const res = await fetch('/api/slideshows/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, prompt, selectedImageIds, selectedCollectionIds, aspectRatio: selectedAspectRatio }),
              });
              if (!res.ok) {
                // Try to parse JSON error response
                try {
                  const errorData = await res.json();
                  if (errorData.error) {
                    alert(errorData.error);
                    setIsGenerating(false);
                    return;
                  }
                } catch {
                  // Fall back to generic error
                }
                setAiThoughts(prev => (prev ? prev + '\n' : '') + 'Server error starting generation.');
                setIsGenerating(false);
                setGenerationCompleted(true); // Hide AI thoughts on error
                return;
              }
              if (!res.body) {
                setAiThoughts(prev => (prev ? prev + '\n' : '') + 'Server error: No response body.');
                setIsGenerating(false);
                setGenerationCompleted(true); // Hide AI thoughts on error
                return;
              }
              const reader = res.body.getReader();
              const decoder = new TextDecoder();
              let buffer = '';
              while (true) {
                const { value, done } = await reader.read();
                if (done) {
                  // Generation is complete - auto-create slideshow from final JSON
                  setIsGenerating(false);
                  setGenerationCompleted(true); // Mark generation as completed to hide AI thoughts
                  if (finalJson) {
                    handleGenerateFromJson(finalJson);
                  }
                  break;
                }
                const chunkText = decoder.decode(value, { stream: true });
                buffer += chunkText;
                const parts = buffer.split('\n\n');
                buffer = parts.pop() || '';
                for (const part of parts) {
                  const lines = part.split('\n');
                  let eventType = '';
                  let data = '';
                  for (const line of lines) {
                    if (line.startsWith('event:')) eventType = line.slice(6).trim();
                    else if (line.startsWith('data:')) data += line.slice(5);
                  }
                  if (eventType === 'thought') {
                    setAiThoughts(prev => prev + data);
                  } else if (eventType === 'thoughtln') {
                    setAiThoughts(prev => (prev ? prev + '\n' : '') + data);
                  } else if (eventType === 'json') {
                    try {
                      const obj = JSON.parse(data);
                      finalJson = JSON.stringify(obj, null, 2);
                      setSlideshowJson(finalJson);
                    } catch {}
                  } else if (eventType === 'json.partial') {
                    try {
                      const partial = JSON.parse(data);
                      setSlideshowJson(JSON.stringify(partial, null, 2));
                    } catch {}
                  }
                }
              }
            };
            run().catch((e) => {
              setIsGenerating(false);
              setGenerationCompleted(true); // Hide AI thoughts on error
              setAiThoughts(prev => (prev ? prev + '\n' : '') + 'Client error: ' + (e as Error).message);
            });
          } catch (e) {
            setIsGenerating(false);
            setGenerationCompleted(true); // Hide AI thoughts on error
            setAiThoughts(prev => (prev ? prev + '\n' : '') + 'Client error: ' + (e as Error).message);
          }
        }}
        onSelectImages={() => setIsSelectCollectionsOpen(true)}
        aspectRatio={selectedAspectRatio}
        onAspectRatioChange={setSelectedAspectRatio}
      />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Floating Control Panel - positioned absolutely to not affect slide layout */}
        {!isEditorCleared && selectedSlideId && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsBackgroundModalOpen(true)} 
                  className="p-3 bg-gray-100 text-black rounded-xl hover:bg-gray-200 transition-colors" 
                  title="Background"
                >
                  <BackgroundIcon />
                </button>
                <button 
                  onClick={addTextElement} 
                  className="p-3 bg-gray-100 text-black rounded-xl hover:bg-gray-200 transition-colors" 
                  title="Add Text"
                >
                  <TextIcon />
                </button>
                <button 
                  onClick={() => setIsImageModalOpen(true)} 
                  className="p-3 bg-gray-100 text-black rounded-xl hover:bg-gray-200 transition-colors" 
                  title="Add Image"
                >
                  <ImageIcon />
                </button>
                <button 
                  onClick={handleDurationChange} 
                  className="px-4 py-2 bg-gray-100 text-black rounded-xl hover:bg-gray-200 transition-colors cursor-pointer" 
                  title="Slide Duration"
                >
                  {`${currentSlide?.duration_seconds || 3}s`}
                </button>
                <button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2" 
                  title="Save Slideshow"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <SaveIcon />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full h-full max-h-[900px] relative overflow-hidden border border-[var(--color-border)] rounded-xl">
            
            {/* AI Thoughts Floating Text Box - hidden when generation is completed */}
            {!generationCompleted && (
              <div className="absolute bottom-4 left-4 z-30 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-3 shadow-lg max-w-sm">
                <div className="text-xs font-medium text-[var(--color-text-muted)] mb-1">AI Thoughts</div>
                <div 
                  ref={aiThoughtsRef}
                  className="text-sm text-[var(--color-text)] font-mono whitespace-pre-wrap max-h-64 overflow-auto pr-1"
                >
                  {aiThoughts || 'Ready to generate slideshows...'}
                </div>
              </div>
            )}
            
            {/* Loading Overlay */}
            {isGenerating && (
              <div className="absolute inset-0 bg-gray-200 bg-opacity-50 flex items-center justify-center z-20">
                <div className="flex space-x-2">
                  <div className="w-3 h-3 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-3 h-3 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-3 h-3 bg-gray-600 rounded-full animate-bounce"></div>
                </div>
              </div>
            )}
            
            {/* Single seamless scrollable area handling both horizontal and vertical centering */}
            <div ref={verticalScrollRef} className="absolute inset-0 overflow-auto scrollbar-hide">
              {currentSlideshow && currentSlideshow.slides.length > 0 && !isEditorCleared ? (
                <div
                  className="min-h-full min-w-full flex flex-col gap-0 px-6"
                  style={{ paddingTop: verticalPad, paddingBottom: verticalPad }}
                >
                  <SlidesRow
                    key={`slideshow-${selectedSlideshowId}`}
                    absolute={false}
                    innerRef={(el) => {
                      scrollContainerRefs.current[0] = el;
                      }}
                      className="pb-0"
                    >
                      <SlidesLeftSpacer />
                      <SlidesList
                        slides={currentSlideshow.slides}
                        selectedSlideId={selectedSlideId}
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                        onSelect={(id) => handleSlideSelect(id)}
                        initialize={initializeCanvas}
                        initializeMini={initializeMiniCanvas}
                        canvasRefs={canvasRefs}
                        miniCanvasRefs={miniCanvasRefs}
                        initializingRefs={initializingCanvasesRef}
                        initializingMiniRefs={initializingMiniCanvasesRef}
                        slideRenderKey={slideRenderKey}
                        getThumbnailSrc={(id) => thumbnails[id]}
                        renderOverlays={(id) => (
                          <TextResizeOverlay
                            visible={Boolean(selectedTextObject) && !isTextDragging && selectedSlideId === id}
                            position={selectedTextObject?.position || null}
                            canvasWidth={CANVAS_WIDTH}
                            canvasHeight={CANVAS_HEIGHT}
                            onDecrease={() => adjustFontSize(-1)}
                            onIncrease={() => adjustFontSize(1)}
                          />
                        )}
                      />
                      <SlidesRightSpacer />
                    </SlidesRow>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center p-6">
                  <EmptyState />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <CollectionSelectionModal
        isOpen={isSelectCollectionsOpen}
        onClose={() => setIsSelectCollectionsOpen(false)}
        onSelect={(ids) => {
          setSelectedCollectionIds(ids)
          setIsSelectCollectionsOpen(false)
        }}
        title="Select Collections for AI Generation"
      />
      
      {/* Background Image Selection Modal */}
      <ImageSelectionModal
        isOpen={isBackgroundModalOpen}
        onClose={() => setIsBackgroundModalOpen(false)}
        onImageSelect={(imageUrl: string, imageId: string) => {
          handleBackgroundImageSelect(imageUrl, imageId);
          setIsBackgroundModalOpen(false);
        }}
        title="Select Background Image"
      />
      
      {/* Image Overlay Selection Modal */}
      <ImageSelectionModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onImageSelect={(imageUrl: string, imageId: string) => {
          handleImageOverlaySelect(imageUrl, imageId);
          setIsImageModalOpen(false);
        }}
        title="Select Image Overlay"
      />
    </div>
  );
}


