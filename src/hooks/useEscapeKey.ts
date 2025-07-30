'use client';

import { useEffect } from 'react';

export function useEscapeKey(onEscape: () => void, isEnabled: boolean = true) {
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onEscape, isEnabled]);
} 