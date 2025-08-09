'use client';

export interface TextResizeOverlayProps {
  visible: boolean;
  position: { x: number; y: number } | null;
  canvasWidth: number;
  canvasHeight: number;
  onDecrease: () => void;
  onIncrease: () => void;
}

export default function TextResizeOverlay({ visible, position, canvasWidth, canvasHeight, onDecrease, onIncrease }: TextResizeOverlayProps) {
  if (!visible || !position) return null;
  return (
    <div
      className="absolute flex items-center gap-2 z-50 pointer-events-none"
      style={{
        left: `${(position.x / canvasWidth) * 100}%`,
        top: `${(position.y / canvasHeight) * 100}%`,
        transform: 'translate(-50%, 0)'
      }}
    >
      <button
        className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors font-bold text-lg shadow-lg pointer-events-auto"
        onClick={(e) => {
          e.stopPropagation();
          onDecrease();
        }}
      >
        −
      </button>
      <button
        className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors font-bold text-lg shadow-lg pointer-events-auto"
        onClick={(e) => {
          e.stopPropagation();
          onIncrease();
        }}
      >
        +
      </button>
    </div>
  );
}


