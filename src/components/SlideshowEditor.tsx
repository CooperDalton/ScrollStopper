'use client';

import React, { useState, useRef, useEffect } from 'react';
import { toast } from '@/lib/toast';
import AspectRatioPicker from '@/components/editor/AspectRatioPicker';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { fabric } from 'fabric';
import { animateScrollX, FAST_SCROLL_DURATION_X_MS } from '@/lib/scroll';
import EmptyState from '@/components/editor/EmptyState';
import ControlPanel from '@/components/editor/ControlPanel';
import SaveButtonOverlay from '@/components/editor/SaveButtonOverlay';
import DeleteButtonOverlay from '@/components/editor/DeleteButtonOverlay';
import TextResizeOverlay from '@/components/editor/TextResizeOverlay';
import SlidesRow, { SlidesLeftSpacer, SlidesRightSpacer } from '@/components/editor/SlidesRow';
import SlidesList from '@/components/editor/SlidesList';
import { scaleImageToFillCanvas, loadFabricImage } from '@/components/editor/fabricUtils';
import { FONT_SIZES, STROKE_WIDTHS, MAX_CHARS_PER_LINE, getStrokeWidthForFontSize, TEXT_STYLING, getTextStyling } from '@/lib/text-config';
import ImageSelectionModal from './ImageSelectionModal';
import SlideshowPreviewModal from './SlideshowPreviewModal';
import { useSlideshows } from '@/hooks/useSlideshows';
import { supabase } from '@/lib/supabase';
import { copyProductImageForOverlay, importPublicImageToUserImages } from '@/lib/images';
import type { Slideshow, Slide, SlideText, SlideOverlay } from '@/hooks/useSlideshows';

// Icons
const PlusIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const PlayIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10v4a1 1 0 001 1h4M9 10V9a1 1 0 011-1h4a1 1 0 011 1v1" />
  </svg>
);

  const SaveIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

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

