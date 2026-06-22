// ── Pan / zoom ──
// Attaches drag-to-pan + wheel-to-zoom (mouse) and one-finger drag + two-finger
// pinch-to-zoom (touch) to an <img>/layer inside a viewport element. Returns a
// handle with reset() and a detach() that removes window listeners.

export interface PanZoomHandle {
  zoomIn(): void;
  zoomOut(): void;
  setFitScale(scale: number): void;
  reset(): void;
  setPanEnabled(enabled: boolean): void;
  /** Returns the current transform so external renderers (e.g. a canvas
   *  overlay) can draw in viewport-space coordinates. */
  getTransform(): { scale: number; tx: number; ty: number };
  detach(): void;
}

export function attachPanZoom(
  viewport: HTMLElement,
  img: HTMLElement,
  opts: { min?: number; max?: number; step?: number; onTransform?: () => void } = {},
): PanZoomHandle {
  let min = opts.min ?? 0.5;
  const max = opts.max ?? 6;
  const step = opts.step ?? 0.1;

  // Base scale that reset() returns to. 1 = layer rendered at display size; for
  // a natural-size layer this is set below 1 to fit it into the viewport.
  let fitScale = 1;
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let panEnabled = true;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startTx = 0;
  let startTy = 0;

  // Pinch state (two-finger): distance + scale captured at gesture start.
  let pinching = false;
  let pinchStartDist = 0;
  let pinchStartScale = 1;

  function apply(): void {
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    opts.onTransform?.();
  }

  // Zoom to `nextScale` while keeping the screen point (fx, fy) fixed under the
  // cursor/fingers. The img's transform-origin is its centre, so we work in
  // coordinates relative to the viewport centre.
  function zoomTo(nextScale: number, fx: number, fy: number): void {
    const clamped = Math.min(max, Math.max(min, nextScale));
    const k = clamped / scale;
    const rect = viewport.getBoundingClientRect();
    const fxr = fx - (rect.left + rect.width / 2);
    const fyr = fy - (rect.top + rect.height / 2);
    tx = fxr - k * (fxr - tx);
    ty = fyr - k * (fyr - ty);
    scale = clamped;
    apply();
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    zoomTo(scale + (e.deltaY > 0 ? -step : step), e.clientX, e.clientY);
  }

  // ── Mouse drag ──
  function onMouseDown(e: MouseEvent): void {
    if (e.button !== 0 || !panEnabled) return;
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

  // ── Touch drag + pinch ──
  function touchDist(t0: Touch, t1: Touch): number {
    return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
  }
  function onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 2) {
      e.preventDefault();
      pinching = true;
      dragging = false;
      pinchStartDist = touchDist(e.touches[0], e.touches[1]);
      pinchStartScale = scale;
    } else if (e.touches.length === 1 && panEnabled) {
      e.preventDefault();
      dragging = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTx = tx;
      startTy = ty;
    }
  }
  function onTouchMove(e: TouchEvent): void {
    if (pinching && e.touches.length === 2) {
      e.preventDefault();
      const dist = touchDist(e.touches[0], e.touches[1]);
      if (pinchStartDist > 0) {
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        zoomTo(pinchStartScale * (dist / pinchStartDist), midX, midY);
      }
    } else if (dragging && e.touches.length === 1) {
      e.preventDefault();
      tx = startTx + (e.touches[0].clientX - startX);
      ty = startTy + (e.touches[0].clientY - startY);
      apply();
    }
  }
  function onTouchEnd(e: TouchEvent): void {
    if (e.touches.length === 0) { dragging = false; pinching = false; }
    else if (e.touches.length === 1 && pinching) {
      // Lifting one finger of a pinch — continue as a one-finger drag.
      pinching = false;
      dragging = panEnabled;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTx = tx;
      startTy = ty;
    }
  }

  viewport.style.cursor = 'grab';
  viewport.style.touchAction = 'none';
  viewport.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('mousedown', onMouseDown);
  viewport.addEventListener('touchstart', onTouchStart, { passive: false });
  viewport.addEventListener('touchmove', onTouchMove, { passive: false });
  viewport.addEventListener('touchend', onTouchEnd);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  function bump(direction: 1 | -1): void {
    const rect = viewport.getBoundingClientRect();
    zoomTo(scale + direction * step * 2, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  return {
    zoomIn()  { bump(1); },
    zoomOut() { bump(-1); },
    getTransform() { return { scale, tx, ty }; },
    setFitScale(s: number) {
      fitScale = s;
      // Allow zooming/resetting below the default floor so the whole map fits.
      min = Math.min(min, s);
      scale = s;
      tx = 0;
      ty = 0;
      apply();
    },
    reset() {
      scale = fitScale;
      tx = 0;
      ty = 0;
      apply();
    },
    setPanEnabled(enabled: boolean) {
      panEnabled = enabled;
      viewport.style.cursor = enabled ? 'grab' : 'default';
    },
    detach() {
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('mousedown', onMouseDown);
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}
