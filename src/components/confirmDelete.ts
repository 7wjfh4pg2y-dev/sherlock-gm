// ── Confirm-delete dialog ──
// Promise-based: `if (await confirmDelete('Delete this note?')) { ... }`.

import { h } from '../util/dom';
import { openModal } from './modal';

export function confirmDelete(message: string, confirmLabel = 'Delete'): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      handle.close();
      resolve(result);
    };

    const content = h(
      'div',
      { class: 'confirm-delete' },
      h('div', { class: 'confirm-header' }, h('span', { text: '⚠ Confirm' })),
      h('p', { class: 'confirm-message', text: message }),
      h(
        'div',
        { class: 'confirm-actions' },
        h('button', {
          class: 'btn btn-secondary btn-sm',
          text: 'Cancel',
          on: { click: () => finish(false) },
        }),
        h('button', {
          class: 'btn btn-danger btn-sm',
          text: confirmLabel,
          on: { click: () => finish(true) },
        }),
      ),
    );

    const handle = openModal(content, {
      contentClass: 'modal-confirm',
      onClose: () => finish(false),
    });
  });
}
