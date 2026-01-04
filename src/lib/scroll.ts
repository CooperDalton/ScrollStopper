// Global scroll configuration and helpers

export const FAST_SCROLL_DURATION_X_MS = 150;
export const FAST_SCROLL_DURATION_Y_MS = 150;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

export const animateScrollX = (element: HTMLElement, targetLeft: number, durationMs: number) => {
  const startLeft = element.scrollLeft;
  const distance = targetLeft - startLeft;
  if (durationMs <= 0 || Math.abs(distance) < 1) {
    element.scrollLeft = targetLeft;
    return;
  }
  const startTime = performance.now();
  const step = () => {
    const now = performance.now();
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / durationMs);
    const eased = easeInOut(progress);
    element.scrollLeft = startLeft + distance * eased;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

export const animateScrollY = (element: HTMLElement, targetTop: number, durationMs: number) => {
  const startTop = element.scrollTop;
  const distance = targetTop - startTop;
  if (durationMs <= 0 || Math.abs(distance) < 1) {
    element.scrollTop = targetTop;
    return;
  }
  const startTime = performance.now();
  const step = () => {
    const now = performance.now();
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / durationMs);
    const eased = easeInOut(progress);
    element.scrollTop = startTop + distance * eased;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};


