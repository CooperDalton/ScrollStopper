'use client';

import React from 'react';
import SlideshowEditor from '../../components/SlideshowEditor';
import Sidebar from '../../components/Sidebar';

export default function EditorPage() {
  return (
    <div className="flex h-screen bg-[var(--color-bg)]">
      <Sidebar />
      <div className="flex-1">
        <SlideshowEditor />
      </div>
    </div>
  );
} 