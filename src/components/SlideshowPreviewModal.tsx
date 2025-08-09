'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface SlideshowPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrls: string[];
  title?: string;
  onDelete?: () => void;
}

const XIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export default function SlideshowPreviewModal({ isOpen, onClose, imageUrls, title = 'Preview', onDelete }: SlideshowPreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<null | 'next' | 'prev'>(null);
  const animationTimeoutRef = useRef<number | null>(null);

  const handleClose = () => {
    setCurrentIndex(0);
    onClose();
  };

  // Enable escape key to close modal (must be called unconditionally for stable hook order)
  useEscapeKey(handleClose, isOpen);

  const total = imageUrls.length;
  const inRange = (i: number) => i >= 0 && i < total;
  const prevIndex = useMemo(() => (inRange(currentIndex - 1) ? currentIndex - 1 : null), [currentIndex, total]);
  const nextIndex = useMemo(() => (inRange(currentIndex + 1) ? currentIndex + 1 : null), [currentIndex, total]);
  const incomingNextIndex = useMemo(
    () => (inRange(currentIndex + 2) ? currentIndex + 2 : null),
    [currentIndex, total]
  );
  const incomingPrevIndex = useMemo(
    () => (inRange(currentIndex - 2) ? currentIndex - 2 : null),
    [currentIndex, total]
  );

  const triggerNext = () => {
    if (isAnimating || total <= 1 || !inRange(currentIndex + 1)) return;
    setDirection('next');
    setIsAnimating(true);
    if (animationTimeoutRef.current) window.clearTimeout(animationTimeoutRef.current);
    animationTimeoutRef.current = window.setTimeout(() => {
      setCurrentIndex((idx) => (inRange(idx + 1) ? idx + 1 : idx));
      setIsAnimating(false);
      setDirection(null);
    }, 350);
  };

  const triggerPrev = () => {
    if (isAnimating || total <= 1 || !inRange(currentIndex - 1)) return;
    setDirection('prev');
    setIsAnimating(true);
    if (animationTimeoutRef.current) window.clearTimeout(animationTimeoutRef.current);
    animationTimeoutRef.current = window.setTimeout(() => {
      setCurrentIndex((idx) => (inRange(idx - 1) ? idx - 1 : idx));
      setIsAnimating(false);
      setDirection(null);
    }, 350);
  };

  const slidesToRender = useMemo(() => {
    type SlideRole = 'left' | 'center' | 'right' | 'offLeft' | 'offRight';
    const slides: Array<{ key: string; index: number; role: SlideRole }> = [];
    if (total === 0) return slides;

    if (!isAnimating || !direction) {
      if (prevIndex !== null) slides.push({ key: `prev-${prevIndex}`, index: prevIndex, role: 'left' });
      slides.push({ key: `curr-${currentIndex}`, index: currentIndex, role: 'center' });
      if (nextIndex !== null) slides.push({ key: `next-${nextIndex}`, index: nextIndex, role: 'right' });
      return slides;
    }

    if (direction === 'next') {
      if (prevIndex !== null) slides.push({ key: `out-left-${prevIndex}`, index: prevIndex, role: 'offLeft' });
      slides.push({ key: `to-left-${currentIndex}`, index: currentIndex, role: 'left' });
      if (nextIndex !== null) slides.push({ key: `to-center-${nextIndex}`, index: nextIndex, role: 'center' });
      if (incomingNextIndex !== null)
        slides.push({ key: `in-right-${incomingNextIndex}`, index: incomingNextIndex, role: 'right' });
      return slides;
    }

    // direction === 'prev'
    if (incomingPrevIndex !== null)
      slides.push({ key: `in-left-${incomingPrevIndex}`, index: incomingPrevIndex, role: 'left' });
    if (prevIndex !== null) slides.push({ key: `to-center-${prevIndex}`, index: prevIndex, role: 'center' });
    slides.push({ key: `to-right-${currentIndex}`, index: currentIndex, role: 'right' });
    if (nextIndex !== null) slides.push({ key: `out-right-${nextIndex}`, index: nextIndex, role: 'offRight' });
    return slides;
  }, [total, isAnimating, direction, prevIndex, currentIndex, nextIndex, incomingNextIndex, incomingPrevIndex]);

  const getTransformForRole = (role: string) => {
    switch (role) {
      case 'left':
        return 'translateX(-38%) scale(0.9)';
      case 'center':
        return 'translateX(0%) scale(1)';
      case 'right':
        return 'translateX(38%) scale(0.9)';
      case 'offLeft':
        return 'translateX(-120%) scale(0.85)';
      case 'offRight':
        return 'translateX(120%) scale(0.85)';
      default:
        return 'translateX(0%) scale(1)';
    }
  };

  const getZIndexForRole = (role: string) => {
    switch (role) {
      case 'center':
        return 30;
      case 'left':
      case 'right':
        return 20;
      default:
        return 10;
    }
  };

  // Return early AFTER all hooks above have been called to keep hook order stable
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleClose}
    >
      <div
        className="relative bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)] p-6 w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[var(--color-text)]">{title}</h2>
          <div className="flex items-center gap-2">
            {onDelete && (
              <button
                onClick={() => {
                  onDelete();
                }}
                className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                <TrashIcon />
                <span>Delete</span>
              </button>
            )}
            <button
              onClick={handleClose}
              className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              <XIcon />
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="relative w-full max-w-3xl h-[70vh]">
            {slidesToRender.map((s) => {
              const role = s.role;
              const isSide = role === 'left' || role === 'right';
              const isCenter = role === 'center';
              const transform = getTransformForRole(role);
              const zIndex = getZIndexForRole(role);
              const opacity = role === 'offLeft' || role === 'offRight' ? 0 : isCenter ? 1 : 0.9;
              const handleClick = () => {
                if (!isSide) return;
                if (role === 'left') triggerPrev();
                if (role === 'right') triggerNext();
              };
              return (
                <div
                  key={s.key}
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    transform,
                    transition: 'transform 350ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms ease',
                    zIndex,
                    opacity,
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    className={[
                      'overflow-hidden shadow-lg',
                      isCenter
                        ? 'w-[55%] border-0'
                        : 'w-[32%] border border-[var(--color-border)]',
                    ].join(' ')}
                    style={{
                      cursor: isSide ? 'pointer' : 'default',
                      pointerEvents: isSide ? 'auto' : 'none',
                    }}
                    onClick={handleClick}
                  >
                    <img
                      src={imageUrls[s.index]}
                      alt={`Slide ${s.index + 1}`}
                      className="w-full h-full max-h-[70vh] object-contain bg-[var(--color-bg-secondary)]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="text-center mt-4 text-sm text-[var(--color-text-muted)]">
          {currentIndex + 1} / {imageUrls.length}
        </div>
      </div>
    </div>
  );
}