export default function SlideshowEditor() {
  // Preload TikTok Sans so Fabric uses it immediately on canvas
  useEffect(() => {
    try {
      const anyDoc: any = document;
      if (anyDoc?.fonts?.load) {
        anyDoc.fonts.load('600 24px "TikTok Sans"');
        anyDoc.fonts.load('600 48px "TikTok Sans"');
      }
    } catch {}
  }, []);

  // When the font finishes loading, re-measure any existing Fabric text so it doesn't clip
  useEffect(() => {
    const anyDoc: any = document;
    const refreshTextObjects = () => {
      try {
        Object.values(canvasRefs.current).forEach((canvas) => {
          const objects = canvas.getObjects();
          objects.forEach((obj: any) => {
            if (obj && obj.isType && (obj as any).isType('i-text')) {
              obj.set({ objectCaching: false, noScaleCache: true });
              if (obj.initDimensions) obj.initDimensions();
              if (obj.setCoords) obj.setCoords();
            }
          });
          canvas.requestRenderAll();
        });
      } catch {}
    };

    try {
      if (anyDoc?.fonts?.ready) {
        anyDoc.fonts.ready.then(refreshTextObjects).catch(() => {});
      }
      if (anyDoc?.fonts) {
        anyDoc.fonts.addEventListener?.('loadingdone', refreshTextObjects);
      }
    } catch {}

    return () => {
      try {
        anyDoc?.fonts?.removeEventListener?.('loadingdone', refreshTextObjects);
      } catch {}
    };
  }, []);
  const {
    slideshows,
    loading,
    error,
    notice,
    createSlideshow,
    addSlide,
    deleteSlide,
    deleteSlideshow,
    saveSlideTexts,
    saveSlideOverlays,
    updateSlideBackground,
    updateSlideDuration,
    queueSlideshowRender,
    rerenderIds,
    clearRerenderIds,
    refetch
  } = useSlideshows();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedSlideshowId, setSelectedSlideshowId] = useState<string>('');
  const [selectedSlideId, setSelectedSlideId] = useState<string>('');
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const initialAspectRatioParam = searchParams.get('ar');
  const [newAspectRatio, setNewAspectRatio] = useState<string>(() => {
    const allowed = new Set(['9:16', '1:1', '4:5']);
    return initialAspectRatioParam && allowed.has(initialAspectRatioParam)
      ? initialAspectRatioParam
      : '9:16';
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [localSlideshows, setLocalSlideshows] = useState<Slideshow[]>([]);
  const [canvasReadyStates, setCanvasReadyStates] = useState<{[key: string]: boolean}>({});
  const [isDeletingSlide, setIsDeletingSlide] = useState(false);
  const [slideRenderKey, setSlideRenderKey] = useState(0);
  const [isEditorCleared, setIsEditorCleared] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('editorCleared') === 'true';
    }
    return false;
  });
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [sidebarMode, setSidebarMode] = useState<'create' | 'drafts'>(() => {
    const mode = searchParams.get('mode');
    return mode === 'drafts' ? 'drafts' : 'create';
  });
  const modeParam = searchParams.get('mode');
  const [renderProgress, setRenderProgress] = useState<{[key:string]: number}>({});
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSlideshowId, setPreviewSlideshowId] = useState<string | null>(null);
  const [isOpeningModal, setIsOpeningModal] = useState(false);
  const [deletingSlideshowId, setDeletingSlideshowId] = useState<string | null>(null);
  const [deletingDraftIds, setDeletingDraftIds] = useState<Set<string>>(new Set());

  const updateModeInUrl = (mode: 'create' | 'drafts') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('mode', mode);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleSidebarMode = (mode: 'create' | 'drafts') => {
    setSidebarMode(mode);
    updateModeInUrl(mode);
  };

  const updateAspectRatioInUrl = (ratio: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (ratio) {
      params.set('ar', ratio);
    } else {
      params.delete('ar');
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    if (modeParam === 'drafts' || modeParam === 'create') {
      setSidebarMode(prev => (prev !== modeParam ? (modeParam as 'drafts' | 'create') : prev));
    }
  }, [modeParam]);

  // Persist cleared state across reloads within the session
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (isEditorCleared) {
        sessionStorage.setItem('editorCleared', 'true');
      } else {
        sessionStorage.removeItem('editorCleared');
      }
    } catch {}
  }, [isEditorCleared]);

  const parseAspectRatio = (ratio: string) => {
    const [w, h] = ratio.split(':').map(Number);
    return w && h ? w / h : 9 / 16;
  };
  
  // Reusable function to get text styling properties


  // Track selected text object for resize controls
  const [selectedTextObject, setSelectedTextObject] = useState<{
    fabricObject: fabric.IText;
    textId: string;
    position: { x: number; y: number };
  } | null>(null);
  const selectedTextObjectRef = useRef<{
    fabricObject: fabric.IText;
    textId: string;
    position: { x: number; y: number };
  } | null>(null);

  const [isTextDragging, setIsTextDragging] = useState(false);

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
  
  // Track previous slide for auto-save functionality
  const [previousSlideId, setPreviousSlideId] = useState<string>('');
  const [previousSlideshowId, setPreviousSlideshowId] = useState<string>('');
  const previousSlideRef = useRef<Slide | null>(null);
  const canvasRefs = useRef<{[key: string]: fabric.Canvas}>({});
  const canvasElementRefs = useRef<{[key: string]: HTMLCanvasElement}>({});
  const miniCanvasRefs = useRef<{[key: string]: fabric.Canvas}>({});
  const miniCanvasElementRefs = useRef<{[key: string]: HTMLCanvasElement}>({});
  const initializingCanvasesRef = useRef<Set<string>>(new Set());
  const initializingMiniCanvasesRef = useRef<Set<string>>(new Set());

  // moved to editor/fabricUtils.ts for reuse

  // Helper function to snap rotation angles to 90-degree increments
  const snapAngle = (angle: number, threshold: number = 8) => {
    // Normalize angle to 0-360 range
    let normalizedAngle = ((angle % 360) + 360) % 360;

    // Define snap targets
    const snapTargets = [0, 90, 180, 270];

    // Check if angle is close to any snap target
    for (const target of snapTargets) {
      if (Math.abs(normalizedAngle - target) <= threshold) {
        return target;
      }
    }

    // Check for 360° wrapping (close to 0°)
    if (normalizedAngle > 360 - threshold) {
      return 0;
    }

    return angle; // Return original angle if no snapping needed
  };

  // Helper function to snap text position to center X-axis during dragging
  const snapToCenterX = (currentX: number, canvasWidth: number, threshold: number = 20) => {
    const centerX = canvasWidth / 2;
    const distanceFromCenter = Math.abs(currentX - centerX);

    // If within threshold, snap to center
    if (distanceFromCenter <= threshold) {
      return centerX;
    }

    return currentX; // Return original position if no snapping needed
  };

  // Reusable function to center a slide within the container
  const centerSlide = (slideId: string, delay: number = 0) => {
    setTimeout(() => {
      if (scrollContainerRef.current) {
        const slideElement = scrollContainerRef.current.querySelector(`[data-slide-id="${slideId}"]`) as HTMLElement;
        if (slideElement) {
          const container = scrollContainerRef.current;
          const containerWidth = container.clientWidth;
          const slideLeft = slideElement.offsetLeft;
          const slideWidth = slideElement.offsetWidth;
          
          // Calculate scroll position to center the slide within the fixed container
          const scrollLeft = slideLeft - (containerWidth / 2) + (slideWidth / 2);
          
          // Use global animated scroll with configurable duration
          animateScrollX(container, scrollLeft, FAST_SCROLL_DURATION_X_MS);
        }
      }
    }, delay);
  };

  // Use local slideshows if available, otherwise use the ones from the hook
  const displaySlideshows = localSlideshows.length > 0 ? localSlideshows : slideshows;
  const currentSlideshow = displaySlideshows.find((s: Slideshow) => s.id === selectedSlideshowId);
  const currentSlide = currentSlideshow?.slides.find((s: Slide) => s.id === selectedSlideId);

  const draftSlideshows = React.useMemo(() => {
    return displaySlideshows
      .filter(s => s.status === 'draft')
      .sort(
        (a, b) =>
          new Date(b.date_modified || b.created_at).getTime() -
          new Date(a.date_modified || a.created_at).getTime()
      );
  }, [displaySlideshows]);

  const draftGroups = React.useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dayOfWeek = now.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7; // days since Monday
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - diffToMonday);

    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfWeek.getDate() - 7);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const groups: { label: string; slides: Slideshow[] }[] = [
      { label: 'Today', slides: [] },
      { label: 'This Week', slides: [] },
      { label: 'Last Week', slides: [] },
      { label: 'This Month', slides: [] },
      { label: 'Older', slides: [] }
    ];

    draftSlideshows.forEach(slideshow => {
      const edited = new Date(slideshow.date_modified || slideshow.created_at);

      if (edited >= startOfToday) {
        groups[0].slides.push(slideshow);
      } else if (edited >= startOfWeek) {
        groups[1].slides.push(slideshow);
      } else if (edited >= startOfLastWeek) {
        groups[2].slides.push(slideshow);
      } else if (edited >= startOfMonth) {
        groups[3].slides.push(slideshow);
      } else {
        groups[4].slides.push(slideshow);
      }
    });

    return groups.filter(g => g.slides.length > 0);
  }, [draftSlideshows]);

  const completedSlideshows = React.useMemo(() => {
    return displaySlideshows.filter(s => s.status === 'completed');
  }, [displaySlideshows]);

  const SmallTrashIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );

  const handleDeleteDraft = async (
    e: React.MouseEvent,
    slideshowId: string
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const confirmed = window.confirm('Delete this draft? This cannot be undone.');
    if (!confirmed) return;
    setDeletingDraftIds(prev => new Set(prev).add(slideshowId));
    try {
      await deleteSlideshow(slideshowId);
      if (selectedSlideshowId === slideshowId) {
        setSelectedSlideshowId('');
        setSelectedSlideId('');
        setIsEditorCleared(true);
      }
    } catch (err) {
      console.error('Failed to delete draft slideshow:', err);
      toast.error('Failed to delete draft. Please try again.');
    } finally {
      setDeletingDraftIds(prev => {
        const copy = new Set(prev);
        copy.delete(slideshowId);
        return copy;
      });
    }
  };

  const aspectRatio = parseAspectRatio(currentSlideshow?.aspect_ratio || '9:16');
  const CANVAS_WIDTH = 300;
  const CANVAS_HEIGHT = Math.round(CANVAS_WIDTH / aspectRatio);
  const MINI_CANVAS_WIDTH = 200;
  const MINI_CANVAS_HEIGHT = Math.round(MINI_CANVAS_WIDTH / aspectRatio);

  // Helper function to update local slideshow state
  const updateLocalSlideshow = (slideshowId: string, slideId: string, updates: Partial<Slide>) => {
    const updatedSlideshows = displaySlideshows.map(slideshow => {
      if (slideshow.id === slideshowId) {
        return {
          ...slideshow,
          slides: slideshow.slides.map(slide => {
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
  };

  // Set default selected slideshow and slide when slideshows load
  useEffect(() => {
    if (displaySlideshows.length > 0 && !selectedSlideshowId && !isEditorCleared) {
      const firstSlideshow = displaySlideshows[0];
      setSelectedSlideshowId(firstSlideshow.id);
      if (firstSlideshow.slides.length > 0) {
        setSelectedSlideId(firstSlideshow.slides[0].id);
        
        // Center the first slide after a delay to ensure DOM is ready
        centerSlide(firstSlideshow.slides[0].id, 100);
      }
    }
  }, [displaySlideshows, selectedSlideshowId, isEditorCleared]);

  // When a slideshow becomes selected externally (e.g., from left panel), exit empty-state
  useEffect(() => {
    if (selectedSlideshowId && isEditorCleared) {
      setIsEditorCleared(false);
    }
  }, [selectedSlideshowId]);



  // Track current slide data for auto-save functionality
  useEffect(() => {
    if (currentSlide) {
      previousSlideRef.current = { ...currentSlide };
    }
  }, [currentSlide]);

  // Auto-save previous slide when switching slides
  useEffect(() => {
    const handleSlideChange = async () => {
      // Only trigger if we actually changed slides and have unsaved changes
      if (previousSlideId && previousSlideId !== selectedSlideId && hasUnsavedChanges && previousSlideRef.current) {
        try {
          await autoSaveSlide(previousSlideId, previousSlideRef.current);
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
      
      // Update tracking state
      setPreviousSlideId(selectedSlideId);
      setPreviousSlideshowId(selectedSlideshowId);
      
      // Reset unsaved changes for new slide
      setHasUnsavedChanges(false);
    };

    if (selectedSlideId) {
      if (!previousSlideId) {
        // Initial load - just set the tracking state
        setPreviousSlideId(selectedSlideId);
        setPreviousSlideshowId(selectedSlideshowId);
        setHasUnsavedChanges(false);
      } else if (previousSlideId !== selectedSlideId) {
        // Slide changed - trigger auto-save
        handleSlideChange();
      }
    }
  }, [selectedSlideId, selectedSlideshowId]);

  // Cleanup function for fabric canvases
  const disposeCanvas = (slideId: string, silent: boolean = false) => {
    // Don't dispose during slide deletion to avoid DOM conflicts
    if (isDeletingSlide) {
      delete canvasRefs.current[slideId];
      delete canvasElementRefs.current[slideId];
      return;
    }

    if (canvasRefs.current[slideId]) {
      try {
        const canvas = canvasRefs.current[slideId];
        
        
        // Check if canvas element is still in DOM before disposing
        const canvasElement = canvasElementRefs.current[slideId];
        if (canvasElement && canvasElement.parentNode && canvasElement.isConnected) {
          canvas.dispose();
        } else {
          // Canvas element already removed from DOM, just clear fabric objects
          try {
            canvas.clear();
          } catch (clearError) {
            // Even clearing might fail if canvas is in bad state
            console.warn('Canvas clear warning:', clearError);
          }
        }
      } catch (error) {
        // Ignore disposal errors - canvas might already be disposed
        console.warn('Canvas disposal warning:', error);
      }
      delete canvasRefs.current[slideId];
    }
    if (canvasElementRefs.current[slideId]) {
      delete canvasElementRefs.current[slideId];
    }
    // Clean up ready state without causing re-render loops when silent
    if (!silent) {
      setCanvasReadyStates(prev => {
        const newState = { ...prev };
        delete newState[slideId];
        return newState;
      });
    }
  };

  // Cleanup function for mini canvases
  const disposeMiniCanvas = (slideId: string) => {
    // Don't dispose during slide deletion to avoid DOM conflicts
    if (isDeletingSlide) {
      delete miniCanvasRefs.current[slideId];
      delete miniCanvasElementRefs.current[slideId];
      return;
    }

    if (miniCanvasRefs.current[slideId]) {
      try {
        const canvas = miniCanvasRefs.current[slideId];
        // Check if canvas element is still in DOM before disposing
        const canvasElement = miniCanvasElementRefs.current[slideId];
        if (canvasElement && canvasElement.parentNode && canvasElement.isConnected) {
          canvas.dispose();
        } else {
          // Canvas element already removed from DOM, just clear fabric objects
          try {
            canvas.clear();
          } catch (clearError) {
            // Even clearing might fail if canvas is in bad state
            console.warn('Mini canvas clear warning:', clearError);
          }
        }
      } catch (error) {
        // Ignore disposal errors - canvas might already be disposed
        console.warn('Mini canvas disposal warning:', error);
      }
      delete miniCanvasRefs.current[slideId];
    }
    if (miniCanvasElementRefs.current[slideId]) {
      delete miniCanvasElementRefs.current[slideId];
    }
  };

  // Mark canvas as ready after all content is loaded
  const markCanvasReady = (slideId: string) => {
    setCanvasReadyStates(prev => ({ ...prev, [slideId]: true }));
  };

  // Initialize mini canvas for unselected slides (read-only, optimized)
  const initializeMiniCanvas = (slideId: string, canvasElement: HTMLCanvasElement) => {
    // Check if canvas element is still in DOM and the slide still exists
    if (!canvasElement || !canvasElement.parentNode) {
      console.warn('Mini canvas element not in DOM, skipping initialization');
      return;
    }

    // Check if the slide still exists in our data (might have been deleted)
    const slideExists = currentSlideshow?.slides.some(slide => slide.id === slideId);
    if (!slideExists || isDeletingSlide) {
      console.warn('Slide no longer exists or deletion in progress, skipping mini canvas initialization');
      return;
    }

    // Dispose existing mini canvas if it exists
    disposeMiniCanvas(slideId);

    try {
      const canvas = new fabric.Canvas(canvasElement, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: '#ffffff'
      });

      // Optimize for read-only display
      canvas.selection = false;
      canvas.skipTargetFind = true;

      // Store references
      miniCanvasRefs.current[slideId] = canvas;
      miniCanvasElementRefs.current[slideId] = canvasElement;

      // Add background image if exists
      const slide = currentSlideshow?.slides.find((s: Slide) => s.id === slideId);
      if (slide?.backgroundImage) {
        fabric.Image.fromURL(
          slide.backgroundImage,
          (img: fabric.Image) => {
            try {
              // Ensure canvas is still active and usable
              if (miniCanvasRefs.current[slideId] !== canvas) return;
              if (!(canvas as any).contextContainer) return;
              img.set({ selectable: false, evented: false, isBackground: true });
              scaleImageToFillCanvas(img, CANVAS_WIDTH, CANVAS_HEIGHT);
              canvas.add(img);
              if ((canvas as any).contextContainer) {
                canvas.renderAll();
              }
            } catch (error) {
              console.warn('Failed to apply background image for mini canvas:', error);
            } finally {
              if (miniCanvasRefs.current[slideId] === canvas && (canvas as any).contextContainer) {
                restoreTextElementsMini(slideId, canvas);
                restoreImageOverlaysMini(slideId, canvas);
              }
            }
          },
          { crossOrigin: 'anonymous' }
        );
      } else {
        // No background image: set subtle gray only
        try {
          canvas.set('backgroundColor', '#f5f5f5');
        } catch {}

        // Then add any text and overlays on top
        if (miniCanvasRefs.current[slideId] === canvas && (canvas as any).contextContainer) {
          restoreTextElementsMini(slideId, canvas);
          restoreImageOverlaysMini(slideId, canvas);
        }
      }
    } catch (error) {
      console.error('Failed to initialize mini canvas:', error);
      // Clean up any partial initialization
      disposeMiniCanvas(slideId);
    }
  };



  // Cleanup all canvases on unmount
  useEffect(() => {
    return () => {
      Object.keys(canvasRefs.current).forEach(slideId => {
        disposeCanvas(slideId);
      });
      Object.keys(miniCanvasRefs.current).forEach(slideId => {
        disposeMiniCanvas(slideId);
      });
    };
  }, []);

  // Sync local slideshows with hook slideshows when they change
  // Prefer hook updates for status/frame_paths so My Videos updates without full refresh
  // Preserve local slides array to keep unsaved editor changes
  useEffect(() => {
    if (slideshows.length === 0) {
      if (localSlideshows.length > 0) setLocalSlideshows([]);
      return;
    }

    setLocalSlideshows(prev => {
      const localById = new Map(prev.map(s => [s.id, s] as const));
      return slideshows.map(hookS => {
        const local = localById.get(hookS.id);
        if (!local) return hookS;
        return {
          ...local,
          status: hookS.status,
          frame_paths: hookS.frame_paths,
          date_modified: hookS.date_modified,
          upload_status: hookS.upload_status,
          caption: hookS.caption,
          aspect_ratio: hookS.aspect_ratio,
          slides: local.slides && local.slides.length > 0 ? local.slides : hookS.slides
        } as Slideshow;
      });
    });
  }, [slideshows]);

  // Cleanup canvas references when slideshows change to prevent stale references
  useEffect(() => {
    const currentSlideIds = new Set(displaySlideshows.flatMap(s => s.slides.map(slide => slide.id)));
    const canvasSlideIds = Object.keys(canvasRefs.current);
    const miniCanvasSlideIds = Object.keys(miniCanvasRefs.current);
    
    // Only clean up references for slides that no longer exist
    // Let React handle the actual DOM cleanup to avoid conflicts
    canvasSlideIds.forEach(slideId => {
      if (!currentSlideIds.has(slideId)) {
        delete canvasRefs.current[slideId];
        delete canvasElementRefs.current[slideId];
      }
    });

    miniCanvasSlideIds.forEach(slideId => {
      if (!currentSlideIds.has(slideId)) {
        delete miniCanvasRefs.current[slideId];
        delete miniCanvasElementRefs.current[slideId];
      }
    });

    // Clean up ready states
    setCanvasReadyStates(prev => {
      const newState = { ...prev };
      Object.keys(newState).forEach(slideId => {
        if (!currentSlideIds.has(slideId)) {
          delete newState[slideId];
        }
      });
      return newState;
    });
  }, [displaySlideshows]);

  // Keyboard event listener for delete functionality
  useEffect(() => {
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

            // Remove from canvas
            canvas.remove(activeObject);
            canvas.renderAll();

            // Remove from slide data
            if (activeObject.get('textId')) {
              // It's a text object
              const textId = activeObject.get('textId');
              if (currentSlide?.texts) {
                currentSlide.texts = currentSlide.texts.filter(t => t.id !== textId);
                // Update local state to persist deletion when switching slides
                updateLocalSlideshow(selectedSlideshowId, selectedSlideId, {
                  texts: currentSlide.texts
                });
                // Mark as having unsaved changes
                setHasUnsavedChanges(true);
              }
            } else if (activeObject.get('overlayId')) {
              // It's an image overlay
              const overlayId = activeObject.get('overlayId');
              if (currentSlide?.overlays) {
                currentSlide.overlays = currentSlide.overlays.filter(o => o.id !== overlayId);
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
  }, [selectedSlideId, currentSlide]);

  // Initialize fabric canvas for a slide
  const initializeCanvas = (slideId: string, canvasElement: HTMLCanvasElement) => {
    // Check if canvas element is still in DOM and the slide still exists
    if (!canvasElement || !canvasElement.parentNode) {
      console.warn('Canvas element not in DOM, skipping initialization');
      return;
    }

    // Check if the slide still exists in our data (might have been deleted)
    const slideExists = currentSlideshow?.slides.some(slide => slide.id === slideId);
    if (!slideExists || isDeletingSlide) {
      console.warn('Slide no longer exists or deletion in progress, skipping canvas initialization');
      return;
    }

    // Dispose existing canvas if it exists without triggering state updates to avoid render loops
    if (canvasRefs.current[slideId]) {
      disposeCanvas(slideId, true);
    }

    try {
      const canvas = new fabric.Canvas(canvasElement, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: '#ffffff'
      });

      // Store references
      canvasRefs.current[slideId] = canvas;
      canvasElementRefs.current[slideId] = canvasElement;
      
      // Mark canvas as not ready initially AFTER refs are set to avoid ref re-init loops
      setCanvasReadyStates(prev => {
        if (prev[slideId] === false) return prev;
        return { ...prev, [slideId]: false };
      });
      
      // Add canvas selection event listeners with improved logic
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

      // More robust selection handling - using a longer delay to handle race conditions
      canvas.on('selection:cleared', () => {
        // Use a longer timeout to handle potential race conditions
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

      // Add background image if exists
      const slide = currentSlideshow?.slides.find((s: Slide) => s.id === slideId);
      if (slide?.backgroundImage) {
        fabric.Image.fromURL(
          slide.backgroundImage,
          (img: fabric.Image) => {
            try {
              // Ensure canvas is still active and usable
              if (canvasRefs.current[slideId] !== canvas) return;
              if (!(canvas as any).contextContainer) return;
              img.set({
                selectable: false,
                evented: false,
                isBackground: true
              });
              // Scale image to fill entire canvas background
              scaleImageToFillCanvas(img, CANVAS_WIDTH, CANVAS_HEIGHT);
              canvas.add(img);
              if ((canvas as any).contextContainer) {
                canvas.renderAll();
              }
            } catch (error) {
              console.warn('Failed to apply background image settings:', error);
            } finally {
              // After background is handled, restore text elements and overlays
              if (canvasRefs.current[slideId] === canvas && (canvas as any).contextContainer) {
                restoreTextElements(slideId, canvas);
                restoreImageOverlays(slideId, canvas);
              }
              // Mark canvas as ready after everything is handled
              if (canvasRefs.current[slideId] === canvas) {
                markCanvasReady(slideId);
              }
            }
          },
          { crossOrigin: 'anonymous' }
        );
      } else {
        // No background image: show subtle gray background only
        try {
          canvas.set('backgroundColor', '#f5f5f5');
        } catch {}

        // Then add any text and overlays on top
        if (canvasRefs.current[slideId] === canvas && (canvas as any).contextContainer) {
          restoreTextElements(slideId, canvas);
          restoreImageOverlays(slideId, canvas);
        }
        
        // Mark canvas as ready immediately since no async loading
        if (canvasRefs.current[slideId] === canvas) {
          markCanvasReady(slideId);
        }
      }
    } catch (error) {
      console.error('Failed to initialize canvas:', error);
      // Clean up any partial initialization
      disposeCanvas(slideId, true);
    }
  };

  const restoreTextElements = (slideId: string, canvas: fabric.Canvas) => {
    const slide = currentSlideshow?.slides.find((s: Slide) => s.id === slideId);
    if (!slide?.texts) return;

    // Ensure canvas is still the active one for this slide
    if (canvasRefs.current[slideId] !== canvas || !(canvas as any).contextContainer) {
      return;
    }
    slide.texts.forEach((textData: SlideText) => {
      const fabricText = new fabric.IText(textData.text, {
        left: textData.position_x,
        top: textData.position_y,
        angle: textData.rotation,
        scaleX: 1, // Reset scale to 1 since we're using effective fontSize
        scaleY: 1, // Reset scale to 1 since we're using effective fontSize
        lockUniScaling: true,
        ...getTextStyling(textData.size)
      });

      // Disable all resize controls for text - only allow rotation and movement
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

      // Store the text ID on the fabric object for later reference
      (fabricText as any).set('textId', textData.id);

      // Listen for text changes and update data
      fabricText.on('changed', () => updateTextData(textData.id, fabricText));
      fabricText.on('moving', () => updateTextData(textData.id, fabricText, true));
      fabricText.on('rotating', () => updateTextData(textData.id, fabricText));
      fabricText.on('scaling', () => updateTextData(textData.id, fabricText));
      
      // Note: Selection handling is now done at the canvas level

      canvas.add(fabricText);
    });

    if ((canvas as any).contextContainer) {
      canvas.renderAll();
    }
    
    // Ensure proper layering after restoring elements
    ensureProperLayering(canvas);
  };

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
      // Remove all objects and re-add in correct order
      objects.forEach((obj: any) => canvas.remove(obj));
      correctOrder.forEach((obj: any) => canvas.add(obj));
      canvas.renderAll();
    }
  };

  const restoreImageOverlays = async (slideId: string, canvas: fabric.Canvas) => {
    const slide = currentSlideshow?.slides.find((s: Slide) => s.id === slideId);
    if (!slide?.overlays) return;

    if (canvasRefs.current[slideId] !== canvas || !(canvas as any).contextContainer) {
      return;
    }
    for (const overlayData of slide.overlays) {
      if (!overlayData.imageUrl) continue;
      try {
        const img = await loadFabricImage(overlayData.imageUrl, { crossOrigin: 'anonymous' });
        img.set({
          left: overlayData.position_x,
          top: overlayData.position_y,
          angle: overlayData.rotation,
          scaleX: overlayData.size / 100,
          scaleY: overlayData.size / 100,
          originX: 'center',
          originY: 'center',
          lockUniScaling: true // Maintain aspect ratio
        });

        // Disable stretching controls for image overlays
        img.setControlsVisibility({
          ml: false, // middle left
          mb: false, // middle bottom  
          mr: false, // middle right
          mt: false, // middle top
        });

        // Store the overlay ID on the fabric object for later reference
        (img as any).set('overlayId', overlayData.id);

        // Listen for changes and update data
        img.on('moving', () => updateOverlayData(overlayData.id, img));
        img.on('rotating', () => updateOverlayData(overlayData.id, img));
        img.on('scaling', () => updateOverlayData(overlayData.id, img));

        if (canvasRefs.current[slideId] !== canvas || !(canvas as any).contextContainer) {
          continue;
        }
        canvas.add(img);
      } catch (error) {
        console.warn('Failed to restore image overlay:', overlayData.imageUrl, error);
      }
    }

    if ((canvas as any).contextContainer) {
      canvas.renderAll();
    }
    
    // Ensure proper layering after restoring overlays
    ensureProperLayering(canvas);
  };

  // Restore text elements for mini canvas (read-only, optimized)
  const restoreTextElementsMini = (slideId: string, canvas: fabric.Canvas) => {
    const slide = currentSlideshow?.slides.find((s: Slide) => s.id === slideId);
    if (!slide?.texts) return;

    if (miniCanvasRefs.current[slideId] !== canvas || !(canvas as any).contextContainer) {
      return;
    }
    slide.texts.forEach((textData: SlideText) => {
      const fabricText = new fabric.IText(textData.text, {
        left: textData.position_x,
        top: textData.position_y,
        angle: textData.rotation,
        scaleX: 1,
        scaleY: 1,
        lockUniScaling: true,
        selectable: false,
        evented: false,
        ...getTextStyling(textData.size)
      });

      canvas.add(fabricText);
    });

    if ((canvas as any).contextContainer) {
      canvas.renderAll();
    }
  };

  // Restore image overlays for mini canvas (read-only, optimized)
  const restoreImageOverlaysMini = async (slideId: string, canvas: fabric.Canvas) => {
    const slide = currentSlideshow?.slides.find((s: Slide) => s.id === slideId);
    if (!slide?.overlays) return;

    if (miniCanvasRefs.current[slideId] !== canvas || !(canvas as any).contextContainer) {
      return;
    }
    for (const overlayData of slide.overlays) {
      if (!overlayData.imageUrl) continue;
      try {
        const img = await loadFabricImage(overlayData.imageUrl, { crossOrigin: 'anonymous' });
        img.set({
          left: overlayData.position_x,
          top: overlayData.position_y,
          angle: overlayData.rotation,
          scaleX: overlayData.size / 100,
          scaleY: overlayData.size / 100,
          originX: 'center',
          originY: 'center',
          lockUniScaling: true,
          selectable: false,
          evented: false
        });
        if (miniCanvasRefs.current[slideId] !== canvas || !(canvas as any).contextContainer) {
          continue;
        }
        canvas.add(img);
      } catch (error) {
        console.warn('Failed to restore image overlay for mini canvas:', overlayData.imageUrl, error);
      }
    }

    if ((canvas as any).contextContainer) {
      canvas.renderAll();
    }
  };

  const handleSlideSelect = async (slideId: string) => {
    // Ensure editor leaves empty-state when a slide is selected
    if (isEditorCleared) setIsEditorCleared(false);
    // Auto-save current slide if it has unsaved changes before switching
    if (hasUnsavedChanges && selectedSlideId && currentSlide && selectedSlideId !== slideId) {
      try {
        await autoSaveSlide(selectedSlideId, currentSlide);
        // Clear unsaved changes after successful save
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Failed to auto-save before slide selection:', error);
      }
    }

    // Dispose canvases from other slides to prevent DOM conflicts
    Object.keys(canvasRefs.current).forEach(id => {
      if (id !== slideId) {
        disposeCanvas(id);
      }
    });

    // Dispose mini canvas for the selected slide (it will become a full canvas)
    if (miniCanvasRefs.current[slideId]) {
      disposeMiniCanvas(slideId);
    }

    // Only clear text selection when actually switching to a different slide
    if (selectedSlideId !== slideId) {
      // Clear text selection when changing slides
      updateSelectedTextObject(null);
    }
    
    setSelectedSlideId(slideId);
    
    // Manually center the slide within the fixed container
    centerSlide(slideId);
  };

  const handleAddSlide = async () => {
    if (!currentSlideshow) return;
    
    // Dispose all canvases before state change to prevent DOM conflicts
    Object.keys(canvasRefs.current).forEach(slideId => {
      disposeCanvas(slideId);
    });
    
    // Create a temporary slide locally first for instant UX
    const tempSlideId = `temp-${Date.now()}`;
    const nextIndex = Math.max(...currentSlideshow.slides.map(s => s.index || 0), -1) + 1;
    
    const tempSlide: Slide = {
      id: tempSlideId,
      slideshow_id: currentSlideshow.id,
      duration_seconds: 3,
      index: nextIndex,
      created_at: new Date().toISOString(),
      texts: [],
      overlays: []
    };
    
    // Add slide locally first
    const updatedSlideshow = {
      ...currentSlideshow,
      slides: [...currentSlideshow.slides, tempSlide]
    };
    
    // Update local state immediately
    const updatedSlideshows = displaySlideshows.map(s => 
      s.id === currentSlideshow.id ? updatedSlideshow : s
    );
    
    setLocalSlideshows(updatedSlideshows);
    
    // Select the new slide immediately
    setSelectedSlideId(tempSlideId);
    
    // Clear text selection when adding new slide
    updateSelectedTextObject(null);
    
    // Center the new slide
    centerSlide(tempSlideId, 50);
    
    // Now add to database in the background
    try {
      const newSlide = await addSlide(currentSlideshow.id);
      
      // Replace the temporary slide with the real one from database
      const finalSlideshow = {
        ...updatedSlideshow,
        slides: updatedSlideshow.slides.map(slide => 
          slide.id === tempSlideId ? { ...newSlide, texts: [], overlays: [] } : slide
        )
      };
      
      const finalSlideshows = displaySlideshows.map(s => 
        s.id === currentSlideshow.id ? finalSlideshow : s
      );
      
      // Update local state with the real slide
      setLocalSlideshows(finalSlideshows);
      setSelectedSlideId(newSlide.id);
      
    } catch (error) {
      console.error('Error adding slide to database:', error);
      // Remove the temporary slide if database operation failed
      const revertedSlideshow = {
        ...currentSlideshow,
        slides: currentSlideshow.slides.filter(slide => slide.id !== tempSlideId)
      };
      
      const revertedSlideshows = displaySlideshows.map(s => 
        s.id === currentSlideshow.id ? revertedSlideshow : s
      );
      
      setLocalSlideshows(revertedSlideshows);
      
      // Select the first available slide
      if (revertedSlideshow.slides.length > 0) {
        setSelectedSlideId(revertedSlideshow.slides[0].id);
      }
      
      toast.error('Failed to add slide. Please try again.');
    }
  };

  const handleDeleteSlide = async (slideId: string) => {
    if (!currentSlideshow) return;

    // Find the slide being deleted and determine which slide to select next
    const slideToDelete = currentSlideshow.slides.find(slide => slide.id === slideId);
    if (!slideToDelete) return;

    // Prevent deleting the last remaining slide
    if (currentSlideshow.slides.length === 1) {
      toast.error('Cannot delete the last slide in a slideshow');
      return;
    }

    // Set deletion flag to prevent canvas disposal conflicts
    setIsDeletingSlide(true);
    
    // Clear text selection when deleting slide
    updateSelectedTextObject(null);

    // Force React to completely remount all canvas elements by changing the key
    // This ensures clean slate and prevents any stale Fabric.js references
    setSlideRenderKey(prev => prev + 1);

    // Clear all canvas references immediately to prevent any operations on deleted slides
    Object.keys(canvasRefs.current).forEach(id => {
      delete canvasRefs.current[id];
      delete canvasElementRefs.current[id];
    });
    Object.keys(miniCanvasRefs.current).forEach(id => {
      delete miniCanvasRefs.current[id];
      delete miniCanvasElementRefs.current[id];
    });

    // Clear all ready states
    setCanvasReadyStates({});

    // Remove the slide from local state immediately for instant UX
    const updatedSlideshow = {
      ...currentSlideshow,
      slides: currentSlideshow.slides.filter(slide => slide.id !== slideId)
    };

    const updatedSlideshows = displaySlideshows.map(s => 
      s.id === currentSlideshow.id ? updatedSlideshow : s
    );

    setLocalSlideshows(updatedSlideshows);

    // Immediately select a different slide for better UX
    const remainingSlides = updatedSlideshow.slides;
    const deletedIndex = slideToDelete.index;
    const slideToSelect = remainingSlides.find(slide => slide.index === deletedIndex) ||
                         remainingSlides.find(slide => slide.index === deletedIndex - 1) ||
                         remainingSlides[0];
    
    if (slideToSelect) {
      setSelectedSlideId(slideToSelect.id);
      
      // Center the newly selected slide after deletion
      centerSlide(slideToSelect.id, 100); // Delay to allow for re-render after deletion
    }

    // Perform database operations in the background
    try {
      await deleteSlide(slideId);
    } catch (error) {
      console.error('Error deleting slide:', error);
      // Restore the slide if database operation failed
      setLocalSlideshows(displaySlideshows.map(s => 
        s.id === currentSlideshow.id ? currentSlideshow : s
      ));
      
      // Re-select the original slide
      setSelectedSlideId(slideId);
      
      toast.error('Failed to delete slide from database. The slide has been restored.');
    } finally {
      // Reset deletion flag after operation completes
      setIsDeletingSlide(false);
    }
  };

  const handleDurationClick = async () => {
    if (!currentSlide) return;

    // Cycle through durations 2, 3, 4, 5, 6, then back to 2
    const currentDuration = currentSlide.duration_seconds || 3;
    const nextDuration = currentDuration >= 6 ? 2 : currentDuration + 1;

    try {
      // Update local state immediately for instant UI feedback
      updateLocalSlideshow(selectedSlideshowId, selectedSlideId, {
        duration_seconds: nextDuration
      });

      await updateSlideDuration(currentSlide.id, nextDuration);
    } catch (error) {
      console.error('Error updating slide duration:', error);
      // Revert local state if database update failed
      updateLocalSlideshow(selectedSlideshowId, selectedSlideId, {
        duration_seconds: currentDuration
      });
      toast.error('Failed to update slide duration. Please try again.');
    }
  };

  const handleAddText = () => {
    const canvas = canvasRefs.current[selectedSlideId];
    if (!canvas || !currentSlide) return;

    const textId = `text-${Date.now()}`;
    const newText: SlideText = {
      id: textId,
      slide_id: selectedSlideId,
      text: 'text',
      position_x: CANVAS_WIDTH / 2,
      position_y: CANVAS_HEIGHT / 2,
      size: 24,
      rotation: 0,
      font: TEXT_STYLING.fontFamily,
      created_at: new Date().toISOString()
    };

    // Add to slide data
    if (!currentSlide.texts) {
      currentSlide.texts = [];
    }
    currentSlide.texts.push(newText);
    
    // Update local state to persist the new text when switching slides
    updateLocalSlideshow(selectedSlideshowId, selectedSlideId, {
      texts: currentSlide.texts
    });
    
    // Mark as having unsaved changes
    setHasUnsavedChanges(true);

    // Create fabric text object
      const fabricText = new fabric.IText(newText.text, {
      left: newText.position_x,
      top: newText.position_y,
      angle: newText.rotation,
      lockUniScaling: true,
      ...getTextStyling(newText.size)
    });
    // Avoid cache-canvas metric issues when font loads late
    (fabricText as any).set({ objectCaching: false, noScaleCache: true });

    // Disable all resize controls for text - only allow rotation and movement
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

    // Store the text ID on the fabric object for later reference
    (fabricText as any).set('textId', textId);

    // Listen for text changes and update data
    fabricText.on('changed', () => updateTextData(textId, fabricText));
    fabricText.on('moving', () => updateTextData(textId, fabricText, true));
    fabricText.on('rotating', () => updateTextData(textId, fabricText));
    fabricText.on('scaling', () => updateTextData(textId, fabricText));
    
    // Note: Selection handling is now done at the canvas level

    canvas.add(fabricText);
    canvas.setActiveObject(fabricText);
    canvas.renderAll();
    
    // Ensure text is on top layer
    ensureProperLayering(canvas);
  };

  const updateTextData = (textId: string, fabricText: fabric.IText, isMoving: boolean = false) => {
    if (!currentSlide?.texts) return;

    const textData = currentSlide.texts.find(t => t.id === textId);
    if (textData) {
      // Update the text data
      textData.text = fabricText.text || 'text';

      let finalX = fabricText.left || 0;

      // Apply X-axis snapping only during dragging/moving
      if (isMoving) {
        finalX = snapToCenterX(finalX, CANVAS_WIDTH);
        // Update fabric object position if snapped
        if (finalX !== (fabricText.left || 0)) {
          fabricText.set({ left: finalX });
        }
      }

      textData.position_x = finalX;
      textData.position_y = fabricText.top || 0;
      
      // For text, we need to account for both fontSize and scaling
      // When users resize by dragging corners, Fabric.js applies scaleX/scaleY
      const effectiveFontSize = (fabricText.fontSize || 24) * (fabricText.scaleX || 1);
      const previousSize = textData.size;
      textData.size = effectiveFontSize;
      
      // Apply angle snapping for 90-degree increments
      const originalAngle = fabricText.angle || 0;
      const snappedAngle = snapAngle(originalAngle);
      textData.rotation = snappedAngle;
      
      // Update fabric object if angle was snapped
      if (snappedAngle !== originalAngle) {
        fabricText.set('angle', snappedAngle);
      }
      
      // Only update stroke width/padding if the font size actually changed
      if (previousSize !== textData.size) {
        const newStrokeWidth = getStrokeWidthForFontSize(effectiveFontSize);
        fabricText.set('strokeWidth', newStrokeWidth);
        // Increase padding to make selection box include stroke
        const newPadding = Math.ceil(Math.max(6, newStrokeWidth * 2));
        fabricText.set('padding', newPadding as any);

        if (fabricText._clearCache) {
          fabricText._clearCache();
        }
        fabricText.dirty = true;

        const canvas = canvasRefs.current[selectedSlideId];
        if (canvas) {
          canvas.renderAll();
        }
      }
      
      // Update local state to persist changes when switching slides
      updateLocalSlideshow(selectedSlideshowId, selectedSlideId, {
        texts: currentSlide.texts
      });
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);

      if (selectedTextObjectRef.current && selectedTextObjectRef.current.textId === textId) {
        updateSelectedTextObject({ fabricObject: fabricText, textId });
      }
    }
  };

  const updateOverlayData = (overlayId: string, fabricImage: fabric.Image) => {
    if (!currentSlide?.overlays) return;

    const overlayData = currentSlide.overlays.find(o => o.id === overlayId);
    if (overlayData) {
      overlayData.position_x = fabricImage.left || 0;
      overlayData.position_y = fabricImage.top || 0;
      
      // Apply angle snapping for 90-degree increments
      const originalAngle = fabricImage.angle || 0;
      const snappedAngle = snapAngle(originalAngle);
      overlayData.rotation = snappedAngle;
      
      // Update fabric object if angle was snapped
      if (snappedAngle !== originalAngle) {
        fabricImage.set('angle', snappedAngle);
      }
      
      overlayData.size = ((fabricImage as any).scaleX || 1) * 100;
      
      // Update local state to persist changes when switching slides
      updateLocalSlideshow(selectedSlideshowId, selectedSlideId, {
        overlays: currentSlide.overlays
      });
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
    }
  };

  const handleBackgroundImageSelect = async (imageUrl: string, imageId: string) => {
    if (!currentSlide) return;

    try {
      const isPublic = imageUrl.includes('/public-images/');

      // 1) Optimistic UI: show immediately
      updateLocalSlideshow(selectedSlideshowId, selectedSlideId, {
        background_image_id: imageId,
        backgroundImage: imageUrl
      });

      // Update canvas background (optimistic)
      const canvas = canvasRefs.current[selectedSlideId];
      if (canvas) {
        // Clear existing background images
        const objects: any[] = canvas.getObjects() as any;
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
          
          // Ensure proper layering after adding background
          ensureProperLayering(canvas);
          canvas.renderAll();
        }).catch((error: unknown) => {
          console.warn('Failed to load selected background image:', imageUrl, error);
        });
      }

      // 2) If public, import and persist in the background; otherwise persist now
      if (isPublic) {
        const idx = imageUrl.indexOf('/public-images/');
        const storagePath = idx >= 0 ? decodeURIComponent(imageUrl.substring(idx + '/public-images/'.length)) : '';
        if (storagePath) {
          (async () => {
            const { image, imageUrl: userUrl, error } = await importPublicImageToUserImages(storagePath, { publicImageId: imageId });
            if (error || !image) {
              console.error('[Background Import] Failed to import public image:', error);
              return;
            }
            try {
              await updateSlideBackground(selectedSlideId, image.id);
              updateLocalSlideshow(selectedSlideshowId, selectedSlideId, {
                background_image_id: image.id,
                backgroundImage: userUrl || imageUrl
              });
            } catch (e) {
              console.error('[Background Import] Failed to persist imported background:', e);
            }
          })();
        }
      } else {
        await updateSlideBackground(selectedSlideId, imageId);
      }

    } catch (error) {
      console.error('Failed to update background image:', error);
      // Revert local state if database update failed
      updateLocalSlideshow(selectedSlideshowId, selectedSlideId, {
        background_image_id: currentSlide.background_image_id,
        backgroundImage: currentSlide.backgroundImage
      });
      toast.error('Failed to update background image. Please try again.');
    }
  };

  const handleImageOverlaySelect = async (imageUrl: string, imageId: string, isProductImage: boolean = false) => {
    if (!currentSlide) return;

    let finalImageId = imageId;

    // Optimistic path for public images: add immediately, import in background
    const isPublic = imageUrl.includes('/public-images/');
    if (!isPublic && isProductImage) {
      // Otherwise, if this is a product image, copy it to the images table first
      const { image, error } = await copyProductImageForOverlay(imageId);
      if (error) {
        console.error('[SlideshowEditor] Failed to copy product image:', error);
        toast.error('Failed to add product image as overlay. Please try again.');
        return;
      }
      if (image) {
        finalImageId = image.id;
      }
    }

    const overlayId = `overlay-${Date.now()}`;

    // Add to canvas first to get image dimensions
    const canvas = canvasRefs.current[selectedSlideId];
    if (canvas) {
        loadFabricImage(imageUrl, { crossOrigin: 'anonymous' }).then((img: fabric.Image) => {
        // Calculate smart sizing based on image dimensions
        const canvasWidth = CANVAS_WIDTH;
        const canvasHeight = CANVAS_HEIGHT;
        const targetWidth = canvasWidth * 0.5; // Half the canvas width
        const targetHeight = canvasHeight * 0.5; // Half the canvas height
        
        const imageWidth = img.width || 100;
        const imageHeight = img.height || 100;
        
        // Calculate scale factors for both dimensions
        const scaleX = targetWidth / imageWidth;
        const scaleY = targetHeight / imageHeight;
        
        // Use the smaller scale factor to ensure image fits within target area
        const optimalScale = Math.min(scaleX, scaleY);
        const optimalScalePercent = Math.round(optimalScale * 100);

        // Create overlay data with calculated size
        const newOverlay: SlideOverlay = {
          id: overlayId,
          slide_id: selectedSlideId,
          image_id: finalImageId, // Use the copied image ID for product images
          position_x: CANVAS_WIDTH / 2,
          position_y: CANVAS_HEIGHT / 2,
          rotation: 0,
          size: optimalScalePercent,
          created_at: new Date().toISOString(),
          imageUrl: imageUrl
        };

        // Add to slide data
        if (!currentSlide.overlays) {
          currentSlide.overlays = [];
        }
        currentSlide.overlays.push(newOverlay);
        
        // Update local state to persist the new overlay when switching slides
        updateLocalSlideshow(selectedSlideshowId, selectedSlideId, {
          overlays: currentSlide.overlays
        });
        
        // Mark as having unsaved changes
        setHasUnsavedChanges(true);

        // If this was a public image, import in the background and swap the overlay image_id
        if (isPublic) {
          (async () => {
            const idx2 = imageUrl.indexOf('/public-images/');
            const storagePath2 = idx2 >= 0 ? decodeURIComponent(imageUrl.substring(idx2 + '/public-images/'.length)) : '';
            if (!storagePath2) return;
            const { image, error } = await importPublicImageToUserImages(storagePath2, { publicImageId: imageId });
            if (error || !image) {
              console.error('[Overlay Import] Failed to import public image:', error);
              return;
            }
            // Update the overlay's image_id locally to the imported image id
            const updated = (currentSlide.overlays || []).map(o => o.id === overlayId ? { ...o, image_id: image.id } : o);
            updateLocalSlideshow(selectedSlideshowId, selectedSlideId, { overlays: updated });
          })();
        }

        img.set({
          left: newOverlay.position_x,
          top: newOverlay.position_y,
          angle: newOverlay.rotation,
          scaleX: optimalScale,
          scaleY: optimalScale,
          originX: 'center',
          originY: 'center',
          lockUniScaling: true // Maintain aspect ratio
        });

        // Disable stretching controls for image overlays
        img.setControlsVisibility({
          ml: false, // middle left
          mb: false, // middle bottom  
          mr: false, // middle right
          mt: false, // middle top
        });

        // Store the overlay ID on the fabric object for later reference
        (img as any).set('overlayId', overlayId);

        // Listen for changes and update data
        img.on('moving', () => updateOverlayData(overlayId, img));
        img.on('rotating', () => updateOverlayData(overlayId, img));
        img.on('scaling', () => updateOverlayData(overlayId, img));

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        
        // Ensure proper layering with image overlays below text
        ensureProperLayering(canvas);
      }).catch((error: unknown) => {
        console.warn('Failed to load image overlay:', imageUrl, error);
      });
    }
  };

  // Auto-save function that can save any slide's data
  const autoSaveSlide = async (slideId: string, slideData: Slide, silent: boolean = true) => {
    if (!slideId || !slideData) {
      return;
    }

    try {
      if (!silent) setIsSaving(true);
      
      // Save both text and overlay data to Supabase
      await Promise.all([
        saveSlideTexts(slideId, slideData.texts || []),
        saveSlideOverlays(slideId, slideData.overlays || [])
      ]);
      
    } catch (error) {
      console.error('Failed to auto-save slide:', slideId, error);
      // Don't show alert for auto-save failures to avoid interrupting user flow
      throw error; // Re-throw so calling code can handle it
    } finally {
      if (!silent) setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!currentSlide || !selectedSlideId) return;

    try {
      setIsSaving(true);
      
      // Use the auto-save function but with visual feedback
      await autoSaveSlide(selectedSlideId, currentSlide, false);
      
      // Mark as saved
      setHasUnsavedChanges(false);
      
    } catch (error) {
      console.error('Failed to save slide:', error);
      toast.error('Failed to save slide. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSlideshow = async () => {
    try {
      setIsCreating(true);
      const newSlideshow = await createSlideshow(undefined, undefined, newAspectRatio);

      // Select the newly created slideshow and its first slide
      setSelectedSlideshowId(newSlideshow.id);
      if (newSlideshow.slides.length > 0) {
        setSelectedSlideId(newSlideshow.slides[0].id);
        // Center the first slide after a delay to ensure DOM is ready
        centerSlide(newSlideshow.slides[0].id, 100);
      }
      // Leave empty-state after creating/selecting a new slideshow
      setIsEditorCleared(false);

      // Switch to drafts tab after creating new slideshow
      handleSidebarMode('drafts');
    } catch (err) {
      console.error('Failed to create slideshow:', err);
      toast.error('Failed to create slideshow. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const createGetSlideCanvas = (
    slideshow: Slideshow,
    targetWidth = CANVAS_WIDTH
  ) => async (slideId: string) => {
    if (targetWidth === CANVAS_WIDTH && canvasRefs.current[slideId]) {
      return canvasRefs.current[slideId];
    }

    const aspect = parseAspectRatio(slideshow.aspect_ratio);
    const scaleFactor = targetWidth / CANVAS_WIDTH;
    const targetHeight = Math.round(targetWidth / aspect);

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;

    try {
      const canvas = new fabric.Canvas(tempCanvas, {
        width: targetWidth,
        height: targetHeight,
        backgroundColor: '#ffffff'
      });

      const slide = slideshow.slides.find(s => s.id === slideId);
      if (!slide) {
        console.warn(`Slide ${slideId} not found in slideshow ${slideshow.id}`);
        return undefined;
      }

      // Add background image first (bottom layer)
      if (slide.backgroundImage) {
        const img = await loadFabricImage(slide.backgroundImage, {
          crossOrigin: 'anonymous'
        });
        img.set({
          selectable: false,
          evented: false,
          isBackground: true  // Mark as background for layering
        });
        scaleImageToFillCanvas(img, targetWidth, targetHeight);
        canvas.add(img);
        canvas.sendToBack(img);  // Explicitly send to back
      }

      // Add overlay images second (middle layer)
      if (slide.overlays && slide.overlays.length > 0) {
        for (const overlayData of slide.overlays) {
          if (overlayData.imageUrl) {
            const img = await loadFabricImage(overlayData.imageUrl, {
              crossOrigin: 'anonymous'
            });
            img.set({
              left: overlayData.position_x * scaleFactor,
              top: overlayData.position_y * scaleFactor,
              scaleX: (overlayData.size / 100) * scaleFactor,
              scaleY: (overlayData.size / 100) * scaleFactor,
              angle: overlayData.rotation,
              selectable: false,
              evented: false,
              originX: 'center',
              originY: 'center',
              overlayId: overlayData.id || overlayData.image_id || 'overlay-unknown',  // Mark as overlay for layering
              isOverlay: true  // Additional marker
            });
            canvas.add(img);
          }
        }
      }

      // Add text elements last (top layer) - text should ALWAYS be in front
      if (slide.texts && slide.texts.length > 0) {
        for (const textData of slide.texts) {
          const fabricText = new fabric.IText(textData.text, {
            ...getTextStyling(textData.size * scaleFactor),
            left: textData.position_x * scaleFactor,
            top: textData.position_y * scaleFactor,
            angle: textData.rotation,
            textId: textData.id,  // Mark as text for layering
            selectable: false,
            evented: false
          });
          canvas.add(fabricText);
          canvas.bringToFront(fabricText);  // Explicitly bring text to front
        }
      }

      // CRITICAL: Final layering pass - ensure proper order for rendering
      // This is the last chance to fix layering before canvas.toDataURL()
      const objects = canvas.getObjects()

      const backgroundObjects = objects.filter((obj: any) => obj.get('isBackground'))
      const overlayObjects = objects.filter((obj: any) => obj.get('isOverlay') || obj.get('overlayId'))
      const textObjects = objects.filter((obj: any) => obj.get('textId'))

      // FORCE correct layering order by removing all and re-adding in correct sequence
      // Store background color before clearing
      const bgColor = canvas.backgroundColor
      canvas.clear()
      canvas.backgroundColor = bgColor

      // Re-add in correct order: background -> overlays -> text
      backgroundObjects.forEach((obj: any) => canvas.add(obj))
      overlayObjects.forEach((obj: any) => canvas.add(obj))
      textObjects.forEach((obj: any) => canvas.add(obj))

      canvas.renderAll();
      return canvas;
    } catch (error) {
      console.error(`Failed to create temporary canvas for slide ${slideId}:`, error);
      return undefined;
    }
  };

  const rerendered = useRef<Set<string>>(new Set());
  
  // Auto-close modal if the slideshow being previewed gets deleted
  useEffect(() => {
    if (isPreviewOpen && previewSlideshowId && deletingSlideshowId === previewSlideshowId) {
      setIsPreviewOpen(false);
      setPreviewSlideshowId(null);
      setPreviewImages([]);
      setIsOpeningModal(false);
      setDeletingSlideshowId(null);
    }
  }, [deletingSlideshowId, isPreviewOpen, previewSlideshowId]);
  
  useEffect(() => {
    if (rerenderIds.length === 0) return;
    rerenderIds.forEach(id => {
      if (rerendered.current.has(id)) return;
      const slideshow = slideshows.find(s => s.id === id);
      if (!slideshow) return;
      rerendered.current.add(id);
      const run = async () => {
        setRenderProgress(prev => ({ ...prev, [id]: 0 }));
        try {
          const getSlideCanvas = createGetSlideCanvas(slideshow, 1080);
          await queueSlideshowRender(
            id,
            getSlideCanvas,
            completed =>
              setRenderProgress(prev => ({ ...prev, [id]: completed }))
          );
        } catch (err) {
          console.error('Failed to re-render slideshow:', err);
        } finally {
          setRenderProgress(prev => {
            const updated = { ...prev };
            delete updated[id];
            return updated;
          });
        }
      };
      run();
    });
    clearRerenderIds();
  }, [rerenderIds, slideshows]);

  const handleRender = async () => {
    const billing = await fetch('/api/billing/status').then((r) => r.json());
    if (!billing.isSubscribed) {
      toast.error('A paid subscription is required to render videos.');
      return;
    }
    if (billing.remainingSlides <= 0) {
      toast.error('You have reached your slideshow limit for this month.');
      return;
    }
    if (!currentSlideshow) return;
    const slideshowToRender = currentSlideshow; // snapshot to avoid selection changes affecting render
    setRenderProgress(prev => ({ ...prev, [slideshowToRender.id]: 0 }));

    // Switch to create tab so user can see rendering progress
    handleSidebarMode('create');

    // Clear the editor to prevent editing the slideshow being rendered
    setSelectedSlideshowId('');
    setSelectedSlideId('');
    updateSelectedTextObject(null);
    setIsEditorCleared(true);
    // Dispose any active canvases to free resources
    Object.keys(canvasRefs.current).forEach(id => disposeCanvas(id));
    Object.keys(miniCanvasRefs.current).forEach(id => disposeMiniCanvas(id));

    try {
      const getSlideCanvasForRender = createGetSlideCanvas(slideshowToRender, 1080);

      await queueSlideshowRender(
        slideshowToRender.id,
        getSlideCanvasForRender,
        completed =>
          setRenderProgress(prev => ({ ...prev, [slideshowToRender.id]: completed }))
      );

      // Refresh the slideshows data to show the newly rendered video
      await refetch();

      // Clear localSlideshows to force using the fresh data from the refetch
      setLocalSlideshows([]);
      // Keep editor in cleared state after render completes
      setIsEditorCleared(true);
    } catch (err) {
      console.error('Failed to render slideshow:', err);
    } finally {
      setRenderProgress(prev => {
        const updated = { ...prev };
        delete updated[slideshowToRender.id];
        return updated;
      });
    }
  };

  return (
    <div className="flex h-screen bg-[var(--color-bg)] overflow-hidden">
      {/* Left Sidebar - Slideshows */}
      <div className="w-80 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col flex-shrink-0">
        {/* My Slideshows Header */}
        <div className="p-6 border-b border-[var(--color-border)]">
          <h2 className="text-xl font-bold text-[var(--color-text)]">My Slideshows</h2>
        </div>

        {/* Mode Toggle */}
        <div className="p-4 border-b border-[var(--color-border)] flex gap-2">
          <button
            onClick={() => handleSidebarMode('create')}
            className={`flex-1 p-2 rounded-lg text-sm font-medium transition-colors ${
              sidebarMode === 'create'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            Create
          </button>
          <button
            onClick={() => handleSidebarMode('drafts')}
            className={`flex-1 p-2 rounded-lg text-sm font-medium transition-colors ${
              sidebarMode === 'drafts'
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]'
            }`}
          >
            Drafts
          </button>
        </div>

        {/* Create Slideshow Button */}
        {sidebarMode === 'create' && (
          <div className="p-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateSlideshow}
                disabled={isCreating}
                className="flex-1 flex items-center justify-center gap-2 p-3 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusIcon />
                {isCreating ? 'Creating...' : 'New Slideshow'}
              </button>
              <AspectRatioPicker
                value={newAspectRatio}
                onChange={(val) => { setNewAspectRatio(val); updateAspectRatioInUrl(val); }}
              />
            </div>
          </div>
        )}

        {sidebarMode === 'create' && (
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-lg font-semibold text-[var(--color-text)] mb-3">My Videos</h3>
            {completedSlideshows.length === 0 && Object.keys(renderProgress).length === 0 ? (
              <div className="text-center text-[var(--color-text-muted)]">No videos yet.</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(renderProgress).map(([id, count]) => {
                  const total = displaySlideshows.find(s => s.id === id)?.slides.length || 0;
                  return (
                    <div key={id} className="w-full aspect-square bg-gray-200 rounded-xl flex items-center justify-center text-sm text-gray-600 border border-[var(--color-border)]">
                      {count}/{total}
                    </div>
                  );
                })}
                {completedSlideshows.map(slideshow => {
                  const bucket = 'rendered-slides';
                  const first = slideshow.frame_paths?.[0]
                    ? `/api/storage/${bucket}?path=${encodeURIComponent(slideshow.frame_paths[0] || '')}`
                    : null;
                  return (
                    <button
                      key={slideshow.id}
                      onClick={() => {
                        // Prevent rapid clicking
                        if (isOpeningModal) return;
                        
                        // Check if slideshow still exists in current state before opening modal
                        const currentSlideshow = displaySlideshows.find(s => s.id === slideshow.id);
                        if (!currentSlideshow) {
                          console.warn('Slideshow no longer exists, skipping modal open');
                          return;
                        }
                        
                        // Don't open modal if we're currently deleting a slideshow
                        if (deletingSlideshowId) {
                          return;
                        }
                        
                        setIsOpeningModal(true);
                        
                        const urls = (currentSlideshow.frame_paths || []).map(p =>
                          `/api/storage/${bucket}?path=${encodeURIComponent(p)}`
                        );
                        setPreviewImages(urls);
                        setPreviewSlideshowId(currentSlideshow.id);
                        setIsPreviewOpen(true);
                        
                        // Reset the flag after a short delay
                        setTimeout(() => setIsOpeningModal(false), 300);
                      }}
                    >
                      {first ? (
                        <img src={first} className="w-full aspect-square object-cover rounded-xl border border-[var(--color-border)]" />
                      ) : (
                        <div className="w-full aspect-square bg-gray-200 rounded-xl" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Slideshows List */}
        {sidebarMode === 'drafts' && (
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center text-[var(--color-text-muted)] py-8">
                Loading slideshows...
              </div>
            ) : error ? (
              <div className="text-center text-red-500 py-8">
                Error: {error}
              </div>
            ) : (
              <>
                {notice && (
                  <div className="text-center text-amber-500 py-2">{notice}</div>
                )}
                {draftSlideshows.length === 0 ? (
                  <div className="text-center text-[var(--color-text-muted)] py-8">
                    No drafts yet.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {draftGroups.map(({ label, slides }, index) => (
                      <div key={label} className="space-y-3">
                        {index > 0 && <hr className="border-[var(--color-border)]" />}
                        <p className="text-sm font-semibold text-[var(--color-text)]">{label}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {slides.map((slideshow: Slideshow) => (
                            <div
                              key={slideshow.id}
                              role="button"
                              tabIndex={0}
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  // Auto-save current slide if it has unsaved changes before switching slideshows
                                  if (hasUnsavedChanges && selectedSlideId && currentSlide) {
                                    try {
                                      await autoSaveSlide(selectedSlideId, currentSlide);
                                    } catch {}
                                  }
                                  setSelectedSlideshowId(slideshow.id);
                                  setSelectedSlideId(slideshow.slides[0]?.id || '');
                                  if (slideshow.slides.length > 0) {
                                    centerSlide(slideshow.slides[0].id, 100);
                                  }
                                }
                              }}
                              onClick={async () => {
                                // Auto-save current slide if it has unsaved changes before switching slideshows
                                if (hasUnsavedChanges && selectedSlideId && currentSlide) {
                                  try {
                                    await autoSaveSlide(selectedSlideId, currentSlide);
                                  } catch (err) {
                                    console.error('Failed to auto-save before switching slideshows:', err);
                                    // Continue navigation even if auto-save fails to avoid trapping the user
                                  }
                                }

                                setSelectedSlideshowId(slideshow.id);
                                setSelectedSlideId(slideshow.slides[0]?.id || '');

                                // Center the first slide of the selected slideshow after a delay
                                if (slideshow.slides.length > 0) {
                                  centerSlide(slideshow.slides[0].id, 100);
                                }
                              }}
                              className="text-left cursor-pointer"
                            >
                              <div className="relative group">
                                {slideshow.slides[0]?.backgroundImage ? (
                                  <img
                                    src={slideshow.slides[0].backgroundImage}
                                    alt="Draft thumbnail"
                                    className="w-full h-24 object-cover rounded-xl border border-[var(--color-border)]"
                                  />
                                ) : (
                                  <div className="w-full h-24 flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] text-xs">
                                    No Image
                                  </div>
                                )}

                                {/* Delete draft button (hover) */}
                                <button
                                  onClick={(e) => handleDeleteDraft(e, slideshow.id)}
                                  disabled={deletingDraftIds.has(slideshow.id)}
                                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                                  title="Delete draft"
                                >
                                  {deletingDraftIds.has(slideshow.id) ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <SmallTrashIcon />
                                  )}
                                </button>

                                {/* Deleting overlay */}
                                {deletingDraftIds.has(slideshow.id) && (
                                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-xl">
                                    <div className="text-white text-sm font-medium">Deleting...</div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Center Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Canvas and Slides Area - Dynamic width container */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full h-full max-h-[900px] relative overflow-hidden border border-[var(--color-border)] rounded-xl">
            
            
            {/* Horizontal Slides Row - Container with fixed width */}
            <SlidesRow innerRef={scrollContainerRef}>
              {currentSlideshow && !isEditorCleared ? (
                <>
                  <SlidesLeftSpacer />
                  <SlidesList
                    slides={currentSlideshow.slides}
                    selectedSlideId={selectedSlideId}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    onSelect={async (id) => await handleSlideSelect(id)}
                    initialize={initializeCanvas}
                    initializeMini={initializeMiniCanvas}
                    canvasRefs={canvasRefs}
                    miniCanvasRefs={miniCanvasRefs}
                    initializingRefs={initializingCanvasesRef}
                    initializingMiniRefs={initializingMiniCanvasesRef}
                    slideRenderKey={slideRenderKey}
                    renderOverlays={(id) => (
                      <>
                        <SaveButtonOverlay
                          show={selectedSlideId === id && hasUnsavedChanges}
                          onSave={handleSave}
                          isSaving={isSaving}
                        />
                        <DeleteButtonOverlay
                          show={selectedSlideId === id}
                          onDelete={() => handleDeleteSlide(id)}
                        />
                        <TextResizeOverlay
                          visible={Boolean(selectedTextObject) && !isTextDragging && selectedSlideId === id}
                          position={selectedTextObject?.position || null}
                          canvasWidth={CANVAS_WIDTH}
                          canvasHeight={CANVAS_HEIGHT}
                          onDecrease={() => adjustFontSize(-1)}
                          onIncrease={() => adjustFontSize(1)}
                        />
                      </>
                    )}
                  />
                  <div className="flex-shrink-0 flex items-center justify-center">
                    <button
                      onClick={handleAddSlide}
                      className="bg-[var(--color-bg-secondary)] border-4 border-dashed border-[var(--color-border)] rounded-2xl flex items-center justify-center hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)] transition-all group"
                      style={{ width: MINI_CANVAS_WIDTH, height: MINI_CANVAS_HEIGHT }}
                    >
                      <div className="text-center text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]">
                        <PlusIcon />
                        <p className="mt-2 text-sm">Add Slide</p>
                      </div>
                    </button>
                  </div>
                  <SlidesRightSpacer />
                </>
              ) : (
                <EmptyState />
              )}
            </SlidesRow>
          </div>
        </div>

        <ControlPanel
          onBackground={() => setIsBackgroundModalOpen(true)}
          onAddText={handleAddText}
          onAddImage={() => setIsImageModalOpen(true)}
          onDuration={handleDurationClick}
          durationLabel={`${currentSlide?.duration_seconds || 3}s`}
          onCreate={handleRender}
          BackgroundIcon={BackgroundIcon}
          TextIcon={TextIcon}
          ImageIcon={ImageIcon}
        />
      </div>

      {/* Background Image Selection Modal */}
      <ImageSelectionModal
        isOpen={isBackgroundModalOpen}
        onClose={() => setIsBackgroundModalOpen(false)}
        onImageSelect={handleBackgroundImageSelect}
        title="Select Background Image"
      />

      {/* Image Overlay Selection Modal */}
      <ImageSelectionModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onImageSelect={handleImageOverlaySelect}
        title="Select Image"
      />

      <SlideshowPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewSlideshowId(null);
          setPreviewImages([]);
          setIsOpeningModal(false);
          setDeletingSlideshowId(null);
        }}
        imageUrls={previewImages}
        title="Video Preview"
        onDelete={async () => {
          if (!previewSlideshowId) return;
          
          // Check if slideshow still exists before attempting deletion
          const slideshowExists = displaySlideshows.find(s => s.id === previewSlideshowId);
          if (!slideshowExists) {
            console.warn('Slideshow no longer exists, closing modal without deletion');
            setIsPreviewOpen(false);
            setPreviewSlideshowId(null);
            setPreviewImages([]);
            setIsOpeningModal(false);
            return;
          }
          
          // Set the deleting slideshow ID to track which slideshow is being deleted
          setDeletingSlideshowId(previewSlideshowId);
          
          try {
            await deleteSlideshow(previewSlideshowId);
          } finally {
            // Don't close the modal here - let the useEffect handle it
            // This prevents race conditions when opening new modals
          }
        }}
      />
    </div>
  );
}
