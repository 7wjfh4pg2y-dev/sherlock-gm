// ── Modal shell ──
// One generic overlay used by every dialog (login, new case, directory, map
// viewer, confirm-delete, GM notebook). Caller supplies the inner content node.

import { h } from '../util/dom';

export interface ModalHandle {
  readonly element: HTMLElement;
  close(): void;
}

export interface ModalOptions {
  /** Close when the dark backdrop (outside content) is clicked. Default true. */
  closeOnBackdrop?: boolean;
  /** Close on Escape. Default true. */
  closeOnEscape?: boolean;
  /** Extra class on the content box. */
  contentClass?: string;
  onClose?: () => void;
}

export function openModal(content: Node, options: ModalOptions = {}): ModalHandle {
  const { closeOnBackdrop = true, closeOnEscape = true, contentClass, onClose } = options;

  const box = h('div', { class: contentClass ? `modal-box ${contentClass}` : 'modal-box' });
  box.append(content);

  const overlay = h(
    'div',
    {
      class: 'modal-overlay open',
      on: {
        click: (e) => {
          if (closeOnBackdrop && e.target === overlay) close();
        },
      },
    },
    box,
  );

  function onKey(e: KeyboardEvent): void {
    if (closeOnEscape && e.key === 'Escape') close();
  }

  function close(): void {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    onClose?.();
  }

  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);

  return {
    get element() {
      return box;
    },
    close,
  };
}

/** Convenience: a titled modal with an × close button. Returns body to fill. */
export function openTitledModal(
  title: string,
  options: ModalOptions = {},
): { handle: ModalHandle; body: HTMLElement } {
  const body = h('div', { class: 'modal-body' });
  const header = h(
    'div',
    { class: 'modal-header' },
    h('span', { class: 'modal-title', text: title }),
  );
  const content = h('div', {}, header, body);
  const handle = openModal(content, options);
  const closeBtn = h('button', {
    class: 'modal-close',
    text: '✕',
    on: { click: () => handle.close() },
  });
  header.append(closeBtn);
  return { handle, body };
}
