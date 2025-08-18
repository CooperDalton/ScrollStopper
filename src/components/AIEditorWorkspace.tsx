'use client';

import React from 'react';
import AISidebar from '@/components/AISidebar';
import ImageSelectionModal from '@/components/ImageSelectionModal';
import CollectionSelectionModal from '@/components/CollectionSelectionModal';
import SlidesRow, { SlidesLeftSpacer, SlidesRightSpacer } from '@/components/editor/SlidesRow';
import SlidesList from '@/components/editor/SlidesList';
import EmptyState from '@/components/editor/EmptyState';
import { fabric } from 'fabric';
import { animateScrollX, animateScrollY, FAST_SCROLL_DURATION_X_MS, FAST_SCROLL_DURATION_Y_MS } from '@/lib/scroll';
import type { Slide } from '@/hooks/useSlideshows';

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
  background_image_ref: string;
  texts?: JSONText[];
  overlays?: JSONOverlay[];
}

interface JSONSlideshow {
  caption: string;
  slides: JSONSlide[];
}

export default function AIEditorWorkspace() {
  // Local-only slideshow state (no Supabase/localStorage sync)
  // Support multiple slideshows (rows). Each row has its own slides array.
  const [rows, setRows] = React.useState<Slide[][]>([]);
  const [activeRowIndex, setActiveRowIndex] = React.useState<number>(0);
  const [selectedSlideId, setSelectedSlideId] = React.useState<string>('');
  const [slideRenderKey, setSlideRenderKey] = React.useState<number>(0);
  const [isEditorCleared, setIsEditorCleared] = React.useState<boolean>(true);
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

  const getTextStyling = (fontSize: number = 24) => ({
    fontFamily: '"proxima-nova", sans-serif',
    fontWeight: '600',
    fill: '#ffffff',
    textAlign: 'center' as const,
    originX: 'center' as const,
    originY: 'center' as const,
    stroke: 'black',
    charSpacing: -40,
    lineHeight: 1.0,
    fontSize
  });

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
      // Track the DOM element so we can avoid disposing when React is unmounting
      canvasElementRefs.current[slideId] = canvasElement;
      canvasRefs.current[slideId] = canvas;

      const slide = rows.flat().find(s => s.id === slideId);
      if (slide) {
        if (slide.backgroundImage) {
          fabric.Image.fromURL(
            slide.backgroundImage,
            (img: fabric.Image) => {
              img.set({ selectable: false, evented: false });
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
        slide.texts?.forEach((textData) => {
          const fabricText = new fabric.IText(textData.text, {
            ...getTextStyling(textData.size),
            left: textData.position_x,
            top: textData.position_y,
            angle: textData.rotation || 0,
          });
          canvas.add(fabricText);
        });
        slide.overlays?.forEach((overlayData) => {
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
                  selectable: false,
                  evented: false,
                });
                canvas.add(img);
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
      }

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
    if (!data || !Array.isArray(data.slides)) {
      alert('JSON must contain slides');
      return;
    }

    const createdAt = new Date().toISOString();
    const newSlides: Slide[] = data.slides.map((slide, idx) => {
      const slideId = `json-slide-${Date.now()}-${idx}`;
      return {
        id: slideId,
        slideshow_id: 'ai-local',
        duration_seconds: 3,
        index: idx,
        created_at: createdAt,
        backgroundImage: slide.background_image_ref,
        texts: (slide.texts || []).map((t, tIdx) => ({
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
        overlays: (slide.overlays || []).map((o, oIdx) => ({
          id: `${slideId}-overlay-${oIdx}`,
          slide_id: slideId,
          image_id: '',
          position_x: o.position_x,
          position_y: o.position_y,
          rotation: o.rotation,
          size: o.size,
          created_at: createdAt,
          imageUrl: o.image_ref
        }))
      };
    });

    setRows([newSlides]);
    setActiveRowIndex(0);
    if (newSlides.length > 0) {
      setSelectedSlideId(newSlides[0].id);
      centerSlide(newSlides[0].id, 100);
    }
    setSlideRenderKey(prev => prev + 1);
    setIsEditorCleared(false);
    ensureThumbnailsForSlides(newSlides.map(s => s.id));
  };

  const handleSlideSelect = (slideId: string, options?: { fastVertical?: boolean; fastHorizontal?: boolean }) => {
    // Dispose other full canvases to keep one active at a time
    Object.keys(canvasRefs.current).forEach(id => {
      if (id !== slideId) disposeCanvas(id);
    });
    if (miniCanvasRefs.current[slideId]) disposeMiniCanvas(slideId);
    // Clear old thumbnail for selected slide to encourage fresh capture on blur
    setThumbnails(prev => {
      const copy = { ...prev };
      delete copy[slideId];
      return copy;
    });
    setSelectedSlideId(slideId);
    centerSlide(slideId, 50, options);
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
    ensureThumbnailsForSlides(newSlides.map(s => s.id));
    // Center after DOM updates
    setTimeout(() => centerSlide(newSlides[0].id, 100), 0);
  };

  // Logic to switch active row when clicking any slide in that row
  const handleRowSlideSelect = (rowIndex: number, slideId: string) => {
    const isDifferentRow = activeRowIndex !== rowIndex;
    if (isDifferentRow) setActiveRowIndex(rowIndex);
    handleSlideSelect(slideId, { fastVertical: isDifferentRow, fastHorizontal: isDifferentRow });
  };

  return (
    <div className="flex h-screen bg-[var(--color-bg)] overflow-hidden flex-1">
      <AISidebar
        onAddRow={handleAddRow}
        onGenerateFromJson={handleGenerateFromJson}
        onRunGenerate={({ productId, prompt }) => {
          try {
            setAiThoughts('');
            const run = async () => {
              const res = await fetch('/api/slideshows/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, prompt, selectedImageIds, selectedCollectionIds, aspectRatio: selectedAspectRatio }),
              });
              if (!res.ok || !res.body) {
                setAiThoughts(prev => (prev ? prev + '\n' : '') + 'Server error starting generation.');
                return;
              }
              const reader = res.body.getReader();
              const decoder = new TextDecoder();
              let buffer = '';
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunkText = decoder.decode(value, { stream: true });
                // Append raw for visibility
                setAiThoughts(prev => prev + chunkText);
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
                      setSlideshowJson(JSON.stringify(obj, null, 2));
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
            run();
          } catch (e) {
            setAiThoughts(prev => (prev ? prev + '\n' : '') + 'Client error: ' + (e as Error).message);
          }
        }}
        jsonValue={slideshowJson}
        onJsonChange={setSlideshowJson}
        onSelectImages={() => setIsSelectCollectionsOpen(true)}
        aspectRatio={selectedAspectRatio}
        onAspectRatioChange={setSelectedAspectRatio}
      />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full h-full max-h-[900px] relative overflow-hidden border border-[var(--color-border)] rounded-xl">
            {/* AI Thoughts Floating Text Box */}
            <div className="absolute bottom-4 left-4 z-10 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg p-3 shadow-lg max-w-sm">
              <div className="text-xs font-medium text-[var(--color-text-muted)] mb-1">AI Thoughts</div>
              <div className="text-sm text-[var(--color-text)] font-mono whitespace-pre-wrap max-h-64 overflow-auto pr-1">
                {aiThoughts || 'Ready to generate slideshows...'}
              </div>
            </div>
            
            {/* Single seamless scrollable area handling both horizontal and vertical centering */}
            <div ref={verticalScrollRef} className="absolute inset-0 overflow-auto scrollbar-hide">
              {rows.length > 0 && !isEditorCleared ? (
                <div
                  className="min-h-full min-w-full flex flex-col gap-0 px-6"
                  style={{ paddingTop: verticalPad, paddingBottom: verticalPad }}
                >
                  {rows.map((rowSlides, idx) => (
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
                        getThumbnailSrc={(id) => thumbnails[id]}
                      />
                      <SlidesRightSpacer />
                    </SlidesRow>
                  ))}
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
    </div>
  );
}


