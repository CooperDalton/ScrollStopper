'use client';

import useSWR from 'swr';
import { useMemo } from 'react';

type PublicImage = {
  id: string;
  storage_path: string;
  created_at: string;
  width?: number | null;
  height?: number | null;
  mime_type?: string | null;
  bytes?: number | null;
  categories?: string[] | null;
  objects?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

export function usePublicImages(collectionId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ images: PublicImage[] }>(
    collectionId ? `/api/public/collections/${collectionId}/images` : null,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch public images');
      return res.json();
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  const images = useMemo(() => data?.images || [], [data?.images]);

  return { images, error, isLoading, refresh: mutate };
}


