'use client';

import React from 'react';
import { getImageUrl, type ImageCollection, type Image } from '@/lib/images';

interface CollectionThumbnailProps {
  collection: ImageCollection;
  className?: string;
}

const FolderIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7z" />
  </svg>
);

// Collection thumbnail component that shows images or fallback to folder icon
export default function CollectionThumbnail({ collection, className = "w-full h-24" }: CollectionThumbnailProps) {
  const sampleImages = collection.sample_images || [];
  
  if (sampleImages.length === 0) {
    // No images - show folder icon
    return (
      <div className={`${className} flex items-center justify-center bg-[var(--color-primary)] bg-opacity-10 rounded-lg text-[var(--color-primary)]`}>
        <FolderIcon />
      </div>
    );
  }
  
  if (sampleImages.length === 1) {
    // Single image - show it full size
    return (
      <div className={`${className} rounded-lg overflow-hidden`}>
        <img
          src={getImageUrl(sampleImages[0].file_path)}
          alt={collection.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to folder icon if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `
                <div class="w-full h-full flex items-center justify-center bg-[var(--color-primary)] bg-opacity-10 text-[var(--color-primary)]">
                  <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7z" />
                  </svg>
                </div>
              `;
            }
          }}
        />
      </div>
    );
  }
  
  // Multiple images - show horizontal line of 4 images
  const imagesToShow = sampleImages.slice(0, 4);
  return (
    <div className={`${className} flex gap-1 rounded-lg overflow-hidden`}>
      {imagesToShow.map((image: Image, index: number) => (
        <div key={image.id} className="flex-1 overflow-hidden bg-[var(--color-bg-tertiary)]">
          <img
            src={getImageUrl(image.file_path)}
            alt={`${collection.name} ${index + 1}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Show a subtle placeholder if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
      ))}
      {/* Fill remaining slots if less than 4 images with subtle background */}
      {Array.from({ length: 4 - imagesToShow.length }).map((_, index) => (
        <div key={`empty-${index}`} className="flex-1 bg-[var(--color-bg-tertiary)] opacity-50"></div>
      ))}
    </div>
  );
}