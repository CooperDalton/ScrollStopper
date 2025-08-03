'use client';

import React, { useState } from 'react';
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

const ArrowLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export default function SlideshowPreviewModal({ isOpen, onClose, imageUrls, title = 'Preview', onDelete }: SlideshowPreviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleClose = () => {
    setCurrentIndex(0);
    onClose();
  };

  // Enable escape key to close modal
  useEscapeKey(handleClose, isOpen);

  if (!isOpen) return null;

  const prev = () => setCurrentIndex((currentIndex - 1 + imageUrls.length) % imageUrls.length);
  const next = () => setCurrentIndex((currentIndex + 1) % imageUrls.length);

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
                onClick={onDelete}
                className="p-1 text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
              >
                <TrashIcon />
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

        <div className="flex-1 flex items-center justify-center gap-4">
          <button
            onClick={prev}
            className="p-2 bg-[var(--color-bg-secondary)] text-[var(--color-text)] rounded-full hover:bg-[var(--color-bg-tertiary)]"
          >
            <ArrowLeftIcon />
          </button>
          <img src={imageUrls[currentIndex]} alt={`Slide ${currentIndex + 1}`} className="max-h-[70vh] object-contain" />
          <button
            onClick={next}
            className="p-2 bg-[var(--color-bg-secondary)] text-[var(--color-text)] rounded-full hover:bg-[var(--color-bg-tertiary)]"
          >
            <ArrowRightIcon />
          </button>
        </div>
        <div className="text-center mt-4 text-sm text-[var(--color-text-muted)]">
          {currentIndex + 1} / {imageUrls.length}
        </div>
      </div>
    </div>
  );
}
