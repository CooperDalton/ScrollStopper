'use client';

import React from 'react';
import { useProducts } from '@/hooks/useProducts';

export default function AISidebar({ onGenerate }: { onGenerate?: () => void }) {
  const { products, isLoading, isError } = useProducts();
  const [prompt, setPrompt] = React.useState('');
  const [selectedProductId, setSelectedProductId] = React.useState<string>('');

  const PROMPT_KEY = 'aiEditorPrompt';
  const PRODUCT_KEY = 'aiEditorSelectedProductId';

  // Load saved values on mount
  React.useEffect(() => {
    try {
      const savedPrompt = localStorage.getItem(PROMPT_KEY);
      if (savedPrompt !== null) setPrompt(savedPrompt);
      const savedProductId = localStorage.getItem(PRODUCT_KEY);
      if (savedProductId) setSelectedProductId(savedProductId);
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
        {isLoading ? (
          <div className="text-sm text-[var(--color-text-muted)]">Loading products…</div>
        ) : isError ? (
          <div className="text-sm text-red-500">Failed to load products</div>
        ) : (
          <select
            id="ai-product"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            {products.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="p-4 border-b border-[var(--color-border)] space-y-2">
        <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="ai-prompt">
          Prompt
        </label>
        <textarea
          id="ai-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what to generate (tone, style, hooks, goals)"
          className="w-full min-h-28 p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
      </div>

      <div className="p-4 mt-auto border-t border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => { onGenerate?.(); }}
          className="w-full p-3 bg-[var(--color-primary)] text-white rounded-xl hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate
        </button>
      </div>
    </div>
  );
}


