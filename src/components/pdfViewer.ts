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

export function openPdfViewer(url: string, name = 'Document'): void {
  let zoom = 1;
  let doc: pdfjsLib.PDFDocumentProxy | null = null;
  const loadingTask = pdfjsLib.getDocument({ url });

  const pagesEl = h('div', { class: 'pdf-viewer-pages' });
  const status = h('div', { class: 'pdf-viewer-status', text: 'Loading…' });

  const close = (): void => {
    document.removeEventListener('keydown', onKey);
    void loadingTask.destroy();
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

  async function renderPages(): Promise<void> {
    if (!doc) return;
    clear(pagesEl);
    const dpr = window.devicePixelRatio || 1;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const unscaled = page.getViewport({ scale: 1 });
      // Fit BASE_WIDTH, then apply the user's zoom on top.
      const scale = (BASE_WIDTH / unscaled.width) * zoom;
      const viewport = page.getViewport({ scale: scale * dpr });
      const canvas = h('canvas', { class: 'pdf-viewer-page' }) as HTMLCanvasElement;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = viewport.width / dpr + 'px';
      canvas.style.height = viewport.height / dpr + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) {
        pagesEl.append(canvas);
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      }
    }
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
      on: { click: (e) => { if (e.target === overlay || e.target === stage) close(); } },
    },
    h('button', { class: 'map-viewer-close', text: '✕', on: { click: () => close() } }),
    toolbar,
    stage,
  );

  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);

  loadingTask
    .promise.then((d) => {
      doc = d;
      status.remove();
      return renderPages();
    })
    .catch(() => {
      status.textContent = 'Could not load this document.';
    });
}
