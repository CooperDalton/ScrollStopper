'use client';

export default function DeleteButtonOverlay({ show, onDelete }: { show: boolean; onDelete: () => void }) {
  if (!show) return null;
  return (
    <div className="absolute -top-20 left-67 z-20">
      <button
        onClick={onDelete}
        className="flex items-center justify-center w-12 h-12 bg-gray-100 hover:bg-gray-200 text-red-500 rounded-full shadow-lg transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1H9a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}


