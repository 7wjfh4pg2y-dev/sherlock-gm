// ── Map / document viewer ──
// Fullscreen overlay. Images: drag-to-pan + wheel-to-zoom, with a reset button.
// PDFs delegate to openPdfViewer (PDF.js, in-world chrome).
// ✕ / backdrop / Esc to close.

import { h } from '../util/dom';
import { attachPanZoom } from '../util/panZoom';

function isPdf(url: string): boolean {
  return url.split('?')[0].toLowerCase().endsWith('.pdf');
}

export function openMapViewer(url: string, name = 'Map'): void {
  if (isPdf(url)) {
    // Lazy-load PDF.js (~1.2MB) only when a PDF is actually opened, so it never
    // weighs down the initial page load.
    void import('./pdfViewer').then((m) => m.openPdfViewer(url, name));
    return;
  }

  const close = (): void => {
    document.removeEventListener('keydown', onKey);
    pz.detach();
    overlay.remove();
  };
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  const img = h('img', {
    class: 'map-viewer-img',
    attrs: { src: url, alt: name },
  });
  const stage = h('div', { class: 'map-viewer-stage' }, img);
  const pz = attachPanZoom(stage, img);

  const stop = (e: MouseEvent): void => e.stopPropagation();
  const ctrls = h('div', { class: 'map-ctrl-bar map-ctrl-bar--overlay', on: { click: stop } },
    h('button', { class: 'map-ctrl-btn', text: '⟲', attrs: { title: 'Reset view' },  on: { click: () => pz.reset() } }),
    h('button', { class: 'map-ctrl-btn', text: '−', attrs: { title: 'Zoom out' },     on: { click: () => pz.zoomOut() } }),
    h('button', { class: 'map-ctrl-btn', text: '+', attrs: { title: 'Zoom in' },      on: { click: () => pz.zoomIn() } }),
    h('button', { class: 'map-ctrl-btn', text: '✕', attrs: { title: 'Close' },        on: { click: () => close() } }),
  );

  const overlay = h(
    'div',
    {
      class: 'map-viewer-overlay',
      on: { click: (e) => { if (e.target === overlay) close(); } },
    },
    ctrls,
    stage,
  );

  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
}
