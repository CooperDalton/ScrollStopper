'use client';

import React from 'react';
import SlideCanvas, { SlideCanvasProps } from './SlideCanvas';

export interface SlidesRowProps {
  children?: React.ReactNode;
  innerRef?: React.Ref<HTMLDivElement>;
  /**
   * When true, the row will be absolutely positioned to fill its container.
   * Defaults to true to preserve existing behavior.
   */
  absolute?: boolean;
  /**
   * Additional class names for the container. Useful when absolute is false
   * and the caller wants to control layout (e.g., stacking multiple rows).
   */
  className?: string;
}

export default function SlidesRow({ children, innerRef, absolute = true, className }: SlidesRowProps) {
  const positioning = absolute ? 'absolute inset-0' : '';
  return (
    <div
      ref={innerRef}
      className={`${positioning} flex items-center gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth ${className || ''}`}
    >
      {children}
    </div>
  );
}

export function SlidesLeftSpacer() {
  return <div className="flex-shrink-0 w-[500px]"></div>;
}

export function SlidesRightSpacer() {
  return <div className="flex-shrink-0 w-[400px]"></div>;
}

export { SlideCanvas };


