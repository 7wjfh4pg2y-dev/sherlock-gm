// ── Inlay fullscreener ──
// Moves an existing element into a fullscreen overlay and back, *without*
// rebuilding it — so heavy content (PDF canvases, map bitmaps) is never
// duplicated in memory. Reparenting preserves all listeners and state.

import { h } from './dom';

export interface Fullscreener {
  toggle(): void;
  enter(): void;
  exit(): void;
  isOpen(): boolean;
  /** Restore the element to its original place and drop listeners. */
  dispose(): void;
}

export function createFullscreener(
  el: HTMLElement,
  onChange?: (open: boolean) => void,
): Fullscreener {
  let overlay: HTMLElement | null = null;
  let parent: Element | null = null;
  let next: ChildNode | null = null;

  function onKey(e: KeyboardEvent): void { if (e.key === 'Escape') exit(); }

  function enter(): void {
    if (overlay) return;
    parent = el.parentElement;
    next = el.nextSibling;
    overlay = h('div', { class: 'inlay-fullscreen-overlay' });
    document.body.appendChild(overlay);
    overlay.appendChild(el);
    el.classList.add('inlay--fullscreen');
    document.addEventListener('keydown', onKey);
    onChange?.(true);
  }

  function exit(): void {
    if (!overlay) return;
    document.removeEventListener('keydown', onKey);
    if (parent) parent.insertBefore(el, next ?? null);
    overlay.remove();
    overlay = null;
    el.classList.remove('inlay--fullscreen');
    onChange?.(false);
  }

  return {
    toggle() { overlay ? exit() : enter(); },
    enter,
    exit,
    isOpen() { return overlay !== null; },
    dispose() { exit(); },
  };
}
