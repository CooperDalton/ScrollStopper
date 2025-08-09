'use client';

export default function EmptyState() {
  return (
    <div className="w-full flex items-center justify-center">
      <div className="text-center text-[var(--color-text-muted)]">
        <p className="text-lg font-medium">Create a new slideshow to start editing</p>
        <p className="text-sm mt-2">Use the button in the left panel to make a new draft.</p>
      </div>
    </div>
  );
}


