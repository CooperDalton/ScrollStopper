'use client';

import React, { Suspense } from 'react';
import SlideshowEditor from '../../components/SlideshowEditor';
import Sidebar from '../../components/Sidebar';

export const dynamic = 'force-dynamic';

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