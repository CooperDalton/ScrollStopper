'use client';

import React, { useState } from 'react';

// Database-compatible interfaces
interface Slide {
  id: string;
  slideshow_id: string;
  background_image_id?: string;
  duration_seconds: number;
  created_at: string;
  // Computed properties for UI
  backgroundImage?: string;
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
        backgroundImage: 'https://via.placeholder.com/1080x1920/ff6b6b/ffffff?text=Slide+1' 
      },
      { 
        id: 'slide-2', 
        slideshow_id: '1',
        duration_seconds: 3,
        created_at: new Date().toISOString(),
        backgroundImage: 'https://via.placeholder.com/1080x1920/4ecdc4/ffffff?text=Slide+2' 
      },
      { 
        id: 'slide-3', 
        slideshow_id: '1',
        duration_seconds: 3,
        created_at: new Date().toISOString(),
        backgroundImage: 'https://via.placeholder.com/1080x1920/45b7d1/ffffff?text=Slide+3' 
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
        backgroundImage: 'https://via.placeholder.com/1080x1920/96ceb4/ffffff?text=Launch+1' 
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
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const currentSlideshow = mockSlideshows.find(s => s.id === selectedSlideshowId);
  const currentSlide = currentSlideshow?.slides.find(s => s.id === selectedSlideId);

  const handleSlideSelect = (slideId: string) => {
    setSelectedSlideId(slideId);
    
    // Scroll the selected slide to center
    setTimeout(() => {
      if (scrollContainerRef.current) {
        const slideElement = scrollContainerRef.current.querySelector(`[data-slide-id="${slideId}"]`);
        if (slideElement) {
          slideElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          });
        }
      }
    }, 100); // Small delay to allow for state update
  };

  const handleAddSlide = () => {
    if (!currentSlideshow) return;
    
    const newSlideId = `slide-${Date.now()}`;
    const newSlide: Slide = {
      id: newSlideId,
      slideshow_id: currentSlideshow.id,
      duration_seconds: 3,
      created_at: new Date().toISOString(),
      backgroundImage: `https://via.placeholder.com/1080x1920/ddd/888?text=New+Slide`
    };
    
    // In a real app, this would update the slideshow in state/database
    currentSlideshow.slides.push(newSlide);
    setSelectedSlideId(newSlideId);
    
    // Scroll the new slide to center
    setTimeout(() => {
      if (scrollContainerRef.current) {
        const slideElement = scrollContainerRef.current.querySelector(`[data-slide-id="${newSlideId}"]`);
        if (slideElement) {
          slideElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          });
        }
      }
    }, 100); // Small delay to allow for DOM update
  };

  return (
    <div className="flex h-full bg-[var(--color-bg)]">
      {/* Left Sidebar - Slideshows */}
      <div className="w-80 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col">
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
      <div className="flex-1 flex flex-col">
        {/* Canvas and Slides Area */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full h-[650px] flex items-center justify-center">
            {/* Horizontal Slides Row */}
            <div className="flex items-center gap-1 overflow-x-auto pb-4 w-full h-full scrollbar-hide" style={{ scrollSnapType: 'x mandatory', paddingLeft: '50%', paddingRight: '50%' }} ref={scrollContainerRef}>
              {currentSlideshow?.slides.map((slide, index) => (
                <div key={slide.id} className="flex-shrink-0 h-full flex items-center justify-center" style={{ scrollSnapAlign: 'center', minWidth: '250px' }} data-slide-id={slide.id}>
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
                    } ${selectedSlideId === slide.id ? '' : 'grayscale'} bg-white`}>
                      
                      {slide.backgroundImage ? (
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
              <div className="flex-shrink-0 h-full flex items-center justify-center" style={{ minWidth: '320px' }}>
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
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <div className="p-8">
          <div className="flex justify-center">
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-4">
                <button className="px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] rounded-xl hover:bg-[var(--color-bg-tertiary)] transition-colors">
                  Background
                </button>
                <button className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors">
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
      </div>
    </div>
  );
} 