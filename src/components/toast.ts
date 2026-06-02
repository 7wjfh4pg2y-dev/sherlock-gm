// ── Toast ──
// Single reused element pinned to the body. toast('saved') shows briefly.

import { h } from '../util/dom';

let el: HTMLElement | null = null;
let hideTimer: number | undefined;

function ensure(): HTMLElement {
  if (!el) {
    el = h('div', { class: 'toast' });
    document.body.appendChild(el);
  }
  return el;
}

export function toast(message: string): void {
  const node = ensure();
  node.textContent = message;
  node.classList.add('show');
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => node.classList.remove('show'), 2600);
}
