// ── PDF viewer ──
// Renders a PDF's pages to <canvas> with PDF.js inside the app's own parchment
// overlay — no browser PDF chrome, so it stays in-world. Pages stack vertically
// and scroll; our own + / − rerender at higher resolution for crisp zoom.
// ✕ / backdrop / Esc to close.

import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { h, clear } from '../util/dom';

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

// Base CSS-pixel width a page is laid out at; zoom scales around it. The canvas
// itself is rendered at devicePixelRatio × this for sharpness.
const BASE_WIDTH = 820;
const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

// Hard caps on a single page's backing canvas. Mobile Safari refuses to paint
// canvases above ~16.7M px (and ~4096 px per side on some devices) — exceeding
// either yields blank pages or a tab crash. We render at devicePixelRatio for
// sharpness but never past these limits; the CSS layout size is unaffected, so
// pages just get slightly softer at extreme zoom instead of crashing.
const MAX_CANVAS_DIM = 4096;
const MAX_CANVAS_AREA = 16_000_000;

export interface InlinePdfHandle {
  element: HTMLElement;
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
  destroy(): void;
}

// Parsed documents are cached by URL and kept alive for the session. A newspaper
// is opened repeatedly (tab switches, newspaper switches, fullscreen), and each
// parse is a network fetch + worker round-trip — so we fetch+parse once and
// reuse the PDFDocumentProxy everywhere. Viewers never destroy the shared doc;
// they only tear down their own DOM and listeners.
const docCache = new Map<string, Promise<pdfjsLib.PDFDocumentProxy>>();

function loadDoc(url: string): Promise<pdfjsLib.PDFDocumentProxy> {
  let p = docCache.get(url);
  if (!p) {
    p = pdfjsLib.getDocument({ url }).promise.catch((err) => {
      docCache.delete(url); // don't cache a failed load — allow a retry
      throw err;
    });
    docCache.set(url, p);
  }
  return p;
}

// Rasterize every page of a doc into `target` at the given zoom, fitting
// BASE_WIDTH and rendering at devicePixelRatio for sharpness. Shared by the
// inline inlay and the fullscreen overlay.
async function rasterizePages(
  doc: pdfjsLib.PDFDocumentProxy,
  target: HTMLElement,
  zoom: number,
): Promise<void> {
  clear(target);
  const dpr = window.devicePixelRatio || 1;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const unscaled = page.getViewport({ scale: 1 });
    // CSS layout size the page occupies on screen.
    const cssScale = (BASE_WIDTH / unscaled.width) * zoom;
    const cssW = unscaled.width * cssScale;
    const cssH = unscaled.height * cssScale;
    // Desired backing scale (dpr-sharp), then clamp so neither side nor the
    // total area exceeds the mobile canvas limits.
    let renderScale = cssScale * dpr;
    const pxW = unscaled.width * renderScale;
    const pxH = unscaled.height * renderScale;
    const dimCap = MAX_CANVAS_DIM / Math.max(pxW, pxH);
    const areaCap = Math.sqrt(MAX_CANVAS_AREA / (pxW * pxH));
    const cap = Math.min(1, dimCap, areaCap);
    if (cap < 1) renderScale *= cap;
    const viewport = page.getViewport({ scale: renderScale });
    const canvas = h('canvas', { class: 'pdf-viewer-page' }) as HTMLCanvasElement;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    // Layout size stays put regardless of any backing-resolution clamp.
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const ctx = canvas.getContext('2d');
    if (ctx) {
      target.append(canvas);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    }
  }
}

