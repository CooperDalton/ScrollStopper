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
    removeImage,
    refresh: mutate,
  };
} 