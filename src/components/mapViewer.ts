// ── Map / document viewer ──
// Fullscreen overlay. Images: click-to-zoom (fit ⇄ actual size).
// PDFs delegate to openPdfViewer (PDF.js, in-world chrome).
// ✕ / backdrop / Esc to close.

import { h } from '../util/dom';

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
    overlay.remove();
  };
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  const img = h('img', {
    class: 'map-viewer-img',
    attrs: { src: url, alt: name },
    on: {
      click: (e) => {
        e.stopPropagation();
        img.classList.toggle('zoomed');
      },
    },
  });
  const stage = h('div', { class: 'map-viewer-stage' }, img);

  const overlay = h(
    'div',
    {
      class: 'map-viewer-overlay',
      on: { click: (e) => { if (e.target === overlay) close(); } },
    },
    h('button', { class: 'map-viewer-close', text: '✕', on: { click: () => close() } }),
    stage,
  );

  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
}
