'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as fabric from 'fabric';
import ImageSelectionModal from './ImageSelectionModal';

// Database-compatible interfaces
interface SlideText {
  id: string;
  slide_id: string;
  text: string;
  position_x: number;
  position_y: number;
  size: number;
  rotation: number;
  font: string;
  created_at: string;
}

interface Slide {
  id: string;
  slideshow_id: string;
  background_image_id?: string;
  duration_seconds: number;
  created_at: string;
  // Computed properties for UI
  backgroundImage?: string;
  texts?: SlideText[];
}

interface Slideshow {
  id: string;
  user_id: string;
  product_id?: string;
  caption?: string;
  status: string;
  upload_status: string;
  tik_tok_post_id?: string;
  frame_paths?: string[];
  created_at: string;
  // Computed properties for UI
  slides: Slide[];
}

// Mock data
const mockSlideshows: Slideshow[] = [
  {
    id: '1',
    user_id: 'user-1',
    product_id: 'product-1',
    caption: 'Summer Collection',
    status: 'draft',
    upload_status: 'pending',
    created_at: new Date().toISOString(),
    slides: [
      { 
        id: 'slide-1', 
        slideshow_id: '1',
        duration_seconds: 3,
        created_at: new Date().toISOString(),
        backgroundImage: 'https://picsum.photos/1080/1920?random=1',
        texts: []
      },
      { 
        id: 'slide-2', 
        slideshow_id: '1',
        duration_seconds: 3,
        created_at: new Date().toISOString(),
        backgroundImage: 'https://picsum.photos/1080/1920?random=2',
        texts: []
      },
      { 
        id: 'slide-3', 
        slideshow_id: '1',
        duration_seconds: 3,
        created_at: new Date().toISOString(),
        backgroundImage: 'https://picsum.photos/1080/1920?random=3',
        texts: []
      },
    ]
  },
  {
    id: '2',
    user_id: 'user-1',
    product_id: 'product-2',
    caption: 'Product Launch',
    status: 'draft',
    upload_status: 'pending',
    created_at: new Date().toISOString(),
    slides: [
      { 
        id: 'slide-4', 
        slideshow_id: '2',
        duration_seconds: 5,
        created_at: new Date().toISOString(),
        backgroundImage: 'https://picsum.photos/1080/1920?random=4',
        texts: []
      },
    ]
  }
];

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

