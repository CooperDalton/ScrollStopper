'use client';

import React from 'react';
import AspectRatioPicker from '@/components/editor/AspectRatioPicker';
import { useProducts } from '@/hooks/useProducts';
import { useCollections } from '@/hooks/useCollections';
import { usePublicCollections } from '@/hooks/usePublicCollections';

export default function AISidebar({
  onGenerate,
  onAddRow,
  onRunGenerate,
  onSelectImages,
  aspectRatio,
  onAspectRatioChange,
  selectedCollectionIds,
  selectedPublicCollectionIds,
}: {
  onGenerate?: () => void;
  onAddRow?: () => void;
  onRunGenerate?: (args: { productId: string; prompt: string }) => void;
  onSelectImages?: () => void;
  aspectRatio?: string;
  onAspectRatioChange?: (val: string) => void;
  selectedCollectionIds?: string[];
  selectedPublicCollectionIds?: string[];
}) {
  const { products, isLoading, isError } = useProducts();
  const { collections } = useCollections();
  const { collections: publicCollections } = usePublicCollections();
  const [prompt, setPrompt] = React.useState('');
  const [selectedProductId, setSelectedProductId] = React.useState<string>('');
  const [lastUsedPrompt, setLastUsedPrompt] = React.useState<string>('');

  const PROMPT_KEY = 'aiEditorPrompt';
  const PRODUCT_KEY = 'aiEditorSelectedProductId';
  const LAST_USED_PROMPT_KEY = 'aiEditorLastUsedPrompt';

  // Load saved values on mount
  React.useEffect(() => {
    try {
      const savedPrompt = localStorage.getItem(PROMPT_KEY);
      if (savedPrompt !== null) setPrompt(savedPrompt);
      const savedProductId = localStorage.getItem(PRODUCT_KEY);
      if (savedProductId) setSelectedProductId(savedProductId);
      const savedLastUsedPrompt = localStorage.getItem(LAST_USED_PROMPT_KEY);
      if (savedLastUsedPrompt) setLastUsedPrompt(savedLastUsedPrompt);
    } catch (_) {
      // noop
    }
  }, []);

  // Validate/fallback selected product when products load
  React.useEffect(() => {
    if (!products || products.length === 0) return;
    if (!selectedProductId) {
      setSelectedProductId(products[0].id);
      return;
    }
    const exists = products.some((p: any) => p.id === selectedProductId);
    if (!exists) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProductId]);

  // Persist changes
  React.useEffect(() => {
    try {
      localStorage.setItem(PROMPT_KEY, prompt);
    } catch (_) {}
  }, [prompt]);

  React.useEffect(() => {
    try {
      if (selectedProductId) localStorage.setItem(PRODUCT_KEY, selectedProductId);
    } catch (_) {}
  }, [selectedProductId]);

  // Listen for changes to the last used prompt (when generation happens)
  React.useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LAST_USED_PROMPT_KEY && e.newValue) {
        setLastUsedPrompt(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <div className="w-80 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col flex-shrink-0">
      <div className="p-6 border-b border-[var(--color-border)]">
        <h2 className="text-xl font-bold text-[var(--color-text)]">AI Controls</h2>
        <p className="text-sm text-[var(--color-text-muted)]">Configure generation inputs</p>
      </div>

      <div className="p-4 border-b border-[var(--color-border)] space-y-2">
        <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="ai-product">
          Product
        </label>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="text-sm text-[var(--color-text-muted)]">Loading products…</div>
          ) : isError ? (
            <div className="text-sm text-red-500">Failed to load products</div>
          ) : (
            <select
              id="ai-product"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              {products.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <AspectRatioPicker
            value={aspectRatio || '9:16'}
            onChange={(val) => onAspectRatioChange?.(val)}
          />
        </div>
        <div>
          <button
            type="button"
            onClick={() => onSelectImages?.()}
            className="mt-2 w-full p-3 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            Select Images
          </button>
          {(selectedCollectionIds && selectedCollectionIds.length > 0) || (selectedPublicCollectionIds && selectedPublicCollectionIds.length > 0) ? (
            <div className="mt-2 space-y-1">
              <div className="text-xs font-medium text-[var(--color-text-muted)]">Selected Collections:</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {selectedCollectionIds?.map((collectionId) => {
                  const collection = collections.find(c => c.id === collectionId);
                  return (
                    <div key={collectionId} className="text-xs text-[var(--color-text)] bg-[var(--color-bg-tertiary)] px-2 py-1 rounded-md">
                      {collection?.name || `Collection ${collectionId.slice(0, 8)}...`}
                    </div>
                  );
                })}
                {selectedPublicCollectionIds?.map((collectionId) => {
                  const collection = (publicCollections || []).find(c => c.id === collectionId);
                  return (
                    <div key={collectionId} className="text-xs text-[var(--color-text)] bg-[var(--color-bg-tertiary)] px-2 py-1 rounded-md">
                      {collection?.name || `Public ${collectionId.slice(0, 8)}...`}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="p-4 space-y-2 flex-1 flex flex-col">
        <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="ai-prompt">
          Prompt
        </label>
        <textarea
          id="ai-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what to generate (tone, style, hooks, goals)"
          className="w-full flex-1 p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
        />
        {lastUsedPrompt && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 text-xs text-[var(--color-text-muted)] truncate">
              Last used: &ldquo;{lastUsedPrompt.length > 30 ? lastUsedPrompt.slice(0, 30) + '...' : lastUsedPrompt}&rdquo;
            </div>
            <button
              type="button"
              onClick={() => setPrompt(lastUsedPrompt)}
              className="px-2 py-1 text-xs bg-[var(--color-bg-tertiary)] text-[var(--color-text)] rounded-md hover:bg-[var(--color-bg)] transition-colors"
              title="Load last used prompt"
            >
              Load
            </button>
          </div>
        )}
      </div>



      <div className="p-4 mt-auto border-t border-[var(--color-border)] space-y-2">
        {/* Temporary button to add a new row above current rows */}
        <button
          type="button"
          onClick={() => { onAddRow?.(); }}
          className="w-full p-3 bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg-tertiary)] transition-colors"
        >
          Add Row (temp)
        </button>
        <button
          type="button"
          onClick={() => {
            if (onRunGenerate) onRunGenerate({ productId: selectedProductId, prompt });
            else onGenerate?.();
          }}
          className="w-full p-3 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate
        </button>
      </div>
    </div>
  );
}


