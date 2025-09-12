'use client';

import React from 'react';
import { getImageUrl, type ImageCollection, type Image } from '@/lib/images';

interface CollectionThumbnailProps {
  collection: ImageCollection | {
    id: string;
    name: string;
    sample_images?: any[];
    image_count?: number;
    type?: string;
    product_id?: string;
  };
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
  
  // Always show 4-slot thumbnail layout for consistency
  return (
    <div className={`${className} flex gap-1 rounded-lg overflow-hidden`}>
      {Array.from({ length: 4 }).map((_, index: number) => {
        const image = sampleImages[index];
        if (image) {
          return (
            <div key={image.id} className="flex-1 overflow-hidden bg-[var(--color-bg-tertiary)]">
              <img
                src={getImageUrl((image as any).storage_path || (image as any).file_path)}
                alt={`${collection.name} ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Show a subtle placeholder if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          );
        } else {
          return (
            <div key={`empty-${index}`} className="flex-1 bg-[var(--color-bg-tertiary)] opacity-50"></div>
          );
        }
      })}
    </div>
  );
}