export default function SlideshowEditor() {
  const [selectedSlideshowId, setSelectedSlideshowId] = useState<string>('1');
  const [selectedSlideId, setSelectedSlideId] = useState<string>('slide-1');
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<{[key: string]: fabric.Canvas}>({});
  const canvasElementRefs = useRef<{[key: string]: HTMLCanvasElement}>({});

  const currentSlideshow = mockSlideshows.find(s => s.id === selectedSlideshowId);
  const currentSlide = currentSlideshow?.slides.find(s => s.id === selectedSlideId);

  // Cleanup function for fabric canvases
  const disposeCanvas = (slideId: string) => {
    if (canvasRefs.current[slideId]) {
      canvasRefs.current[slideId].dispose();
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

  // Initialize fabric canvas for a slide
  const initializeCanvas = (slideId: string, canvasElement: HTMLCanvasElement) => {
    // Dispose existing canvas if it exists
    disposeCanvas(slideId);

    const canvas = new fabric.Canvas(canvasElement, {
      width: 300,
      height: 533,
      backgroundColor: '#ffffff'
    });

    // Store references
    canvasRefs.current[slideId] = canvas;
    canvasElementRefs.current[slideId] = canvasElement;

    // Add background image if exists
    const slide = currentSlideshow?.slides.find(s => s.id === slideId);
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
        
        // After background is loaded, restore text elements
        restoreTextElements(slideId, canvas);
      }).catch((error) => {
        console.warn('Failed to load background image:', slide.backgroundImage, error);
        // Continue without background image - canvas will remain white
        
        // Still restore text elements even if background fails
        restoreTextElements(slideId, canvas);
      });
    } else {
      // No background image, just restore text elements
      restoreTextElements(slideId, canvas);
    }
  };

  const restoreTextElements = (slideId: string, canvas: fabric.Canvas) => {
    const slide = currentSlideshow?.slides.find(s => s.id === slideId);
    if (!slide?.texts) return;

    slide.texts.forEach(textData => {
      const fabricText = new fabric.IText(textData.text, {
        left: textData.position_x,
        top: textData.position_y,
        fontFamily: textData.font,
        fontSize: textData.size,
        fill: '#000000',
        textAlign: 'center',
        originX: 'center',
        originY: 'center',
        angle: textData.rotation
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

  const handleAddSlide = () => {
    if (!currentSlideshow) return;
    
    const newSlideId = `slide-${Date.now()}`;
    const newSlide: Slide = {
      id: newSlideId,
      slideshow_id: currentSlideshow.id,
      duration_seconds: 3,
      created_at: new Date().toISOString(),
      backgroundImage: `https://picsum.photos/1080/1920?random=${Date.now()}`,
      texts: []
    };
    
    // In a real app, this would update the slideshow in state/database
    currentSlideshow.slides.push(newSlide);
    setSelectedSlideId(newSlideId);
    
    // Manually center the new slide within the fixed container
    setTimeout(() => {
      if (scrollContainerRef.current) {
        const slideElement = scrollContainerRef.current.querySelector(`[data-slide-id="${newSlideId}"]`) as HTMLElement;
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
      angle: newText.rotation
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
  };

  const updateTextData = (textId: string, fabricText: fabric.IText) => {
    if (!currentSlide?.texts) return;

    const textData = currentSlide.texts.find(t => t.id === textId);
    if (textData) {
      textData.text = fabricText.text || 'text';
      textData.position_x = fabricText.left || 0;
      textData.position_y = fabricText.top || 0;
      textData.size = fabricText.fontSize || 24;
      textData.rotation = fabricText.angle || 0;
    }
  };

  const handleImageSelect = (imageUrl: string, imageId: string) => {
    if (!currentSlide) return;

    // Update slide data
    currentSlide.backgroundImage = imageUrl;
    currentSlide.background_image_id = imageId;

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
  };

  return (
    <div className="flex h-screen bg-[var(--color-bg)] overflow-hidden">
      {/* Left Sidebar - Slideshows */}
      <div className="w-80 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col flex-shrink-0">
        {/* My Slideshows Header */}
        <div className="p-6 border-b border-[var(--color-border)]">
          <h2 className="text-xl font-bold text-[var(--color-text)]">My Slideshows</h2>
        </div>

        {/* Slideshows List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {mockSlideshows.map((slideshow) => (
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
        </div>
      </div>

      {/* Main Center Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Canvas and Slides Area - Dynamic width container */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full h-full max-h-[650px] relative overflow-hidden border border-[var(--color-border)] rounded-xl">
            {/* Horizontal Slides Row - Container with fixed width */}
            <div className="absolute inset-0 flex items-center gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth" ref={scrollContainerRef}>
              {/* Left spacer to allow centering of first slide */}
              <div className="flex-shrink-0 w-[400px]"></div>
              
              {currentSlideshow?.slides.map((slide, index) => (
                <div key={slide.id} className="flex-shrink-0 flex items-center justify-center" data-slide-id={slide.id}>
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
                              // Use a small delay to ensure React has fully mounted the element
                              setTimeout(() => initializeCanvas(slide.id, el), 10);
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

                      {/* Slide Number */}
                      <div className="absolute bottom-3 left-3 bg-black bg-opacity-80 text-white text-sm px-2 py-1 rounded-full">
                        {index + 1}
                      </div>
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
                onClick={() => setIsImageModalOpen(true)}
                className="px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] rounded-xl hover:bg-[var(--color-bg-tertiary)] transition-colors"
              >
                Background
              </button>
              <button 
                onClick={handleAddText}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                Text
              </button>
              <button className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors">
                Image
              </button>
              <div className="px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)]">
                {currentSlide?.duration_seconds || 3}s
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Selection Modal */}
      <ImageSelectionModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onImageSelect={handleImageSelect}
      />
    </div>
  );
} 