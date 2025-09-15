'use client';

import React, { useState, useMemo } from 'react';
import { useCollections } from '@/hooks/useCollections';
import { useImages } from '@/hooks/useImages';
import { useAllProductImages } from '@/hooks/useProducts';
import { getImageUrl, getPublicImageUrlFromPath } from '@/lib/images';
import CollectionThumbnail from './CollectionThumbnail';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { usePublicCollections } from '@/hooks/usePublicCollections';
import { usePublicImages } from '@/hooks/usePublicImages';

interface ImageSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (imageUrl: string, imageId: string, isProductImage?: boolean) => void;
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
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'collection' | 'public' | 'product' | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'public' | 'my-collections'>(() => {
    // Load from localStorage, default to 'my-collections'
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('image-selection-modal-view-mode');
      return (saved === 'public' || saved === 'my-collections') ? saved : 'my-collections';
    }
    return 'my-collections';
  });

  const { collections, isLoading: collectionsLoading } = useCollections();
  const { collections: publicCollections, isLoading: publicCollectionsLoading } = usePublicCollections();
  const { images, isLoading: imagesLoading } = useImages(selectedType === 'collection' ? selectedCollectionId : null);
  const { images: publicImages, isLoading: publicImagesLoading } = usePublicImages(selectedType === 'public' ? selectedCollectionId : null);
  const { productImages, isLoading: productImagesLoading } = useAllProductImages();

  // Handle view mode change with localStorage persistence
  const handleViewModeChange = (mode: 'public' | 'my-collections') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('image-selection-modal-view-mode', mode);
    }
    // Reset selection when switching views
    setSelectedCollectionId(null);
    setSelectedProductId(null);
    setSelectedType(null);
    setImageLoadErrors(new Set());
  };

  // Create combined collection list with regular collections and product pseudo-collections
  const combinedCollections = useMemo(() => {
    const productCollections = productImages.reduce((acc, image) => {
      const existing = acc.find(p => p.product_id === image.product_id);
      if (!existing) {
        acc.push({
          id: `product-${image.product_id}`,
          product_id: image.product_id,
          name: image.product_name,
          image_count: 1,
          sample_images: [image]
        });
      } else {
        existing.image_count += 1;
        if (existing.sample_images.length < 4) {
          existing.sample_images.push(image);
        }
      }
      return acc;
    }, [] as Array<{
      id: string;
      product_id: string;
      name: string;
      image_count: number;
      sample_images: typeof productImages;
    }>);

    const allCollections = [
      ...(publicCollections || []).map(c => ({ ...c, type: 'public' as const })),
      ...collections.map(c => ({ ...c, type: 'collection' as const })),
      ...productCollections.map(p => ({ ...p, type: 'product' as const }))
    ];

    // Filter based on view mode
    if (viewMode === 'public') {
      return allCollections.filter(c => c.type === 'public');
    } else if (viewMode === 'my-collections') {
      return allCollections.filter(c => c.type === 'collection' || c.type === 'product');
    }

    return allCollections;
  }, [publicCollections, collections, productImages, viewMode]);

  const selectedItem = combinedCollections.find(c =>
    c.id === selectedCollectionId ||
    (c.type === 'product' && c.product_id === selectedProductId)
  );

  const handleClose = () => {
    setSelectedCollectionId(null);
    setSelectedProductId(null);
    setSelectedType(null);
    setImageLoadErrors(new Set());
    onClose();
  };

  // Enable escape key to close modal
  useEscapeKey(handleClose, isOpen);

  const handleImageSelect = (imageId: string, filePathOrStoragePath: string, isProductImage: boolean = false) => {
    const imageUrl = getImageUrl(filePathOrStoragePath);
    onImageSelect(imageUrl, imageId, isProductImage);
    handleClose();
  };

  const handlePublicImageSelect = (imageId: string, storagePath: string) => {
    const imageUrl = getPublicImageUrlFromPath(storagePath);
    onImageSelect(imageUrl, imageId, false);
    handleClose();
  };

  const handleCollectionSelect = (item: typeof combinedCollections[0]) => {
    if (item.type === 'collection') {
      setSelectedType('collection');
      setSelectedCollectionId(item.id);
      setSelectedProductId(null);
    } else if (item.type === 'public') {
      setSelectedType('public');
      setSelectedCollectionId(item.id);
      setSelectedProductId(null);
    } else {
      setSelectedType('product');
      setSelectedProductId(item.product_id);
      setSelectedCollectionId(null);
    }
    setImageLoadErrors(new Set());
  };

  const handleBackToCollections = () => {
    setSelectedCollectionId(null);
    setSelectedProductId(null);
    setSelectedType(null);
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
            {selectedItem && (
              <button
                onClick={handleBackToCollections}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                <ArrowLeftIcon />
              </button>
            )}
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text)]">
                {selectedItem ? selectedItem.name : title}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {selectedItem ? `Choose an image from ${selectedItem.type === 'product' ? 'this product' : 'this collection'}` : 'Choose a collection to browse images'}
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

        {/* View Mode Buttons */}
        {!selectedItem && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => handleViewModeChange('my-collections')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'my-collections'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              My Collections
            </button>
            <button
              onClick={() => handleViewModeChange('public')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'public'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              Public
            </button>
          </div>
        )}

        {/* Content */}
        {!selectedItem ? (
          // Collections View
          <div>
            {collectionsLoading || publicCollectionsLoading || productImagesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : combinedCollections.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {combinedCollections.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleCollectionSelect(item)}
                    className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary)] hover:shadow-lg transition-all duration-200 text-left"
                  >
                    <div className="flex flex-col text-center">
                      <div className="mb-3">
                        <CollectionThumbnail collection={item} />
                      </div>
                      <h3 className="font-semibold text-[var(--color-text)] text-sm">
                        {item.name}
                      </h3>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        {item.image_count} {item.image_count === 1 ? 'image' : 'images'}
                      </p>
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
                    No collections or products
                  </h3>
                  <p className="text-[var(--color-text-muted)]">
                    Create some image collections or add product images to use as backgrounds.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Images View
          <div>
            {(imagesLoading && selectedItem?.type === 'collection') || (publicImagesLoading && selectedItem?.type === 'public') || (productImagesLoading && selectedItem?.type === 'product') ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : selectedItem?.type === 'collection' ? (
              // Regular collection images
              images.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {images.map((image) => {
                    const path = (image as any).storage_path || (image as any).file_path || '';
                    const imageUrl = path ? getImageUrl(path) : '';
                    const hasError = imageLoadErrors.has(image.id);

                    return (
                      <button
                        key={image.id}
                        onClick={() => handleImageSelect(image.id, path, false)}
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
              )
            ) : selectedItem?.type === 'public' ? (
              publicImages.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {publicImages.map((image) => {
                    const imageUrl = image.storage_path ? getPublicImageUrlFromPath(image.storage_path) : '';
                    const hasError = imageLoadErrors.has(image.id);

                    return (
                      <button
                        key={image.id}
                        onClick={() => handlePublicImageSelect(image.id, image.storage_path)}
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
              )
            ) : (
              // Product images
              selectedItem?.sample_images && selectedItem.sample_images.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {selectedItem.sample_images.map((image) => {
                    const imageUrl = image.storage_path ? getImageUrl(image.storage_path) : '';
                    const hasError = imageLoadErrors.has(image.id);

                    return (
                      <button
                        key={image.id}
                        onClick={() => handleImageSelect(image.id, image.storage_path, true)}
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
                            alt={`${selectedItem.name} image`}
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
                      No images for this product
                    </h3>
                    <p className="text-[var(--color-text-muted)]">
                      Add some images to this product to use as backgrounds.
                    </p>
                  </div>
                </div>
              )
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