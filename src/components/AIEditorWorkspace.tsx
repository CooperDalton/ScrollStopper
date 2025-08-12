'use client';

import React from 'react';
import AISidebar from '@/components/AISidebar';
import SlidesRow, { SlidesLeftSpacer, SlidesRightSpacer } from '@/components/editor/SlidesRow';
import SlidesList from '@/components/editor/SlidesList';
import EmptyState from '@/components/editor/EmptyState';
import { fabric } from 'fabric';
import type { Slide } from '@/hooks/useSlideshows';

export default function AIEditorWorkspace() {
  // Local-only slideshow state (no Supabase/localStorage sync)
  const [slides, setSlides] = React.useState<Slide[]>([]);
  const [selectedSlideId, setSelectedSlideId] = React.useState<string>('');
  const [slideRenderKey, setSlideRenderKey] = React.useState<number>(0);
  const [isEditorCleared, setIsEditorCleared] = React.useState<boolean>(true);

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

  // Fabric refs
  const canvasRefs = React.useRef<{ [key: string]: fabric.Canvas }>({});
  const miniCanvasRefs = React.useRef<{ [key: string]: fabric.Canvas }>({});
  const canvasElementRefs = React.useRef<{ [key: string]: HTMLCanvasElement }>({});
  const miniCanvasElementRefs = React.useRef<{ [key: string]: HTMLCanvasElement }>({});
  const initializingCanvasesRef = React.useRef<Set<string>>(new Set());
  const initializingMiniCanvasesRef = React.useRef<Set<string>>(new Set());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Helpers
  const centerSlide = (slideId: string, delay: number = 50) => {
    setTimeout(() => {
      if (scrollContainerRef.current) {
        const slideElement = scrollContainerRef.current.querySelector(
          `[data-slide-id="${slideId}"]`
        ) as HTMLElement | null;
        if (slideElement) {
          const container = scrollContainerRef.current;
          const containerWidth = container.clientWidth;
          const slideLeft = slideElement.offsetLeft;
          const slideWidth = slideElement.offsetWidth;
          const scrollLeft = slideLeft - containerWidth / 2 + slideWidth / 2;
          container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
      }
    }, delay);
  };

  const disposeCanvas = (slideId: string) => {
    const c = canvasRefs.current[slideId];
    if (c) {
      try { c.dispose(); } catch { try { c.clear(); } catch {} }
      delete canvasRefs.current[slideId];
      delete canvasElementRefs.current[slideId];
    }
  };

  const disposeMiniCanvas = (slideId: string) => {
    const c = miniCanvasRefs.current[slideId];
    if (c) {
      try { c.dispose(); } catch { try { c.clear(); } catch {} }
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

  // Fabric initializers (blank canvases only)
  const initializeCanvas = (slideId: string, canvasElement: HTMLCanvasElement) => {
    if (!canvasElement || !canvasElement.parentNode) return;
    if (!slides.some(s => s.id === slideId)) return;
    if (canvasRefs.current[slideId]) return;

    try {
      const canvas = new fabric.Canvas(canvasElement, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: '#f5f5f5'
      });
      canvasRefs.current[slideId] = canvas;
      canvasElementRefs.current[slideId] = canvasElement;
      canvas.renderAll();
    } catch (err) {
      console.error('Failed to initialize canvas:', err);
      disposeCanvas(slideId);
    }
  };

  const initializeMiniCanvas = (slideId: string, canvasElement: HTMLCanvasElement) => {
    if (!canvasElement || !canvasElement.parentNode) return;
    if (!slides.some(s => s.id === slideId)) return;
    if (miniCanvasRefs.current[slideId]) return;

    try {
      const canvas = new fabric.Canvas(canvasElement, {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: '#f5f5f5'
      });
      canvas.selection = false;
      canvas.skipTargetFind = true;
      miniCanvasRefs.current[slideId] = canvas;
      miniCanvasElementRefs.current[slideId] = canvasElement;
      canvas.renderAll();
    } catch (err) {
      console.error('Failed to initialize mini canvas:', err);
      disposeMiniCanvas(slideId);
    }
  };

  // Actions
  const handleGenerate = () => {
    // Dispose existing canvases to avoid stale refs
    Object.keys(canvasRefs.current).forEach(disposeCanvas);
    Object.keys(miniCanvasRefs.current).forEach(disposeMiniCanvas);

    const createdAt = new Date().toISOString();
    const newSlides: Slide[] = Array.from({ length: 5 }).map((_, idx) => ({
      id: `ai-slide-${Date.now()}-${idx}`,
      slideshow_id: 'ai-local',
      duration_seconds: 3,
      index: idx,
      created_at: createdAt,
      texts: [],
      overlays: []
    }));

    setSlides(newSlides);
    setSelectedSlideId(newSlides[0].id);
    setSlideRenderKey(prev => prev + 1);
    setIsEditorCleared(false);
    centerSlide(newSlides[0].id, 100);
  };

  const handleSlideSelect = (slideId: string) => {
    // Dispose other full canvases to keep one active at a time
    Object.keys(canvasRefs.current).forEach(id => {
      if (id !== slideId) disposeCanvas(id);
    });
    if (miniCanvasRefs.current[slideId]) disposeMiniCanvas(slideId);
    setSelectedSlideId(slideId);
    centerSlide(slideId, 50);
  };

  return (
    <div className="flex h-screen bg-[var(--color-bg)] overflow-hidden flex-1">
      <AISidebar onGenerate={handleGenerate} />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full h-full max-h-[900px] relative overflow-hidden border border-[var(--color-border)] rounded-xl">
            <SlidesRow innerRef={scrollContainerRef}>
              {slides.length > 0 && !isEditorCleared ? (
                <>
                  <SlidesLeftSpacer />
                  <SlidesList
                    slides={slides}
                    selectedSlideId={selectedSlideId}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    onSelect={handleSlideSelect}
                    initialize={initializeCanvas}
                    initializeMini={initializeMiniCanvas}
                    canvasRefs={canvasRefs}
                    miniCanvasRefs={miniCanvasRefs}
                    initializingRefs={initializingCanvasesRef}
                    initializingMiniRefs={initializingMiniCanvasesRef}
                    slideRenderKey={slideRenderKey}
                  />
                  <SlidesRightSpacer />
                </>
              ) : (
                <EmptyState />
              )}
            </SlidesRow>
          </div>
        </div>
      </div>
    </div>
  );
}


