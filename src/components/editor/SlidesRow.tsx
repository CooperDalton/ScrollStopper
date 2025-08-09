'use client';

import React from 'react';
import SlideCanvas, { SlideCanvasProps } from './SlideCanvas';

export interface SlidesRowProps {
  children?: React.ReactNode;
  innerRef?: React.Ref<HTMLDivElement>;
}

export default function SlidesRow({ children, innerRef }: SlidesRowProps) {
  return (
    <div ref={innerRef} className="absolute inset-0 flex items-center gap-6 overflow-x-auto pb-4 scrollbar-hide scroll-smooth">
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


