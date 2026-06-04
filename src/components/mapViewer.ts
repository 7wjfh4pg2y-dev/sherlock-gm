// ── Map / document viewer ──
// Fullscreen overlay. Images: click-to-zoom (fit ⇄ actual size).
// PDFs: rendered in an <iframe> — native browser PDF renderer, full zoom controls.
// ✕ / backdrop / Esc to close.

import { h } from '../util/dom';

function isPdf(url: string): boolean {
  return url.split('?')[0].toLowerCase().endsWith('.pdf');
}

export function openMapViewer(url: string, name = 'Map'): void {
  const close = (): void => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  };
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  let stage: HTMLElement;
  if (isPdf(url)) {
    const frame = h('iframe', {
      class: 'map-viewer-pdf',
      attrs: { src: url, title: name },
    });
    stage = h('div', { class: 'map-viewer-stage map-viewer-stage--pdf' }, frame);
  } else {
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
    stage = h('div', { class: 'map-viewer-stage' }, img);
  }

  // For PDFs the iframe captures pointer events, so backdrop click is unreliable.
  // Close via ✕ button or Esc only when showing a PDF; backdrop click works for images.
  const overlay = h(
    'div',
    {
      class: 'map-viewer-overlay',
      on: { click: (e) => { if (!isPdf(url) && e.target === overlay) close(); } },
    },
    h('button', { class: 'map-viewer-close', text: '✕', on: { click: () => close() } }),
    stage,
  );

  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
}
