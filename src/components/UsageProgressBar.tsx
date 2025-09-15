interface UsageProgressBarProps {
  current: number;
  max: number;
  label: string;
  remaining?: number;
}

export default function UsageProgressBar({ current, max, label, remaining }: UsageProgressBarProps) {
  const percentage = Math.min((current / max) * 100, 100);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
        <span className="text-sm text-[var(--color-text)] font-medium">
          {current} / {max}
          {remaining !== undefined && (
            <span className="text-[var(--color-text-muted)] ml-2">
              ({remaining} remaining)
            </span>
          )}
        </span>
      </div>
      <div className="relative">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
