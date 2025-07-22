'use client';

import useSWR from 'swr';
import { ImageCollection, getUserCollections, createCollection, deleteCollection, CreateCollectionData } from '@/lib/images';

export function useCollections() {
  const { data, error, isLoading, mutate } = useSWR<{ collections: ImageCollection[], error: null }>('collections', async () => {
    const result = await getUserCollections();
    if (result.error) throw result.error;
    return { collections: result.collections, error: null };
  });

  const addCollection = async (collectionData: CreateCollectionData) => {
    const result = await createCollection(collectionData);
    if (result.error) {
      throw result.error;
    }
    // Revalidate the collections list
    mutate();
    return result.collection;
  };

  const removeCollection = async (id: string) => {
    const result = await deleteCollection(id);
    if (result.error) {
      throw result.error;
    }
    // Revalidate the collections list
    mutate();
  };

  return {
    collections: data?.collections || [],
    error,
    isLoading,
    addCollection,
    removeCollection,
    refresh: mutate,
  };
} 