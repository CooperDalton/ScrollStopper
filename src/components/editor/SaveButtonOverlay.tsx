'use client';

export default function SaveButtonOverlay({ show, onSave, isSaving }: { show: boolean; onSave: () => void; isSaving: boolean }) {
  if (!show) return null;
  return (
    <div className="absolute -top-19 right-55 z-20">
      <button
        onClick={onSave}
        disabled={isSaving}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white rounded-xl shadow-lg transition-colors font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}


