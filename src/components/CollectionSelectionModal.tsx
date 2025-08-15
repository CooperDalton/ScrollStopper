'use client';

import React, { useState, useMemo } from 'react';
import { useCollections } from '@/hooks/useCollections';

interface CollectionSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (collectionIds: string[]) => void;
  title?: string;
}

const XIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function CollectionSelectionModal({ isOpen, onClose, onSelect, title = 'Select Collections' }: CollectionSelectionModalProps) {
  const { collections, isLoading } = useCollections();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allIds = useMemo(() => new Set(collections.map((c: any) => c.id)), [collections]);
  const allSelected = selected.size > 0 && selected.size === allIds.size;

  if (!isOpen) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === allIds.size) return new Set();
      return new Set(allIds);
    });
  };

  const apply = () => onSelect(Array.from(selected));

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div 
        className="relative bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)] p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">{title}</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Pick one or more collections to include in generation.</p>
          </div>
          <button onClick={onClose} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
            <XIcon />
          </button>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-[var(--color-text-muted)]">{selected.size} selected</div>
          <button onClick={toggleAll} className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-tertiary)] transition-colors">
            {allSelected ? 'Clear All' : 'Select All'}
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : collections.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {collections.map((c: any) => (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`p-4 rounded-xl border transition-colors text-left ${selected.has(c.id) ? 'border-[var(--color-primary)] bg-[var(--color-bg-tertiary)]' : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-[var(--color-text)]">{c.name}</div>
                  <input type="checkbox" readOnly checked={selected.has(c.id)} className="w-4 h-4" />
                </div>
                {typeof c.image_count === 'number' && (
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">{c.image_count} images</div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-[var(--color-text-muted)]">No collections</div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]">Cancel</button>
          <button onClick={apply} className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white">Use Selected</button>
        </div>
      </div>
    </div>
  );
}
