'use client';

import React from 'react';
import { Slide } from '@/hooks/useSlideshows';
import { fabric } from 'fabric';
import { SlideCanvas } from './SlidesRow';

export interface SlidesListProps {
  slides: Slide[];
  selectedSlideId: string;
  width: number;
  height: number;
  onSelect: (slideId: string) => void;
  initialize: (slideId: string, el: HTMLCanvasElement) => void;
  initializeMini: (slideId: string, el: HTMLCanvasElement) => void;
  canvasRefs: React.MutableRefObject<{[key:string]: fabric.Canvas}>;
  miniCanvasRefs: React.MutableRefObject<{[key:string]: fabric.Canvas}>;
  initializingRefs: React.MutableRefObject<Set<string>>;
  initializingMiniRefs: React.MutableRefObject<Set<string>>;
  slideRenderKey: number;
  renderOverlays?: (slideId: string) => React.ReactNode;
}

export default function SlidesList({
  slides,
  selectedSlideId,
  width,
  height,
  onSelect,
  initialize,
  initializeMini,
  canvasRefs,
  miniCanvasRefs,
  initializingRefs,
  initializingMiniRefs,
  slideRenderKey,
  renderOverlays
}: SlidesListProps) {
  return (
    <>
      {slides.map((slide) => (
        <div key={`${slide.id}-${slideRenderKey}`} className="flex-shrink-0 flex items-center justify-center relative" data-slide-id={slide.id}>
          {renderOverlays?.(slide.id)}
          <SlideCanvas
            slideId={slide.id}
            width={width}
            height={height}
            isSelected={selectedSlideId === slide.id}
            initialize={initialize}
            initializeMini={initializeMini}
            canvasRefs={canvasRefs}
            miniCanvasRefs={miniCanvasRefs}
            initializingRefs={initializingRefs}
            initializingMiniRefs={initializingMiniRefs}
            slideRenderKey={slideRenderKey}
            onClick={() => onSelect(slide.id)}
            borderClassName={selectedSlideId === slide.id ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'}
          />
        </div>
      ))}
    </>
  );
}


