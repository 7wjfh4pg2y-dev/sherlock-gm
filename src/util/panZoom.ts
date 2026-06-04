// ── Pan / zoom ──
// Attaches drag-to-pan + wheel-to-zoom to an <img> inside a viewport element.
// Returns a handle with reset() and a detach() that removes window listeners.

export interface PanZoomHandle {
  reset(): void;
  detach(): void;
}

export function attachPanZoom(
  viewport: HTMLElement,
  img: HTMLElement,
  opts: { min?: number; max?: number; step?: number } = {},
): PanZoomHandle {
  const min = opts.min ?? 0.5;
  const max = opts.max ?? 6;
  const step = opts.step ?? 0.1;

  let scale = 1;
  let tx = 0;
  let ty = 0;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startTx = 0;
  let startTy = 0;

  function apply(): void {
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    scale = Math.min(max, Math.max(min, scale + (e.deltaY > 0 ? -step : step)));
    apply();
  }
  function onMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startTx = tx;
    startTy = ty;
    viewport.style.cursor = 'grabbing';
  }
  function onMouseMove(e: MouseEvent): void {
    if (!dragging) return;
    tx = startTx + (e.clientX - startX);
    ty = startTy + (e.clientY - startY);
    apply();
  }
  function onMouseUp(): void {
    if (!dragging) return;
    dragging = false;
    viewport.style.cursor = 'grab';
  }

  viewport.style.cursor = 'grab';
  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  return {
    reset() {
      scale = 1;
      tx = 0;
      ty = 0;
      apply();
    },
    detach() {
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}
