'use client';

import useSWR from 'swr';
import { Image, getCollectionImages, uploadImageToCollection, deleteImage } from '@/lib/images';

export function useImages(collectionId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ images: Image[], error: null }>(
    collectionId ? `images-${collectionId}` : null,
    async () => {
      if (!collectionId) return { images: [], error: null };
      const result = await getCollectionImages(collectionId);
      if (result.error) throw result.error;
      return { images: result.images, error: null };
    }
  );

  const uploadImage = async (file: File) => {
    if (!collectionId) throw new Error('No collection selected');
    const result = await uploadImageToCollection(file, collectionId);
    if (result.error) {
      throw result.error;
    }
    // Revalidate the images list
    mutate();
    return result.image;
  };

  const uploadImages = async (files: File[], onProgress?: (completed: number, total: number, current?: string) => void) => {
    if (!collectionId) throw new Error('No collection selected');
    
    const results = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      onProgress?.(i, files.length, file.name);
      
      try {
        const result = await uploadImageToCollection(file, collectionId);
        if (result.error) {
          errors.push(`${file.name}: ${result.error.message}`);
        } else {
          results.push(result.image);
        }
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    onProgress?.(files.length, files.length);
    
    // Revalidate the images list
    mutate();

    if (errors.length > 0) {
      throw new Error(`Some uploads failed:\n${errors.join('\n')}`);
    }

    return results;
  };

  const removeImage = async (imageId: string) => {
    const result = await deleteImage(imageId);
    if (result.error) {
      throw result.error;
    }
    // Revalidate the images list
    mutate();
  };

  return {
    images: data?.images || [],
    error,
    isLoading,
    uploadImage,
    uploadImages,
    removeImage,
    refresh: mutate,
  };
} 