'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useCollections } from '@/hooks/useCollections';
import { usePublicCollections } from '@/hooks/usePublicCollections';
import CollectionThumbnail from './CollectionThumbnail';

interface CollectionSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (payload: { userCollectionIds: string[]; publicCollectionIds: string[] }) => void;
  title?: string;
}

const XIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function CollectionSelectionModal({ isOpen, onClose, onSelect, title = 'Select Collections' }: CollectionSelectionModalProps) {
  const { collections, isLoading } = useCollections();
  const { collections: publicCollections, isLoading: loadingPublic } = usePublicCollections();
  const [tab, setTab] = useState<'my' | 'public'>('my');
  const [selectedUser, setSelectedUser] = useState<Set<string>>(new Set());
  const [selectedPublic, setSelectedPublic] = useState<Set<string>>(new Set());
  const [hasLoadedInitialSelection, setHasLoadedInitialSelection] = useState<boolean>(false);

  // Load saved selections when opening (only once per modal open)
  useEffect(() => {
    if (!isOpen) {
      setHasLoadedInitialSelection(false);
      return;
    }
    
    // Only load once per modal opening and when collections are available
    if (hasLoadedInitialSelection) return;
    
    try {
      const rawUser = localStorage.getItem('aiEditorSelectedUserCollectionIds')
      if (rawUser) {
        const ids = JSON.parse(rawUser) as string[]
        const available = new Set((collections || []).map((c: any) => c.id))
        const valid = ids.filter((id) => available.has(id))
        setSelectedUser(new Set(valid))
      }
      const rawPublic = localStorage.getItem('aiEditorSelectedPublicCollectionIds')
      if (rawPublic) {
        const ids = JSON.parse(rawPublic) as string[]
        const available = new Set((publicCollections || []).map((c: any) => c.id))
        const valid = ids.filter((id) => available.has(id))
        setSelectedPublic(new Set(valid))
      }
      setHasLoadedInitialSelection(true);
    } catch {
      setHasLoadedInitialSelection(true);
    }
  }, [isOpen, collections.length, publicCollections?.length, hasLoadedInitialSelection])

  const allUserIds = useMemo(() => new Set(collections.map((c: any) => c.id)), [collections]);
  const allPublicIds = useMemo(() => new Set((publicCollections || []).map((c: any) => c.id)), [publicCollections]);
  const allSelectedCurrent = tab === 'my'
    ? (selectedUser.size > 0 && selectedUser.size === allUserIds.size)
    : (selectedPublic.size > 0 && selectedPublic.size === allPublicIds.size);

  if (!isOpen) return null;

  const toggle = (id: string) => {
    if (tab === 'my') {
      setSelectedUser((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSelectedPublic((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };

  const toggleAll = () => {
    if (tab === 'my') {
      setSelectedUser((prev) => {
        if (prev.size === allUserIds.size) return new Set();
        return new Set(allUserIds);
      });
    } else {
      setSelectedPublic((prev) => {
        if (prev.size === allPublicIds.size) return new Set();
        return new Set(allPublicIds);
      });
    }
  };

  const apply = () => {
    const userIds = Array.from(selectedUser)
    const pubIds = Array.from(selectedPublic)
    onSelect({ userCollectionIds: userIds, publicCollectionIds: pubIds })
    try {
      localStorage.setItem('aiEditorSelectedUserCollectionIds', JSON.stringify(userIds))
      localStorage.setItem('aiEditorSelectedPublicCollectionIds', JSON.stringify(pubIds))
    } catch {}
    onClose()
  };

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
          <div className="text-sm text-[var(--color-text-muted)]">{tab === 'my' ? selectedUser.size : selectedPublic.size} selected</div>
          <button onClick={toggleAll} className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-tertiary)] transition-colors">
            {allSelectedCurrent ? 'Clear All' : 'Select All'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('my')}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${tab === 'my' ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-[var(--color-bg)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]'}`}
          >
            My Collections
          </button>
          <button
            onClick={() => setTab('public')}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${tab === 'public' ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-[var(--color-bg)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]'}`}
          >
            Public
          </button>
        </div>

        {isLoading || loadingPublic ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (tab === 'my' ? collections : (publicCollections || [])).length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(tab === 'my' ? collections : (publicCollections || [])).map((c: any) => (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`p-4 rounded-xl border transition-colors text-left ${(tab === 'my' ? selectedUser.has(c.id) : selectedPublic.has(c.id)) ? 'border-[var(--color-primary)] bg-[var(--color-bg-tertiary)]' : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'}`}
              >
                <div className="flex flex-col">
                  <div className="mb-3">
                    <CollectionThumbnail collection={c} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-[var(--color-text)]">{c.name}</div>
                    <input type="checkbox" readOnly checked={tab === 'my' ? selectedUser.has(c.id) : selectedPublic.has(c.id)} className="w-4 h-4" />
                  </div>
                  {typeof c.image_count === 'number' && (
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">{c.image_count} images</div>
                  )}
                </div>
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
