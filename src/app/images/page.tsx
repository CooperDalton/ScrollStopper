'use client';

import React, { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import CollectionModal from '../../components/CollectionModal';
import ImageUploadModal from '../../components/ImageUploadModal';
import { useCollections } from '@/hooks/useCollections';
import { useImages } from '@/hooks/useImages';
import { ImageCollection } from '@/lib/images';

// Icons
const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const FolderIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const ImageIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export default function ImagesPage() {
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<ImageCollection | null>(null);
  
  const { collections, isLoading: collectionsLoading, addCollection, error: collectionsError } = useCollections();
  const { images, isLoading: imagesLoading, uploadImage, removeImage } = useImages(selectedCollection?.id || null);

  const handleCreateCollection = async (name: string) => {
    await addCollection({ name });
  };

  const handleCollectionClick = (collection: ImageCollection) => {
    setSelectedCollection(collection);
    setIsUploadModalOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    await uploadImage(file);
  };

  const handleImageDelete = async (imageId: string) => {
    await removeImage(imageId);
  };

  if (collectionsError) {
    return (
      <DashboardLayout>
        <div className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
              <p className="text-red-600">Failed to load collections. Please try again.</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">Image Collections</h1>
              <p className="text-[var(--color-text-muted)]">
                Organize your images into collections for easy access during slideshow creation
              </p>
            </div>
            <button
              onClick={() => setIsCollectionModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
            >
              <PlusIcon />
              Add Collection
            </button>
          </div>

          {/* Loading State */}
          {collectionsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Collections Grid */}
              {collections.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {collections.map((collection) => (
                    <div
                      key={collection.id}
                      onClick={() => handleCollectionClick(collection)}
                      className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-6 cursor-pointer hover:border-[var(--color-primary)] hover:shadow-lg transition-all duration-200"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-[var(--color-primary)] bg-opacity-10 rounded-lg text-[var(--color-primary)]">
                          <FolderIcon />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-[var(--color-text)] text-lg">
                            {collection.name}
                          </h3>
                          <p className="text-sm text-[var(--color-text-muted)]">
                            Created {new Date(collection.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                        <ImageIcon />
                        <span className="text-sm">Click to manage images</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Empty State */
                <div className="text-center py-12">
                  <div className="max-w-md mx-auto">
                    <div className="w-24 h-24 bg-[var(--color-bg-secondary)] rounded-full flex items-center justify-center mx-auto mb-6">
                      <FolderIcon />
                    </div>
                    <h3 className="text-xl font-semibold text-[var(--color-text)] mb-2">
                      No collections yet
                    </h3>
                    <p className="text-[var(--color-text-muted)] mb-6">
                      Create your first image collection to get started. You can organize your product photos, screenshots, and other images into collections for easy access.
                    </p>
                    <button
                      onClick={() => setIsCollectionModalOpen(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors mx-auto"
                    >
                      <PlusIcon />
                      Create First Collection
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <CollectionModal
        isOpen={isCollectionModalOpen}
        onClose={() => setIsCollectionModalOpen(false)}
        onSubmit={handleCreateCollection}
      />

      <ImageUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setSelectedCollection(null);
        }}
        collection={selectedCollection}
        onUpload={handleImageUpload}
        onDelete={handleImageDelete}
        images={images}
        isLoading={imagesLoading}
      />
    </DashboardLayout>
  );
} 