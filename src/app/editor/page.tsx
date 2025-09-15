'use client';

import React, { Suspense } from 'react';
import Sidebar from '../../components/Sidebar';
import dynamicImport from 'next/dynamic';

export const dynamic = 'force-dynamic';

const SlideshowEditor = dynamicImport(() => import('../../components/SlideshowEditor'), {
  ssr: false,
  loading: () => <div className="p-6 text-[var(--color-text-muted)]">Loading editor…</div>,
});

export default function EditorPage() {
  return (
    <div className="flex h-screen bg-[var(--color-bg)]">
      <Sidebar />
      <div className="flex-1">
        <Suspense fallback={<div className="p-6 text-[var(--color-text-muted)]">Loading editor…</div>}>
          <SlideshowEditor />
        </Suspense>
      </div>
    </div>
  );
} 