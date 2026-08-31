// ── Pan / zoom ──
// Attaches drag-to-pan + scroll-to-pan / pinch-to-zoom and one-finger drag + two-finger
// pinch-to-zoom (touch) to an <img>/layer inside a viewport element. Returns a
// handle with reset() and a detach() that removes window listeners.

export interface PanZoomHandle {
  zoomIn(): void;
  zoomOut(): void;
  setFitScale(scale: number): void;
  /** Nudge the view by a screen-px delta (then re-clamp). */
  panBy(dx: number, dy: number): void;
  /** Re-apply the zoom floor and pan clamp after the viewport changes size
   *  (window resize, rotation, a panel opening). No-op without `bounds`. */
  refit(): void;
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
  opts: {
    min?: number; max?: number; step?: number;
    onTransform?: () => void;
    /** Where the layer's transform-origin sits. Must match its CSS, or the
     *  point under the cursor drifts on every zoom step. Default 'center'. */
    origin?: 'center' | 'top-left';
    /** The layer's intrinsic size in its own px. Supplying it keeps the content
     *  on screen: you cannot pan it away into empty space, and zooming out
     *  stops once the whole thing fits. Requires origin 'top-left'. */
    bounds?: { width: number; height: number };
  } = {},
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
  // How far the last clamp had to pull the layer back. A drag recomputes tx
  // absolutely from startTx every move, so without folding this into the
  // baseline the correction is thrown away on the very next move — which is
  // why wheel-panning clamped but dragging did not.
  let clampDX = 0;
  let clampDY = 0;

  let pinching = false;
  let pinchStartDist = 0;
  let pinchStartScale = 1;

  /** Smallest scale worth allowing: with bounds, the one that just fits the
   *  whole layer in the viewport, so zooming out can never reveal a void. */
  function minScale(): number {
    if (!opts.bounds) return min;
    const r = viewport.getBoundingClientRect();
    if (!r.width || !r.height) return min;
    return Math.min(r.width / opts.bounds.width, r.height / opts.bounds.height);
  }

  /** Keep the layer covering the viewport (or centred, once it is smaller).
   *  Measured from the rendered boxes rather than computed from `bounds`, so it
   *  is correct for EITHER transform-origin — the map uses centre, the board
   *  top-left — and applies to every caller. Without this, the wheel-to-pan
   *  handler could slide a layer off screen with nothing to stop it.
   *  tx/ty are screen-px translations applied after scaling, so a delta
   *  measured on screen can be added to them directly. The rect reflects the
   *  previously applied transform, so a fast gesture can overshoot by one event
   *  and get pulled back — a slight rubber-band, and self-correcting. */
  function clampPan(): boolean {
    clampDX = 0;
    clampDY = 0;
    const vr = viewport.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    if (!vr.width || !ir.width) return false;
    const axis = (i0: number, i1: number, v0: number, v1: number): number => {
      const iSize = i1 - i0, vSize = v1 - v0;
      if (iSize <= vSize) return (v0 + vSize / 2) - (i0 + iSize / 2); // centre it
      if (i0 > v0) return v0 - i0;      // gap on the leading edge
      if (i1 < v1) return v1 - i1;      // gap on the trailing edge
      return 0;
    };
    clampDX = axis(ir.left, ir.right, vr.left, vr.right);
    clampDY = axis(ir.top, ir.bottom, vr.top, vr.bottom);
    tx += clampDX;
    ty += clampDY;
    return clampDX !== 0 || clampDY !== 0;
  }

  function apply(): void {
    // Write first, THEN measure and correct. Measuring before the write reads
    // the previous transform, so the clamp trails a gesture by one event and
    // leaves a gap the size of its last delta sitting at the edge.
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    if (clampPan()) img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    opts.onTransform?.();
  }

  // Zoom to `nextScale` while keeping the screen point (fx, fy) fixed under the
  // cursor/fingers. The img's transform-origin is its centre, so we work in
  // coordinates relative to the viewport centre.
  function zoomTo(nextScale: number, fx: number, fy: number): void {
    const clamped = Math.min(max, Math.max(minScale(), nextScale));
    const k = clamped / scale;
    const rect = viewport.getBoundingClientRect();
    // Focal point expressed relative to the layer's transform-origin. Getting
    // this wrong doesn't look like a zoom bug — the content just slides away
    // from the cursor a little on every step.
    const topLeft = opts.origin === 'top-left';
    const ox = topLeft ? rect.left : rect.left + rect.width / 2;
    const oy = topLeft ? rect.top : rect.top + rect.height / 2;
    const fxr = fx - ox;
    const fyr = fy - oy;
    tx = fxr - k * (fxr - tx);
    ty = fyr - k * (fyr - ty);
    scale = clamped;
    apply();
  }

  // Two-finger trackpad scroll pans; pinch zooms. Browsers report a trackpad
  // pinch as a wheel event with ctrlKey set, so that one check covers both the
  // pinch gesture and a deliberate Ctrl/Cmd+scroll on a mouse. Matches how the
  // newspaper viewer already behaves.
  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      zoomTo(scale + (e.deltaY > 0 ? -step : step), e.clientX, e.clientY);
      return;
    }
    // Deliberately not gated on panEnabled: that flag exists so a drag on the
    // surface doesn't fight a drawing/linking tool, but a wheel gesture can't
    // be mistaken for one — and a dead scroll wheel with no explanation is
    // worse than a board that moves.
    tx -= e.deltaX;
    ty -= e.deltaY;
    apply();
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
    startTx += clampDX;
    startTy += clampDY;
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
      // Deliberately NOT preventDefault here. Cancelling a touchstart also
      // cancels the click the browser would synthesise from the tap, which
      // silently killed every click-driven interaction inside a pan/zoom
      // layer on a phone: tapping a string to label it, and tapping cards in
      // link mode. Scrolling is already prevented by touch-action: none on
      // the viewport (set below), so the preventDefault bought nothing.
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
      startTx += clampDX;
      startTy += clampDY;
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
      scale = Math.max(s, minScale());
      tx = 0;
      ty = 0;
      apply();
    },
    panBy(dx: number, dy: number) {
      tx += dx;
      ty += dy;
      apply();
    },
    refit() {
      scale = Math.max(scale, minScale());
      apply();
    },
    reset() {
      // A bounded layer's floor is dynamic (it depends on viewport size), so a
      // preferred fitScale set at build time may sit below it on a big screen.
      scale = Math.max(fitScale, minScale());
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
