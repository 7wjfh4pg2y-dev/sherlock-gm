// ── Map viewer ──
// Fullscreen image overlay with click-to-zoom (fit ⇄ actual size, pan by scroll)
// and ✕ / backdrop / Esc to close. Its own chrome — not the parchment modal box.

import { h } from '../util/dom';

export function openMapViewer(url: string, name = 'Map'): void {
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

  const close = (): void => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  };
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
  }

  const overlay = h(
    'div',
    {
      class: 'map-viewer-overlay',
      on: { click: () => close() },
    },
    h('button', { class: 'map-viewer-close', text: '✕', on: { click: () => close() } }),
    h('div', { class: 'map-viewer-stage' }, img),
  );

  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
}
