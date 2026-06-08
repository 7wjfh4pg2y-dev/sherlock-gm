// ── Notebook component ──
// The Victorian parchment tabbed notebook, shared by GM and player. It is "dumb":
// it owns tab switching and chrome only. Owners supply each tab's content node
// and update the feed inside it on store changes — so composer focus and the
// active tab survive live updates (the bug v1 kept hitting).

import { h, replaceChildren, formatTime } from '../util/dom';

export interface NotebookTab {
  id: string;
  label: string;
  /** Coloured dot before the label (per-player GM tabs). */
  dotColor?: string;
  content: HTMLElement;
}

export interface NotebookHandle {
  readonly element: HTMLElement;
  setActive(id: string): void;
}

export function createNotebook(tabs: NotebookTab[], activeId = tabs[0]?.id): NotebookHandle {
  const tabEls = new Map<string, HTMLElement>();
  const pageEls = new Map<string, HTMLElement>();

  const tabBar = h('div', { class: 'nb-tabs' });
  const paper = h('div', { class: 'nb-paper' }, h('div', { class: 'nb-ruled' }));

  function setActive(id: string): void {
    for (const [tid, tab] of tabEls) tab.classList.toggle('active', tid === id);
    for (const [pid, page] of pageEls) page.classList.toggle('active', pid === id);
  }

  for (const tab of tabs) {
    const dot = tab.dotColor
      ? h('span', { class: 'nb-tab-dot', style: { background: tab.dotColor } })
      : null;
    const tabEl = h(
      'label',
      { class: 'nb-tab', on: { click: () => setActive(tab.id) } },
      dot,
      tab.label,
    );
    tabEls.set(tab.id, tabEl);
    tabBar.append(tabEl);

    const page = h('div', { class: 'nb-page' }, tab.content);
    pageEls.set(tab.id, page);
    paper.append(page);
  }

  const element = h('div', { class: 'notebook' }, tabBar, paper);
  if (activeId) setActive(activeId);

  return { element, setActive };
}

// ── Building blocks owners compose into tab content ──

export interface NoteAction {
  label: string;
  danger?: boolean;
  onClick: () => void;
}

export interface NoteCardData {
  name: string;
  color: string;
  time: string; // ISO
  text: string;
  badge?: string; // e.g. "Private"
  actions?: NoteAction[];
}

export function noteCard(data: NoteCardData): HTMLElement {
  const meta = h(
    'div',
    { class: 'nb-note-meta' },
    h('span', { class: 'nb-note-name', text: data.name, style: { color: data.color } }),
    h('span', { class: 'nb-note-time', text: formatTime(data.time) }),
    data.badge ? h('span', { class: 'nb-note-badge', text: data.badge }) : null,
    data.actions && data.actions.length
      ? h(
          'span',
          { class: 'nb-note-actions' },
          ...data.actions.map((a) =>
            h('button', {
              class: a.danger ? 'nb-note-action danger' : 'nb-note-action',
              text: a.label,
              on: { click: a.onClick },
            }),
          ),
        )
      : null,
  );
  return h('div', { class: 'nb-note' }, meta, h('div', { class: 'nb-note-text', text: data.text }));
}

/** Replace the contents of a feed/content node (preserves surrounding composer). */
export function fillFeed(node: HTMLElement, cards: HTMLElement[], emptyText: string): void {
  if (!cards.length) {
    replaceChildren(node, h('div', { class: 'nb-empty', text: emptyText }));
  } else {
    replaceChildren(node, ...cards);
  }
}

/** Inline editor that replaces a note card while editing (Save / Cancel). */
export function noteEditor(
  initialText: string,
  onSave: (text: string) => void,
  onCancel: () => void,
): HTMLElement {
  const textarea = h('textarea', { class: 'nb-note-edit-input', attrs: { rows: '2' } });
  textarea.value = initialText;
  const save = () => {
    const text = textarea.value.trim();
    if (text) onSave(text);
  };
  return h(
    'div',
    { class: 'nb-note nb-note-editing' },
    textarea,
    h(
      'div',
      { class: 'nb-note-edit-row' },
      h('button', { class: 'nb-note-edit-save', text: 'Save', on: { click: save } }),
      h('button', { class: 'nb-note-edit-cancel', text: 'Cancel', on: { click: onCancel } }),
    ),
  );
}

export interface ComposerOptions {
  placeholder: string;
  onSubmit: (text: string) => void;
}

/** Textarea + "Add Note" button. Clears on submit. */
export function noteComposer(options: ComposerOptions): HTMLElement {
  const textarea = h('textarea', {
    class: 'nb-textarea',
    attrs: { rows: '3', placeholder: options.placeholder },
  });
  const submit = () => {
    const text = textarea.value.trim();
    if (!text) return;
    options.onSubmit(text);
    textarea.value = '';
  };
  const button = h('button', { class: 'nb-add-btn', text: 'Add Note', on: { click: submit } });
  return h('div', { class: 'nb-input-row' }, textarea, button);
}
