'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as fabric from 'fabric';
import ImageSelectionModal from './ImageSelectionModal';
import { useSlideshows } from '@/hooks/useSlideshows';
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
  const { slideshows, loading, error, createSlideshow, addSlide, deleteSlide, saveSlideTexts, saveSlideOverlays, updateSlideBackground, updateSlideDuration, refetch } = useSlideshows();
  const [selectedSlideshowId, setSelectedSlideshowId] = useState<string>('');
  const [selectedSlideId, setSelectedSlideId] = useState<string>('');
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<{[key: string]: fabric.Canvas}>({});
  const canvasElementRefs = useRef<{[key: string]: HTMLCanvasElement}>({});

  const currentSlideshow = slideshows.find((s: Slideshow) => s.id === selectedSlideshowId);
  const currentSlide = currentSlideshow?.slides.find((s: Slide) => s.id === selectedSlideId);

  // Set default selected slideshow and slide when slideshows load
  useEffect(() => {
    if (slideshows.length > 0 && !selectedSlideshowId) {
      const firstSlideshow = slideshows[0];
      setSelectedSlideshowId(firstSlideshow.id);
      if (firstSlideshow.slides.length > 0) {
        setSelectedSlideId(firstSlideshow.slides[0].id);
      }
    }
  }, [slideshows, selectedSlideshowId]);

  // Reset unsaved changes when switching slides
  useEffect(() => {
    setHasUnsavedChanges(false);
  }, [selectedSlideId]);

  // Cleanup function for fabric canvases
  const disposeCanvas = (slideId: string) => {
    if (canvasRefs.current[slideId]) {
      try {
        canvasRefs.current[slideId].dispose();
      } catch (error) {
        // Ignore disposal errors - canvas might already be disposed
        console.warn('Canvas disposal warning:', error);
      }
      delete canvasRefs.current[slideId];
    }
    if (canvasElementRefs.current[slideId]) {
      delete canvasElementRefs.current[slideId];
    }
  };

  // Cleanup all canvases on unmount
  useEffect(() => {
    return () => {
      Object.keys(canvasRefs.current).forEach(slideId => {
        disposeCanvas(slideId);
      });
    };
  }, []);

  // Cleanup canvases when slideshows change to prevent stale references
  useEffect(() => {
    const currentSlideIds = new Set(slideshows.flatMap(s => s.slides.map(slide => slide.id)));
    const canvasSlideIds = Object.keys(canvasRefs.current);
    
    // Dispose canvases for slides that no longer exist
    canvasSlideIds.forEach(slideId => {
      if (!currentSlideIds.has(slideId)) {
        disposeCanvas(slideId);
      }
    });
  }, [slideshows]);

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
                // Mark as having unsaved changes
                setHasUnsavedChanges(true);
              }
                    } else if (activeObject.get('overlayId')) {
          // It's an image overlay
          const overlayId = activeObject.get('overlayId');
          if (currentSlide?.overlays) {
            currentSlide.overlays = currentSlide.overlays.filter(o => o.id !== overlayId);
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
    // Check if canvas element is still in DOM
    if (!canvasElement || !canvasElement.parentNode) {
      console.warn('Canvas element not in DOM, skipping initialization');
      return;
    }

    // Dispose existing canvas if it exists
    disposeCanvas(slideId);

    try {
      const canvas = new fabric.Canvas(canvasElement, {
        width: 300,
        height: 533,
        backgroundColor: '#ffffff'
      });

      // Store references
      canvasRefs.current[slideId] = canvas;
      canvasElementRefs.current[slideId] = canvasElement;

      // Add background image if exists
      const slide = currentSlideshow?.slides.find((s: Slide) => s.id === slideId);
      if (slide?.backgroundImage) {
        fabric.Image.fromURL(slide.backgroundImage).then((img: fabric.Image) => {
          img.set({
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
            isBackground: true
          });
          img.scaleToWidth(300);
          canvas.add(img);
          canvas.renderAll();
          
          // After background is loaded, restore text elements and overlays
          restoreTextElements(slideId, canvas);
          restoreImageOverlays(slideId, canvas);
        }).catch((error) => {
          console.warn('Failed to load background image:', slide.backgroundImage, error);
          // Continue without background image - canvas will remain white
          
          // Still restore text elements and overlays even if background fails
          restoreTextElements(slideId, canvas);
          restoreImageOverlays(slideId, canvas);
        });
      } else {
        // No background image, just restore text elements and overlays
        restoreTextElements(slideId, canvas);
        restoreImageOverlays(slideId, canvas);
      }
    } catch (error) {
      console.error('Failed to initialize canvas:', error);
      // Clean up any partial initialization
      disposeCanvas(slideId);
    }
  };

  const restoreTextElements = (slideId: string, canvas: fabric.Canvas) => {
    const slide = currentSlideshow?.slides.find((s: Slide) => s.id === slideId);
    if (!slide?.texts) return;

    slide.texts.forEach((textData: SlideText) => {
      const fabricText = new fabric.IText(textData.text, {
        left: textData.position_x,
        top: textData.position_y,
        fontFamily: textData.font,
        fontSize: textData.size, // This is now the effective font size
        fill: '#000000',
        textAlign: 'center',
        originX: 'center',
        originY: 'center',
        angle: textData.rotation,
        scaleX: 1, // Reset scale to 1 since we're using effective fontSize
        scaleY: 1, // Reset scale to 1 since we're using effective fontSize
        lockUniScaling: true
      });

      // Disable stretching controls for text
      fabricText.setControlsVisibility({
        ml: false, // middle left
        mb: false, // middle bottom  
        mr: false, // middle right
        mt: false, // middle top
      });

      // Store the text ID on the fabric object for later reference
      fabricText.set('textId', textData.id);

      // Listen for text changes and update data
      fabricText.on('changed', () => updateTextData(textData.id, fabricText));
      fabricText.on('moving', () => updateTextData(textData.id, fabricText));
      fabricText.on('rotating', () => updateTextData(textData.id, fabricText));
      fabricText.on('scaling', () => updateTextData(textData.id, fabricText));

      canvas.add(fabricText);
    });

    canvas.renderAll();
    
    // Ensure proper layering after restoring elements
    ensureProperLayering(canvas);
  };

  const ensureProperLayering = (canvas: fabric.Canvas) => {
    const objects = canvas.getObjects();
    
    // Sort objects by type: background -> overlays -> text
    const backgroundObjects = objects.filter(obj => obj.get('isBackground'));
    const overlayObjects = objects.filter(obj => obj.get('overlayId'));  
    const textObjects = objects.filter(obj => obj.get('textId'));
    
    // If objects are already in correct order, no need to reorganize
    const correctOrder = [...backgroundObjects, ...overlayObjects, ...textObjects];
    const currentOrder = objects;
    
    let needsReordering = false;
    for (let i = 0; i < correctOrder.length; i++) {
      if (currentOrder[i] !== correctOrder[i]) {
        needsReordering = true;
        break;
      }
    }
    
    if (needsReordering) {
      // Remove all objects and re-add in correct order
      objects.forEach(obj => canvas.remove(obj));
      correctOrder.forEach(obj => canvas.add(obj));
      canvas.renderAll();
    }
  };

  const restoreImageOverlays = (slideId: string, canvas: fabric.Canvas) => {
    const slide = currentSlideshow?.slides.find((s: Slide) => s.id === slideId);
    if (!slide?.overlays) return;

    slide.overlays.forEach((overlayData: SlideOverlay) => {
      if (overlayData.imageUrl) {
        fabric.Image.fromURL(overlayData.imageUrl).then((img: fabric.Image) => {
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
          img.set('overlayId', overlayData.id);

          // Listen for changes and update data
          img.on('moving', () => updateOverlayData(overlayData.id, img));
          img.on('rotating', () => updateOverlayData(overlayData.id, img));
          img.on('scaling', () => updateOverlayData(overlayData.id, img));

          canvas.add(img);
        }).catch((error) => {
          console.warn('Failed to restore image overlay:', overlayData.imageUrl, error);
        });
      }
    });

    canvas.renderAll();
    
    // Ensure proper layering after restoring overlays
    ensureProperLayering(canvas);
  };

  const handleSlideSelect = (slideId: string) => {
    // Dispose canvases from other slides to prevent DOM conflicts
    Object.keys(canvasRefs.current).forEach(id => {
      if (id !== slideId) {
        disposeCanvas(id);
      }
    });

    setSelectedSlideId(slideId);
    
    // Manually center the slide within the fixed container
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
          
          // Smooth scroll to the calculated position
          container.scrollTo({
            left: scrollLeft,
            behavior: 'smooth'
          });
        }
      }
    }, 50);
  };

  const handleAddSlide = async () => {
    if (!currentSlideshow) return;
    
    try {
      // Dispose all canvases before state change to prevent DOM conflicts
      Object.keys(canvasRefs.current).forEach(slideId => {
        disposeCanvas(slideId);
      });
      
      // Add slide to database and update state
      const newSlide = await addSlide(currentSlideshow.id);
      setSelectedSlideId(newSlide.id);
      
      // Manually center the new slide within the fixed container
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const slideElement = scrollContainerRef.current.querySelector(`[data-slide-id="${newSlide.id}"]`) as HTMLElement;
          if (slideElement) {
            const container = scrollContainerRef.current;
            const containerWidth = container.clientWidth;
            const slideLeft = slideElement.offsetLeft;
            const slideWidth = slideElement.offsetWidth;
            
            // Calculate scroll position to center the slide within the fixed container
            const scrollLeft = slideLeft - (containerWidth / 2) + (slideWidth / 2);
            
            // Smooth scroll to the calculated position
            container.scrollTo({
              left: scrollLeft,
              behavior: 'smooth'
            });
          }
        }
      }, 100); // Increased delay to allow for re-render
    } catch (error) {
      console.error('Error adding slide:', error);
      alert('Failed to add slide. Please try again.');
    }
  };

  const handleDeleteSlide = async (slideId: string) => {
    if (!currentSlideshow) return;

    // Show confirmation dialog
    const confirmed = window.confirm('Are you sure you want to delete this slide? This action cannot be undone.');
    if (!confirmed) return;

    // Find the slide being deleted and determine which slide to select next
    const slideToDelete = currentSlideshow.slides.find(slide => slide.id === slideId);
    if (!slideToDelete) return;

    // Prevent deleting the last remaining slide
    if (currentSlideshow.slides.length === 1) {
      alert('Cannot delete the last slide in a slideshow');
      return;
    }

    // Dispose the canvas for the slide being deleted immediately
    if (canvasRefs.current[slideId]) {
      disposeCanvas(slideId);
    }

    // Immediately select a different slide for better UX
    const remainingSlides = currentSlideshow.slides.filter(slide => slide.id !== slideId);
    const deletedIndex = slideToDelete.index;
    const slideToSelect = remainingSlides.find(slide => slide.index === deletedIndex) ||
                         remainingSlides.find(slide => slide.index === deletedIndex - 1) ||
                         remainingSlides[0];
    
    if (slideToSelect) {
      setSelectedSlideId(slideToSelect.id);
      
      // Center the newly selected slide after deletion
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const slideElement = scrollContainerRef.current.querySelector(`[data-slide-id="${slideToSelect.id}"]`) as HTMLElement;
          if (slideElement) {
            const container = scrollContainerRef.current;
            const containerWidth = container.clientWidth;
            const slideLeft = slideElement.offsetLeft;
            const slideWidth = slideElement.offsetWidth;
            
            // Calculate scroll position to center the slide within the fixed container
            const scrollLeft = slideLeft - (containerWidth / 2) + (slideWidth / 2);
            
            // Smooth scroll to the calculated position
            container.scrollTo({
              left: scrollLeft,
              behavior: 'smooth'
            });
          }
        }
      }, 100); // Delay to allow for re-render after deletion
    }

    // Perform database operations in the background
    try {
      await deleteSlide(slideId);
      console.log('Slide deleted successfully');
    } catch (error) {
      console.error('Error deleting slide:', error);
      alert('Failed to delete slide from database. Refreshing to restore correct state.');
      
      // Refresh the data to restore the correct state since database operation failed
      await refetch();
    }
  };

  const handleDurationClick = async () => {
    if (!currentSlide) return;

    // Cycle through durations 2, 3, 4, 5, 6, then back to 2
    const currentDuration = currentSlide.duration_seconds || 3;
    const nextDuration = currentDuration >= 6 ? 2 : currentDuration + 1;

    try {
      await updateSlideDuration(currentSlide.id, nextDuration);
      console.log(`Slide duration updated to ${nextDuration}s`);
    } catch (error) {
      console.error('Error updating slide duration:', error);
      alert('Failed to update slide duration. Please try again.');
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
      position_x: 150,
      position_y: 250,
      size: 24,
      rotation: 0,
      font: 'Arial',
      created_at: new Date().toISOString()
    };

    // Add to slide data
    if (!currentSlide.texts) {
      currentSlide.texts = [];
    }
    currentSlide.texts.push(newText);
    
    // Mark as having unsaved changes
    setHasUnsavedChanges(true);

    // Create fabric text object
    const fabricText = new fabric.IText(newText.text, {
      left: newText.position_x,
      top: newText.position_y,
      fontFamily: newText.font,
      fontSize: newText.size,
      fill: '#000000',
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
      angle: newText.rotation,
      lockUniScaling: true
    });

    // Disable stretching controls for text
    fabricText.setControlsVisibility({
      ml: false, // middle left
      mb: false, // middle bottom  
      mr: false, // middle right
      mt: false, // middle top
    });

    // Store the text ID on the fabric object for later reference
    fabricText.set('textId', textId);

    // Listen for text changes and update data
    fabricText.on('changed', () => updateTextData(textId, fabricText));
    fabricText.on('moving', () => updateTextData(textId, fabricText));
    fabricText.on('rotating', () => updateTextData(textId, fabricText));
    fabricText.on('scaling', () => updateTextData(textId, fabricText));

    canvas.add(fabricText);
    canvas.setActiveObject(fabricText);
    canvas.renderAll();
    
    // Ensure text is on top layer
    ensureProperLayering(canvas);
  };

  const updateTextData = (textId: string, fabricText: fabric.IText) => {
    if (!currentSlide?.texts) return;

    const textData = currentSlide.texts.find(t => t.id === textId);
    if (textData) {
      textData.text = fabricText.text || 'text';
      textData.position_x = fabricText.left || 0;
      textData.position_y = fabricText.top || 0;
      // For text, we need to account for both fontSize and scaling
      // When users resize by dragging corners, Fabric.js applies scaleX/scaleY
      const effectiveFontSize = (fabricText.fontSize || 24) * (fabricText.scaleX || 1);
      textData.size = Math.round(effectiveFontSize);
      textData.rotation = fabricText.angle || 0;
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
    }
  };

  const updateOverlayData = (overlayId: string, fabricImage: fabric.Image) => {
    if (!currentSlide?.overlays) return;

    const overlayData = currentSlide.overlays.find(o => o.id === overlayId);
    if (overlayData) {
      overlayData.position_x = fabricImage.left || 0;
      overlayData.position_y = fabricImage.top || 0;
      overlayData.rotation = fabricImage.angle || 0;
      overlayData.size = Math.round((fabricImage.scaleX || 1) * 100);
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
    }
  };

  const handleBackgroundImageSelect = async (imageUrl: string, imageId: string) => {
    if (!currentSlide) return;

    try {
      // Automatically sync to Supabase
      await updateSlideBackground(selectedSlideId, imageId);

      // Update canvas background
      const canvas = canvasRefs.current[selectedSlideId];
      if (canvas) {
        // Clear existing background images
        const objects = canvas.getObjects();
        objects.forEach(obj => {
          if (obj.get('isBackground')) {
            canvas.remove(obj);
          }
        });

        // Add new background image
        fabric.Image.fromURL(imageUrl).then((img: fabric.Image) => {
          img.set({
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
            isBackground: true
          });
          img.scaleToWidth(300);
          canvas.add(img);
          canvas.renderAll();
        }).catch((error) => {
          console.warn('Failed to load selected background image:', imageUrl, error);
        });
      }

      console.log('Background image updated successfully');
    } catch (error) {
      console.error('Failed to update background image:', error);
      alert('Failed to update background image. Please try again.');
    }
  };

  const handleImageOverlaySelect = (imageUrl: string, imageId: string) => {
    if (!currentSlide) return;

    const overlayId = `overlay-${Date.now()}`;
    
    // Add to canvas first to get image dimensions
    const canvas = canvasRefs.current[selectedSlideId];
    if (canvas) {
      fabric.Image.fromURL(imageUrl).then((img: fabric.Image) => {
        // Calculate smart sizing based on image dimensions
        const canvasWidth = 300;
        const canvasHeight = 533;
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
          image_id: imageId,
          position_x: 150,
          position_y: 250,
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
        
        // Mark as having unsaved changes
        setHasUnsavedChanges(true);

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
        img.set('overlayId', overlayId);

        // Listen for changes and update data
        img.on('moving', () => updateOverlayData(overlayId, img));
        img.on('rotating', () => updateOverlayData(overlayId, img));
        img.on('scaling', () => updateOverlayData(overlayId, img));

        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
        
        // Ensure proper layering with image overlays below text
        ensureProperLayering(canvas);
      }).catch((error) => {
        console.warn('Failed to load image overlay:', imageUrl, error);
      });
    }
  };

  const handleSave = async () => {
    if (!currentSlide || !selectedSlideId) return;

    try {
      setIsSaving(true);
      
      // Save both text and overlay data to Supabase
      await Promise.all([
        saveSlideTexts(selectedSlideId, currentSlide.texts || []),
        saveSlideOverlays(selectedSlideId, currentSlide.overlays || [])
      ]);
      
      // Mark as saved
      setHasUnsavedChanges(false);
      
      console.log('Slide saved successfully');
    } catch (error) {
      console.error('Failed to save slide:', error);
      alert('Failed to save slide. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSlideshow = async () => {
    try {
      setIsCreating(true);
      const newSlideshow = await createSlideshow();
      
      // Select the newly created slideshow and its first slide
      setSelectedSlideshowId(newSlideshow.id);
      if (newSlideshow.slides.length > 0) {
        setSelectedSlideId(newSlideshow.slides[0].id);
      }
    } catch (err) {
      console.error('Failed to create slideshow:', err);
      alert('Failed to create slideshow. Please try again.');
    } finally {
      setIsCreating(false);
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

        {/* Create Slideshow Button */}
        <div className="p-4 border-b border-[var(--color-border)]">
          <button
            onClick={handleCreateSlideshow}
            disabled={isCreating}
            className="w-full flex items-center justify-center gap-2 p-3 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusIcon />
            {isCreating ? 'Creating...' : 'New Slideshow'}
          </button>
        </div>

        {/* Slideshows List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-[var(--color-text-muted)] py-8">
              Loading slideshows...
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-8">
              Error: {error}
            </div>
          ) : slideshows.length === 0 ? (
            <div className="text-center text-[var(--color-text-muted)] py-8">
              No slideshows yet. Create your first one!
            </div>
          ) : (
            <div className="space-y-3">
              {slideshows.map((slideshow: Slideshow) => (
              <button
                key={slideshow.id}
                onClick={() => {
                  setSelectedSlideshowId(slideshow.id);
                  setSelectedSlideId(slideshow.slides[0]?.id || '');
                }}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  selectedSlideshowId === slideshow.id
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] bg-opacity-10'
                    : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-[var(--color-text)]">{slideshow.caption || 'Untitled'}</h3>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                      {slideshow.slides.length} slide{slideshow.slides.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-[var(--color-text-muted)]">
                    <PlayIcon />
                  </div>
                </div>
              </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Center Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Canvas and Slides Area - Dynamic width container */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full h-full max-h-[900px] relative overflow-hidden border border-[var(--color-border)] rounded-xl">
            
            
            {/* Horizontal Slides Row - Container with fixed width */}
            <div className="absolute inset-0 flex items-center gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth" ref={scrollContainerRef}>
              {/* Left spacer to allow centering of first slide */}
              <div className="flex-shrink-0 w-[500px]"></div>
              
              {currentSlideshow?.slides.map((slide, index) => (
                <div key={slide.id} className="flex-shrink-0 flex items-center justify-center relative" data-slide-id={slide.id}>
                  {/* Save Button - Only shown for selected slide with unsaved changes */}
                  {selectedSlideId === slide.id && hasUnsavedChanges && (
                    <div className="absolute -top-19 right-55 z-20">
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white rounded-xl shadow-lg transition-colors font-medium"
                      >
                        <SaveIcon />
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  )}

                  {/* Delete Button - Always shown for selected slide */}
                  {selectedSlideId === slide.id && (
                    <div className="absolute -top-20 left-67 z-20">
                      <button
                        onClick={() => handleDeleteSlide(slide.id)}
                        className="flex items-center justify-center w-12 h-12 bg-gray-300 hover:bg-gray-500 text-red-500 rounded-full shadow-lg transition-colors"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                  
                  <button
                    onClick={() => handleSlideSelect(slide.id)}
                    className={`transition-all duration-300 ${
                      selectedSlideId === slide.id
                        ? 'scale-110 opacity-100'
                        : 'scale-90 opacity-60 hover:opacity-80 hover:scale-95'
                    }`}
                  >
                    <div className={`relative ${
                      selectedSlideId === slide.id
                        ? 'w-[300px] h-[533px]' // Less huge selected slide
                        : 'w-[200px] h-[356px]' // Smaller non-selected slides
                    } rounded-2xl overflow-hidden border-4 ${
                      selectedSlideId === slide.id
                        ? 'border-[var(--color-primary)]'
                        : 'border-[var(--color-border)]'
                    } ${selectedSlideId === slide.id ? '' : ''} bg-white`}>
                      
                      {selectedSlideId === slide.id ? (
                        <canvas
                          key={`canvas-${slide.id}`}
                          ref={(el) => {
                            if (el && !canvasRefs.current[slide.id]) {
                              // Use requestAnimationFrame to ensure DOM is ready
                              requestAnimationFrame(() => {
                                // Double-check the element is still in DOM before initializing
                                if (el.parentNode && !canvasRefs.current[slide.id]) {
                                  initializeCanvas(slide.id, el);
                                }
                              });
                            }
                          }}
                          width="300"
                          height="533"
                          className="w-full h-full"
                        />
                      ) : (
                        slide.backgroundImage ? (
                          <img
                            src={slide.backgroundImage}
                            alt={`Slide ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-[var(--color-bg-tertiary)] flex items-center justify-center text-[var(--color-text-muted)]">
                            <div className="text-center">
                              <PlayIcon />
                              <p className="mt-2">Empty Slide</p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </button>
                </div>
              ))}

              {/* Add Slide Button */}
              <div className="flex-shrink-0 flex items-center justify-center">
                <button
                  onClick={handleAddSlide}
                  className="w-[200px] h-[356px] bg-[var(--color-bg-secondary)] border-4 border-dashed border-[var(--color-border)] rounded-2xl flex items-center justify-center hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)] transition-all group"
                >
                  <div className="text-center text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]">
                    <PlusIcon />
                    <p className="mt-2 text-sm">Add Slide</p>
                  </div>
                </button>
              </div>
              
              {/* Right spacer to allow centering of last slide */}
              <div className="flex-shrink-0 w-[400px]"></div>
            </div>
          </div>
        </div>

        {/* Control Panel - Fixed position in center of slides area */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsBackgroundModalOpen(true)}
                className="p-3 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] rounded-xl hover:bg-[var(--color-bg-tertiary)] transition-colors"
                title="Background"
              >
                <BackgroundIcon />
              </button>
              <button 
                onClick={handleAddText}
                className="p-3 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors"
                title="Add Text"
              >
                <TextIcon />
              </button>
              <button 
                onClick={() => setIsImageModalOpen(true)}
                className="p-3 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors"
                title="Add Image"
              >
                <ImageIcon />
              </button>
              <button 
                onClick={handleDurationClick}
                className="px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer"
                title="Slide Duration"
              >
                {currentSlide?.duration_seconds || 3}s
              </button>
            </div>
          </div>
        </div>
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
    </div>
  );
} 