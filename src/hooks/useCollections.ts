'use client';

import useSWR from 'swr';
import { useMemo } from 'react';
import { ImageCollection, getUserCollections, createCollection, deleteCollection, CreateCollectionData } from '@/lib/images';

// Stable empty array to prevent unnecessary re-renders
const EMPTY_COLLECTIONS: ImageCollection[] = [];

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

  // Use a stable empty array reference to prevent unnecessary re-renders
  const collections = useMemo(() => {
    return data?.collections || EMPTY_COLLECTIONS;
  }, [data?.collections]);

  return {
    collections,
    error,
    isLoading,
    addCollection,
    removeCollection,
    refresh: mutate,
  };
} 