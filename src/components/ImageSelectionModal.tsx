'use client';

import React, { useState } from 'react';
import { useCollections } from '@/hooks/useCollections';
import { useImages } from '@/hooks/useImages';
import { getImageUrl } from '@/lib/images';
import CollectionThumbnail from './CollectionThumbnail';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface ImageSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (imageUrl: string, imageId: string) => void;
  title?: string;
}

const XIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const FolderIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7z" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);





export default function ImageSelectionModal({ isOpen, onClose, onImageSelect, title = 'Select Background Image' }: ImageSelectionModalProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());
  
  const { collections, isLoading: collectionsLoading } = useCollections();
  const { images, isLoading: imagesLoading } = useImages(selectedCollectionId);
  
  const selectedCollection = collections.find(c => c.id === selectedCollectionId);

  const handleClose = () => {
    setSelectedCollectionId(null);
    setImageLoadErrors(new Set());
    onClose();
  };

  // Enable escape key to close modal
  useEscapeKey(handleClose, isOpen);

  const handleImageSelect = (imageId: string, filePathOrStoragePath: string) => {
    const imageUrl = getImageUrl(filePathOrStoragePath);
    onImageSelect(imageUrl, imageId);
    handleClose();
  };

  const handleBackToCollections = () => {
    setSelectedCollectionId(null);
    setImageLoadErrors(new Set());
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleClose}
    >
      {/* Modal */}
      <div 
        className="relative bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)] p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {selectedCollection && (
              <button
                onClick={handleBackToCollections}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                <ArrowLeftIcon />
              </button>
            )}
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text)]">
                {selectedCollection ? selectedCollection.name : title}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {selectedCollection ? 'Choose an image from this collection' : 'Choose a collection to browse images'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* Content */}
        {!selectedCollection ? (
          // Collections View
          <div>
            {collectionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : collections.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {collections.map((collection) => (
                  <button
                    key={collection.id}
                    onClick={() => setSelectedCollectionId(collection.id)}
                    className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary)] hover:shadow-lg transition-all duration-200 text-left"
                  >
                    <div className="flex flex-col text-center">
                      <div className="mb-3">
                        <CollectionThumbnail collection={collection} />
                      </div>
                      <h3 className="font-semibold text-[var(--color-text)] text-sm">
                        {collection.name}
                      </h3>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto">
                  <div className="w-24 h-24 bg-[var(--color-bg-secondary)] rounded-full flex items-center justify-center mx-auto mb-6 text-[var(--color-text-muted)]">
                    <FolderIcon />
                  </div>
                  <h3 className="text-xl font-semibold text-[var(--color-text)] mb-2">
                    No image collections
                  </h3>
                  <p className="text-[var(--color-text-muted)]">
                    Create some image collections first to use as backgrounds.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Images View
          <div>
            {imagesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : images.length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {images.map((image) => {
                  const path = (image as any).storage_path || (image as any).file_path || '';
                  const imageUrl = path ? getImageUrl(path) : '';
                  const hasError = imageLoadErrors.has(image.id);
                  
                  return (
                    <button
                      key={image.id}
                      onClick={() => handleImageSelect(image.id, path)}
                      className="aspect-[9/16] bg-[var(--color-bg-secondary)] rounded-lg overflow-hidden border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors group"
                    >
                      {hasError ? (
                        <div className="w-full h-full flex items-center justify-center bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] text-xs">
                          <div className="text-center p-2">
                            <div className="mb-1">❌</div>
                            <div>Failed to load</div>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={imageUrl}
                          alt="Background option"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          onError={() => {
                            setImageLoadErrors(prev => new Set(prev).add(image.id));
                          }}
                          onLoad={() => {
                            setImageLoadErrors(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(image.id);
                              return newSet;
                            });
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto">
                  <div className="w-24 h-24 bg-[var(--color-bg-secondary)] rounded-full flex items-center justify-center mx-auto mb-6 text-[var(--color-text-muted)]">
                    <FolderIcon />
                  </div>
                  <h3 className="text-xl font-semibold text-[var(--color-text)] mb-2">
                    No images in this collection
                  </h3>
                  <p className="text-[var(--color-text-muted)]">
                    Add some images to this collection to use as backgrounds.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end mt-6 pt-4">
        </div>
      </div>


    </div>
  );
} 