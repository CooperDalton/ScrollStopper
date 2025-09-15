'use client'

import { SWRConfig } from 'swr'
import { toast } from '@/lib/toast'

interface SWRProviderProps {
  children: React.ReactNode
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher: async (url: string) => {
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return res.json();
          }
          // If not JSON, throw an error rather than trying to parse as JSON
          throw new Error(`Expected JSON response but got ${contentType || 'unknown content type'}`);
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : 'Request failed';
          toast.error(message);
        },
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
      }}
    >
      {children}
    </SWRConfig>
  )
} 
