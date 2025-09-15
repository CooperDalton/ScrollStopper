'use client';

import React from 'react';
import { getImageUrl, getPublicImageUrlFromPath, type ImageCollection, type Image } from '@/lib/images';

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

const ImageIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

// Collection thumbnail component that shows images or fallback to folder icon
export default function CollectionThumbnail({ collection, className = "w-full h-24" }: CollectionThumbnailProps) {
  const sampleImages = collection.sample_images || [];
  
  if (sampleImages.length === 0) {
    // No images - show "No Images" text with icon
    return (
      <div className={`${className} flex flex-col items-center justify-center bg-white dark:bg-gray-50 rounded-lg text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-400`}>
        <ImageIcon />
        <span className="text-xs mt-1 font-medium">No Images</span>
      </div>
    );
  }
  
  // Always show 4-slot thumbnail layout for consistency
  return (
    <div className={`${className} flex gap-1 rounded-lg overflow-hidden`}>
      {Array.from({ length: 4 }).map((_, index: number) => {
        const image = sampleImages[index];
        if (image) {
          const isPublic = (collection as any).type === 'public';
          const src = isPublic
            ? getPublicImageUrlFromPath((image as any).storage_path)
            : getImageUrl((image as any).storage_path || (image as any).file_path);
          return (
            <div key={image.id} className="flex-1 overflow-hidden bg-[var(--color-bg-tertiary)]">
              <img
                src={src}
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