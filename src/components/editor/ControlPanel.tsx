'use client';

import React from 'react';

export interface ControlPanelProps {
  onBackground: () => void;
  onAddText: () => void;
  onAddImage: () => void;
  onDuration: () => void;
  durationLabel: string;
  onCreate: () => void;
  BackgroundIcon: React.ComponentType;
  TextIcon: React.ComponentType;
  ImageIcon: React.ComponentType;
}

export default function ControlPanel({
  onBackground,
  onAddText,
  onAddImage,
  onDuration,
  durationLabel,
  onCreate,
  BackgroundIcon,
  TextIcon,
  ImageIcon
}: ControlPanelProps) {
  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <button onClick={onBackground} className="p-3 bg-gray-100 text-black rounded-xl hover:bg-gray-200 transition-colors" title="Background">
            <BackgroundIcon />
          </button>
          <button onClick={onAddText} className="p-3 bg-gray-100 text-black rounded-xl hover:bg-gray-200 transition-colors" title="Add Text">
            <TextIcon />
          </button>
          <button onClick={onAddImage} className="p-3 bg-gray-100 text-black rounded-xl hover:bg-gray-200 transition-colors" title="Add Image">
            <ImageIcon />
          </button>
          <button onClick={onDuration} className="px-4 py-2 bg-gray-100 text-black rounded-xl hover:bg-gray-200 transition-colors cursor-pointer" title="Slide Duration">
            {durationLabel}
          </button>
          <button onClick={onCreate} className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors" title="Create">
            Create
          </button>
        </div>
      </div>
    </div>
  );
}


