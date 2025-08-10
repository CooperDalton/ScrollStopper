'use client';

import useSWR, { mutate as mutateGlobal } from 'swr';
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
    // Optimistically update images list
    mutate((current) => ({
      images: result.image ? [result.image, ...(current?.images || [])] : current?.images || [],
      error: null,
    }), false);

    // Update collections cache: increment count and update thumbnail when < 4
    mutateGlobal('collections', (current: { collections: any[]; error: null } | undefined) => {
      if (!current) return current;
      const updated = current.collections.map((c) => {
        if (c.id !== collectionId) return c;
        const previousCount = c.image_count || 0;
        const newCount = previousCount + 1;
        const previousSamples = Array.isArray(c.sample_images) ? c.sample_images : [];
        const shouldUpdateThumb = newCount <= 4; // only auto-update thumb when collection has < 4 before adding
        const newSamples = shouldUpdateThumb && result.image
          ? [result.image, ...previousSamples].slice(0, 4)
          : previousSamples;
        return { ...c, image_count: newCount, sample_images: newSamples };
      });
      return { ...current, collections: updated };
    }, false);

    // Revalidate images list and collections to ensure consistency
    mutate();
    mutateGlobal('collections');
    return result.image;
  };

  const uploadImages = async (files: File[], onProgress?: (completed: number, total: number, current?: string) => void) => {
    if (!collectionId) throw new Error('No collection selected');
    
    const results: Image[] = [];
    const errors: string[] = [];

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
    
    // Optimistically update images list with all successful uploads
    if (results.length > 0) {
      mutate((current) => ({
        images: [...results, ...(current?.images || [])],
        error: null,
      }), false);

      // Update collections cache counts and thumbnail when < 4
      mutateGlobal('collections', (current: { collections: any[]; error: null } | undefined) => {
        if (!current) return current;
        const updated = current.collections.map((c) => {
          if (c.id !== collectionId) return c;
          const previousCount = c.image_count || 0;
          const newCount = previousCount + results.length;
          const previousSamples = Array.isArray(c.sample_images) ? c.sample_images : [];
          const shouldUpdateThumb = previousCount < 4; // only if it had < 4 before adding
          const imagesToPrepend = shouldUpdateThumb ? results : [];
          const newSamples = shouldUpdateThumb
            ? [...imagesToPrepend, ...previousSamples].slice(0, 4)
            : previousSamples;
          return { ...c, image_count: newCount, sample_images: newSamples };
        });
        return { ...current, collections: updated };
      }, false);
    }

    // Revalidate the images list and collections to ensure consistency with backend
    mutate();
    mutateGlobal('collections');

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
    // Optimistically remove from images list
    mutate((current) => ({
      images: (current?.images || []).filter((img) => img.id !== imageId),
      error: null,
    }), false);

    // Update collections cache: decrement count and prune thumbnail if needed
    mutateGlobal('collections', (current: { collections: any[]; error: null } | undefined) => {
      if (!current) return current;
      const updated = current.collections.map((c) => {
        if (c.id !== collectionId) return c;
        const previousCount = c.image_count || 0;
        const newCount = Math.max(0, previousCount - 1);
        const previousSamples = Array.isArray(c.sample_images) ? c.sample_images : [];
        const newSamples = previousSamples.filter((img: any) => img.id !== imageId);
        return { ...c, image_count: newCount, sample_images: newSamples };
      });
      return { ...current, collections: updated };
    }, false);

    // Revalidate the images list and collections
    mutate();
    mutateGlobal('collections');
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