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
  // Support multiple slideshows (rows). Each row has its own slides array.
  const [rows, setRows] = React.useState<Slide[][]>([]);
  const [activeRowIndex, setActiveRowIndex] = React.useState<number>(0);
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
  const scrollContainerRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const verticalScrollRef = React.useRef<HTMLDivElement>(null);

  // Helpers
  const centerSlide = (slideId: string, delay: number = 50) => {
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
        rowContainer.scrollTo({ left: targetLeft, behavior: 'smooth' });
      }

      // Vertical centering: use the main vertical container
      const containerRect = yContainer.getBoundingClientRect();
      const slideRect = slideElement.getBoundingClientRect();
      const targetTop = yContainer.scrollTop + (slideRect.top - containerRect.top) - (containerRect.height / 2) + (slideRect.height / 2);
      yContainer.scrollTo({ top: targetTop, behavior: 'smooth' });
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
    if (!rows.flat().some(s => s.id === slideId)) return;
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
    if (!rows.flat().some(s => s.id === slideId)) return;
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

    setRows([newSlides]);
    setActiveRowIndex(0);
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

  // Temporary: add a new row of 5 slides above current rows
  const handleAddRow = () => {
    const createdAt = new Date().toISOString();
    const newSlides: Slide[] = Array.from({ length: 5 }).map((_, idx) => ({
      id: `ai-slide-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      slideshow_id: `ai-local-row-${Date.now()}`,
      duration_seconds: 3,
      index: idx,
      created_at: createdAt,
      texts: [],
      overlays: []
    }));

    setRows(prev => [newSlides, ...prev]);
    setActiveRowIndex(0);
    setSelectedSlideId(newSlides[0].id);
    setSlideRenderKey(prev => prev + 1);
    setIsEditorCleared(false);
    // Center after DOM updates
    setTimeout(() => centerSlide(newSlides[0].id, 100), 0);
  };

  // Logic to switch active row when clicking any slide in that row
  const handleRowSlideSelect = (rowIndex: number, slideId: string) => {
    if (activeRowIndex !== rowIndex) setActiveRowIndex(rowIndex);
    handleSlideSelect(slideId);
  };

  return (
    <div className="flex h-screen bg-[var(--color-bg)] overflow-hidden flex-1">
      <AISidebar onGenerate={handleGenerate} onAddRow={handleAddRow} />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full h-full max-h-[900px] relative overflow-hidden border border-[var(--color-border)] rounded-xl">
            {/* Single seamless scrollable area handling both horizontal and vertical centering */}
            <div ref={verticalScrollRef} className="absolute inset-0 overflow-auto">
              <div className="min-h-full min-w-full flex flex-col gap-0 p-6">
                {rows.length > 0 && !isEditorCleared ? (
                  rows.map((rowSlides, idx) => (
                    <SlidesRow
                      key={`row-${idx}`}
                      absolute={false}
                      innerRef={(el) => {
                        scrollContainerRefs.current[idx] = el;
                      }}
                      className="pb-0"
                    >
                      <SlidesLeftSpacer />
                      <SlidesList
                        slides={rowSlides}
                        selectedSlideId={selectedSlideId}
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                        onSelect={(id) => handleRowSlideSelect(idx, id)}
                        initialize={initializeCanvas}
                        initializeMini={initializeMiniCanvas}
                        canvasRefs={canvasRefs}
                        miniCanvasRefs={miniCanvasRefs}
                        initializingRefs={initializingCanvasesRef}
                        initializingMiniRefs={initializingMiniCanvasesRef}
                        slideRenderKey={slideRenderKey}
                      />
                      <SlidesRightSpacer />
                    </SlidesRow>
                  ))
                ) : (
                  <div className="flex-1 min-h-[400px] flex items-center justify-center">
                    <EmptyState />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


