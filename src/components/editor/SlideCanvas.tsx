'use client';

import { fabric } from 'fabric';
import React from 'react';

export interface SlideCanvasProps {
  slideId: string;
  width: number;
  height: number;
  isSelected: boolean;
  initialize: (slideId: string, el: HTMLCanvasElement) => void;
  initializeMini: (slideId: string, el: HTMLCanvasElement) => void;
  canvasRefs: React.MutableRefObject<{[key:string]: fabric.Canvas}>;
  miniCanvasRefs: React.MutableRefObject<{[key:string]: fabric.Canvas}>;
  initializingRefs?: React.MutableRefObject<Set<string>>;
  initializingMiniRefs?: React.MutableRefObject<Set<string>>;
  slideRenderKey: number;
  onClick: () => void;
  frameClassName?: string;
  borderClassName?: string;
  /** Static thumbnail source for mini (unselected) slides */
  thumbnailSrc?: string;
}

export default function SlideCanvas({
  slideId,
  width,
  height,
  isSelected,
  initialize,
  initializeMini,
  canvasRefs,
  miniCanvasRefs,
  initializingRefs,
  initializingMiniRefs,
  slideRenderKey,
  onClick,
  frameClassName,
  borderClassName,
  thumbnailSrc
}: SlideCanvasProps) {
  return (
    <button onClick={onClick} className={`transition-all duration-300 ${isSelected ? 'scale-110' : 'scale-90 hover:scale-95'}`}>
      <div
        className={`relative overflow-hidden ${borderClassName || ''} ${isSelected ? '' : ''} bg-white`}
        style={{ width, height }}
      >
        {isSelected ? (
          <div
            key={`canvas-${slideId}-${slideRenderKey}`}
            className="relative w-full h-full"
            ref={(container) => {
              if (!container) return;
              if (canvasRefs.current[slideId]) return;
              if (initializingRefs?.current.has(slideId)) return;
              initializingRefs?.current.add(slideId);
              requestAnimationFrame(() => {
                if (!container.parentNode || canvasRefs.current[slideId]) {
                  initializingRefs?.current.delete(slideId);
                  return;
                }
                // Clear any prior children to avoid duplicate canvases
                while (container.firstChild) container.removeChild(container.firstChild);
                const el = document.createElement('canvas');
                el.width = width;
                el.height = height;
                el.className = 'w-full h-full';
                container.appendChild(el);
                initialize(slideId, el);
                initializingRefs?.current.delete(slideId);
              });
            }}
          />
        ) : (
          thumbnailSrc ? (
            <img
              key={`mini-img-${slideId}-${slideRenderKey}`}
              src={thumbnailSrc}
              alt="Slide thumbnail"
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div
              key={`mini-canvas-${slideId}-${slideRenderKey}`}
              className="w-full h-full"
              ref={(container) => {
                if (!container) return;
                if (miniCanvasRefs.current[slideId]) return;
                if (initializingMiniRefs?.current.has(slideId)) return;
                initializingMiniRefs?.current.add(slideId);
                requestAnimationFrame(() => {
                  if (!container.parentNode || miniCanvasRefs.current[slideId]) {
                    initializingMiniRefs?.current.delete(slideId);
                    return;
                  }
                  while (container.firstChild) container.removeChild(container.firstChild);
                  const el = document.createElement('canvas');
                  el.width = width;
                  el.height = height;
                  el.className = 'w-full h-full';
                  container.appendChild(el);
                  initializeMini(slideId, el);
                  initializingMiniRefs?.current.delete(slideId);
                });
              }}
            />
          )
        )}
      </div>
    </button>
  );
}