export function createInlinePdfViewer(url: string): InlinePdfHandle {
  let zoom = 1;         // zoom we want to rasterize at
  let renderedZoom = 1; // zoom the canvases were last rasterized at
  let tx = 0, ty = 0;  // pan offsets in CSS pixels
  let dragging = false;
  let startX = 0, startY = 0, startTx = 0, startTy = 0;

  let doc: pdfjsLib.PDFDocumentProxy | null = null;
  const pagesEl = h('div', { class: 'pdf-inlay-pages' });
  const status = h('div', { class: 'pdf-viewer-status', text: 'Loading…' });
  const element = h('div', { class: 'pdf-inlay-scroll' }, status, pagesEl);

  // Single source of truth for the live visual transform.
  function applyTransform(): void {
    const s = zoom / renderedZoom;
    pagesEl.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  }

  async function renderPages(): Promise<void> {
    if (!doc) return;
    renderedZoom = zoom;
    pagesEl.style.transform = `translate(${tx}px, ${ty}px)`;
    await rasterizePages(doc, pagesEl, zoom);
  }

  loadDoc(url)
    .then((d) => { doc = d; status.remove(); return renderPages(); })
    .catch(() => { status.textContent = 'Could not load this document.'; });

  // Wheel: CSS-scale immediately for smoothness, re-raster when settled.
  let rerenderTimer: number | undefined;
  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
    applyTransform();
    window.clearTimeout(rerenderTimer);
    rerenderTimer = window.setTimeout(() => void renderPages(), 160);
  }

  // Drag-to-pan (mouse + touch).
  function startDrag(clientX: number, clientY: number): void {
    dragging = true;
    startX = clientX; startY = clientY;
    startTx = tx; startTy = ty;
    element.style.cursor = 'grabbing';
  }
  function moveDrag(clientX: number, clientY: number): void {
    if (!dragging) return;
    tx = startTx + (clientX - startX);
    ty = startTy + (clientY - startY);
    applyTransform();
  }
  function endDrag(): void {
    if (!dragging) return;
    dragging = false;
    element.style.cursor = 'grab';
  }

  function onMouseDown(e: MouseEvent): void { if (e.button === 0) startDrag(e.clientX, e.clientY); }
  function onMouseMove(e: MouseEvent): void { moveDrag(e.clientX, e.clientY); }
  function onMouseUp(): void { endDrag(); }

  // Pinch-to-zoom: change `zoom` live (CSS scale) around the finger midpoint,
  // re-rastering once the gesture settles — the same pipeline as wheel zoom.
  let pinching = false;
  let pinchStartDist = 0;
  let pinchStartZoom = 1;
  function touchDist(t0: Touch, t1: Touch): number {
    return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
  }
  // Zoom toward (fx, fy) on screen. transform-origin is top-center, so that's
  // the reference point we hold the focal offset against.
  function zoomAround(nextZoom: number, fx: number, fy: number): void {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    const rect = pagesEl.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top;
    const k = clamped / zoom;
    tx += (1 - k) * (fx - ox);
    ty += (1 - k) * (fy - oy);
    zoom = clamped;
    applyTransform();
    window.clearTimeout(rerenderTimer);
    rerenderTimer = window.setTimeout(() => void renderPages(), 160);
  }

  function onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 2) {
      e.preventDefault();
      pinching = true;
      dragging = false;
      pinchStartDist = touchDist(e.touches[0], e.touches[1]);
      pinchStartZoom = zoom;
    } else if (e.touches.length === 1) {
      e.preventDefault();
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  }
  function onTouchMove(e: TouchEvent): void {
    if (pinching && e.touches.length === 2) {
      e.preventDefault();
      const dist = touchDist(e.touches[0], e.touches[1]);
      if (pinchStartDist > 0) {
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        zoomAround(pinchStartZoom * (dist / pinchStartDist), midX, midY);
      }
    } else if (dragging && e.touches.length === 1) {
      e.preventDefault();
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  }
  function onTouchEnd(e: TouchEvent): void {
    if (e.touches.length === 0) { endDrag(); pinching = false; }
    else if (e.touches.length === 1 && pinching) {
      // Lifting one finger of a pinch — continue as a one-finger drag.
      pinching = false;
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  element.style.cursor = 'grab';
  element.style.touchAction = 'none';
  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('mousedown', onMouseDown);
  element.addEventListener('touchstart', onTouchStart, { passive: false });
  element.addEventListener('touchmove', onTouchMove, { passive: false });
  element.addEventListener('touchend', onTouchEnd);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  function setZoom(z: number): void {
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    applyTransform();
    window.clearTimeout(rerenderTimer);
    rerenderTimer = window.setTimeout(() => void renderPages(), 160);
  }

  return {
    element,
    zoomIn()  { setZoom(zoom + ZOOM_STEP); },
    zoomOut() { setZoom(zoom - ZOOM_STEP); },
    reset()   { zoom = 1; tx = 0; ty = 0; void renderPages(); },
    destroy() {
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('mousedown', onMouseDown);
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.clearTimeout(rerenderTimer);
      // The parsed doc stays in docCache for reuse — only our DOM/listeners go.
    },
  };
}

export function openPdfViewer(url: string, name = 'Document'): void {
  let zoom = 1;
  let doc: pdfjsLib.PDFDocumentProxy | null = null;

  const pagesEl = h('div', { class: 'pdf-viewer-pages' });
  const status = h('div', { class: 'pdf-viewer-status', text: 'Loading…' });

  const close = (): void => {
    document.removeEventListener('keydown', onKey);
    stage.removeEventListener('touchstart', onTouchStart);
    stage.removeEventListener('touchmove', onTouchMove);
    stage.removeEventListener('touchend', onTouchEnd);
    // The parsed doc stays in docCache for reuse — only the overlay goes.
    overlay.remove();
  };
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
    else if (e.key === '+' || e.key === '=') setZoom(zoom + ZOOM_STEP);
    else if (e.key === '-') setZoom(zoom - ZOOM_STEP);
  }

  function setZoom(z: number): void {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));
    if (next === zoom) return;
    zoom = next;
    zoomLabel.textContent = Math.round(zoom * 100) + '%';
    void renderPages();
  }

  // Two-finger pinch: scale the pages live for smooth feedback, then commit to
  // the sharp re-raster (and the % label / buttons) on release. One-finger
  // touch keeps the stage's native scroll, so panning is unchanged.
  let pinching = false;
  let pinchStartDist = 0;
  let pinchLiveScale = 1;
  function touchDist(t0: Touch, t1: Touch): number {
    return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
  }
  function onTouchStart(e: TouchEvent): void {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    pinching = true;
    pinchStartDist = touchDist(e.touches[0], e.touches[1]);
    pinchLiveScale = 1;
    pagesEl.style.transformOrigin = 'top center';
  }
  function onTouchMove(e: TouchEvent): void {
    if (!pinching || e.touches.length !== 2 || pinchStartDist === 0) return;
    e.preventDefault();
    pinchLiveScale = touchDist(e.touches[0], e.touches[1]) / pinchStartDist;
    pagesEl.style.transform = `scale(${pinchLiveScale})`;
  }
  function onTouchEnd(e: TouchEvent): void {
    if (!pinching || e.touches.length >= 2) return;
    pinching = false;
    pagesEl.style.transform = '';
    setZoom(zoom * pinchLiveScale);
  }

  async function renderPages(): Promise<void> {
    if (!doc) return;
    await rasterizePages(doc, pagesEl, zoom);
  }

  const zoomLabel = h('span', { class: 'pdf-viewer-zoom', text: '100%' });
  const toolbar = h(
    'div',
    { class: 'pdf-viewer-toolbar' },
    h('span', { class: 'pdf-viewer-name', text: name }),
    h('div', { class: 'pdf-viewer-controls' },
      h('button', { class: 'pdf-viewer-btn', text: '−', attrs: { 'aria-label': 'Zoom out' }, on: { click: () => setZoom(zoom - ZOOM_STEP) } }),
      zoomLabel,
      h('button', { class: 'pdf-viewer-btn', text: '+', attrs: { 'aria-label': 'Zoom in' }, on: { click: () => setZoom(zoom + ZOOM_STEP) } }),
    ),
  );

  const stage = h('div', { class: 'pdf-viewer-stage' }, status, pagesEl);
  const overlay = h(
    'div',
    {
      class: 'pdf-viewer-overlay',
      on: { click: (e) => { if (e.target === overlay) close(); } },
    },
    h('button', { class: 'map-viewer-close', text: '✕', on: { click: () => close() } }),
    toolbar,
    stage,
  );

  document.addEventListener('keydown', onKey);
  stage.addEventListener('touchstart', onTouchStart, { passive: false });
  stage.addEventListener('touchmove', onTouchMove, { passive: false });
  stage.addEventListener('touchend', onTouchEnd);
  document.body.appendChild(overlay);

  loadDoc(url)
    .then((d) => {
      doc = d;
      status.remove();
      return renderPages();
    })
    .catch(() => {
      status.textContent = 'Could not load this document.';
    });
}
