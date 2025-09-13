'use client';

import useSWR from 'swr';
import { useMemo } from 'react';

type PublicCollection = {
  id: string;
  name: string;
  created_at: string;
  sample_images?: Array<{ id: string; storage_path: string; created_at: string }>;
  image_count?: number;
  type?: 'public';
};

export function usePublicCollections() {
  const { data, error, isLoading, mutate } = useSWR<{ collections: PublicCollection[] }>(
    '/api/public/collections',
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch public collections');
      return res.json();
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  const collections = useMemo(() => {
    const list = data?.collections || [];
    return list.map((c) => ({ ...c, type: 'public' as const }));
  }, [data?.collections]);

  return {
    collections,
    error,
    isLoading,
    refresh: mutate,
  };
}


