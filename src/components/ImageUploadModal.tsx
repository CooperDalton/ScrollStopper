'use client';

import React, { useState, useRef } from 'react';
import { ImageCollection } from '@/lib/images';
import { getImageUrl } from '@/lib/images';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useCollections } from '@/hooks/useCollections';

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: ImageCollection | null;
  onUpload: (file: File) => Promise<void>;
  onBatchUpload?: (files: File[], onProgress?: (completed: number, total: number, current?: string) => void) => Promise<void>;
  onDelete: (imageId: string) => Promise<void>;
  images: Array<{ id: string; file_path?: string; storage_path?: string; created_at: string }>;
  isLoading?: boolean;
  onCollectionDeleted?: () => void;
}

const XIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const UploadIcon = () => (
  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const ImageIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const LargeTrashIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export default function ImageUploadModal({ isOpen, onClose, collection, onUpload, onBatchUpload, onDelete, images, isLoading, onCollectionDeleted }: ImageUploadModalProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());
  const [deletingImages, setDeletingImages] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<{total: number, completed: number, current?: string}>({ total: 0, completed: 0 });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { removeCollection } = useCollections();

  const handleFileSelect = async (files: FileList | null) => {
    if (uploading) {
      setError('Please wait for the current upload to finish before adding more images.');
      return;
    }
    if (!files || files.length === 0) return;

    // Convert FileList to Array for easier handling
    const fileArray = Array.from(files);
    
    // Validate all files
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of fileArray) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        errors.push(`${file.name}: Not a valid image file`);
        continue;
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        errors.push(`${file.name}: File size must be less than 10MB`);
        continue;
      }

      validFiles.push(file);
    }

    // Show validation errors if any
    if (errors.length > 0) {
      setError(errors.join('\n'));
      if (validFiles.length === 0) return;
    } else {
      setError(null);
    }

    setUploading(true);
    setUploadProgress({ total: validFiles.length, completed: 0 });

    try {
      if (validFiles.length === 1) {
        // Single file upload - use existing onUpload function
        setUploadProgress({ total: 1, completed: 0, current: validFiles[0].name });
        await onUpload(validFiles[0]);
        setUploadProgress({ total: 1, completed: 1 });
      } else if (validFiles.length > 1 && onBatchUpload) {
        // Multiple file upload - use batch upload function with progress
        await onBatchUpload(validFiles, (completed, total, current) => {
          setUploadProgress({ total, completed, current });
        });
      } else if (validFiles.length > 1) {
        // Fallback: upload files one by one if no batch upload function
        for (let i = 0; i < validFiles.length; i++) {
          const file = validFiles[i];
          setUploadProgress({ total: validFiles.length, completed: i, current: file.name });
          await onUpload(file);
        }
        setUploadProgress({ total: validFiles.length, completed: validFiles.length });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload images');
    } finally {
      setUploading(false);
      setUploadProgress({ total: 0, completed: 0 });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (uploading) return;
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (uploading) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (uploading) return;
    setIsDragOver(false);
  };

  const handleImageDelete = async (imageId: string) => {
    setDeletingImages(prev => new Set(prev).add(imageId));
    try {
      await onDelete(imageId);
    } catch (err) {
      console.error('Failed to delete image:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    } finally {
      setDeletingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(imageId);
        return newSet;
      });
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setError(null);
      setImageLoadErrors(new Set());
      setDeletingImages(new Set());
      setShowDeleteConfirm(false);
      onClose();
    }
  };

  const handleDeleteCollection = async () => {
    if (!collection?.id) return;
    
    try {
      await removeCollection(collection.id);
      setShowDeleteConfirm(false);
      onCollectionDeleted?.();
      onClose();
    } catch (error) {
      console.error('Failed to delete collection:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete collection');
    }
  };

  // Enable escape key to close modal
  useEscapeKey(handleClose, isOpen);

  const handleFileInputClick = () => {
    if (uploading) return;
    fileInputRef.current?.click();
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
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">
              {collection?.name || 'Upload Images'}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Upload images to this collection
            </p>
          </div>
          <div className="flex items-center gap-2">
            {collection && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={uploading}
                className="p-2 text-[var(--color-text-muted)] hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 hover:bg-opacity-10 disabled:opacity-50"
                title="Delete collection"
              >
                <LargeTrashIcon />
              </button>
            )}
            <button
              onClick={handleClose}
              disabled={uploading}
              className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors disabled:opacity-50"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* Upload Area */}
        <div className="mb-6">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleFileInputClick}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragOver
                ? 'border-[var(--color-primary)] bg-[var(--color-bg-tertiary)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)]'
            } ${uploading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
          >
            <div className="flex flex-col items-center">
              {uploading ? (
                <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <UploadIcon />
              )}
              <h3 className="text-lg font-medium text-[var(--color-text)] mt-4">
                {uploading ? 'Uploading...' : 'Upload images'}
              </h3>
              <p className="text-[var(--color-text-muted)] mt-2">
                {uploading 
                  ? (uploadProgress.total > 1 
                      ? `Uploading ${uploadProgress.completed + 1} of ${uploadProgress.total}${uploadProgress.current ? `: ${uploadProgress.current}` : ''}` 
                      : 'Please wait while your image is uploaded')
                  : 'Drag and drop or click to select (multiple files supported)'
                }
              </p>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Supports: JPG, PNG, GIF, WebP (Max 10MB each)
              </p>
              {uploading && uploadProgress.total > 1 && (
                <div className="w-full max-w-xs mt-4">
                  <div className="bg-[var(--color-bg-secondary)] rounded-full h-2">
                    <div 
                      className="bg-[var(--color-primary)] h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${(uploadProgress.completed / uploadProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 text-center">
                    {uploadProgress.completed} / {uploadProgress.total} completed
                  </p>
                </div>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            disabled={uploading}
          />

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Images Grid */}
        {images.length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-[var(--color-text)] mb-4 flex items-center gap-2">
              <ImageIcon />
              Images ({images.length})
            </h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {images.map((image) => {
                  const path = image.storage_path || image.file_path || '';
                  const imageUrl = path ? getImageUrl(path) : '';
                  const hasError = imageLoadErrors.has(image.id);
                  const isDeleting = deletingImages.has(image.id);
                  
                  return (
                    <div
                      key={image.id}
                      className="aspect-[9/16] bg-[var(--color-bg-secondary)] rounded-lg overflow-hidden border border-[var(--color-border)] relative group"
                    >
                      {hasError ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] text-sm">
                          <div className="text-center p-2">
                            <div className="mb-2">❌</div>
                            <div className="font-medium">Failed to load</div>
                            <div className="text-xs mt-1 break-all opacity-75">{path}</div>
                            <div className="text-xs mt-1 break-all opacity-50">{imageUrl}</div>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={imageUrl}
                          alt="Uploaded image"
                          className="w-full h-full object-cover"
                          onError={() => {
                            console.error('Failed to load image:', imageUrl, 'Path:', path);
                            setImageLoadErrors(prev => new Set(prev).add(image.id));
                          }}
                          onLoad={() => {
                            console.log('Successfully loaded image:', imageUrl);
                            setImageLoadErrors(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(image.id);
                              return newSet;
                            });
                          }}
                        />
                      )}
                      
                      {/* Delete button - appears on hover */}
                      <button
                        onClick={() => handleImageDelete(image.id)}
                        disabled={isDeleting || uploading}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed z-10"
                        title="Delete image"
                      >
                        {isDeleting ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <TrashIcon />
                        )}
                      </button>
                      
                      {/* Deleting overlay */}
                      {isDeleting && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                          <div className="text-white text-sm font-medium">Deleting...</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && collection && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div 
            className="relative bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)] p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-[var(--color-text)]">
                Delete Collection
              </h2>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                <XIcon />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-[var(--color-text)] mb-2">
                Are you sure you want to delete <strong>"{collection.name}"</strong>?
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                This action cannot be undone. All images in this collection will also be deleted.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-secondary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCollection}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Collection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 