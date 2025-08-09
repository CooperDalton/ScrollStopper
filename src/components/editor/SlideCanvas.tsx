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
  borderClassName
}: SlideCanvasProps) {
  return (
    <button onClick={onClick} className={`transition-all duration-300 ${isSelected ? 'scale-110' : 'scale-90 hover:scale-95'}`}>
      <div
        className={`relative overflow-hidden ${borderClassName || ''} ${isSelected ? '' : ''} bg-white`}
        style={{ width, height }}
      >
        {isSelected ? (
          <div className="relative w-full h-full">
            <canvas
              key={`canvas-${slideId}-${slideRenderKey}`}
              ref={(el) => {
                if (!el) return;
                if (canvasRefs.current[slideId]) return;
                if (initializingRefs?.current.has(slideId)) return;
                initializingRefs?.current.add(slideId);
                requestAnimationFrame(() => {
                  if (el.parentNode && !canvasRefs.current[slideId]) {
                    initialize(slideId, el);
                  }
                  initializingRefs?.current.delete(slideId);
                });
              }}
              width={width}
              height={height}
              className="w-full h-full"
            />
          </div>
        ) : (
          <canvas
            key={`mini-canvas-${slideId}-${slideRenderKey}`}
            ref={(el) => {
              if (!el) return;
              if (miniCanvasRefs.current[slideId]) return;
              if (initializingMiniRefs?.current.has(slideId)) return;
              initializingMiniRefs?.current.add(slideId);
              requestAnimationFrame(() => {
                if (el.parentNode && !miniCanvasRefs.current[slideId]) {
                  initializeMini(slideId, el);
                }
                initializingMiniRefs?.current.delete(slideId);
              });
            }}
            width={width}
            height={height}
            className="w-full h-full"
          />
        )}
      </div>
    </button>
  );
}


