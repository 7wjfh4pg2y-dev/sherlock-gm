// ── Informants panel ──
// Renders the static informants reference as a standalone element, embeddable
// inline in a tab on both the GM and player screens. Includes a quick filter.

import { h, replaceChildren } from '../util/dom';
import { INFORMANTS, type Informant } from '../data/informants';
import { LECTURE_INTRO } from '../data/lecture';
import { openLectureModal } from './lecture';

export function buildInformants(): HTMLElement {
  const searchInput = h('input', {
    class: 'directory-search-input',
    attrs: { type: 'text', placeholder: 'Filter by name…' },
  }) as HTMLInputElement;
  const list = h('div', { class: 'informants-list' });

  function card(inf: Informant): HTMLElement {
    return h('div', { class: 'informant-card' },
      h('div', { class: 'informant-head' },
        h('span', { class: 'informant-name', text: inf.name }),
        h('span', { class: 'informant-loc', text: inf.location }),
      ),
      h('p', { class: 'informant-desc', text: inf.description }),
    );
  }

  function render(): void {
    const q = searchInput.value.trim().toLowerCase();
    const matches = q ? INFORMANTS.filter((i) => i.name.toLowerCase().includes(q)) : INFORMANTS;
    if (!matches.length) {
      replaceChildren(list, h('div', { class: 'directory-empty', text: 'No informants match.' }));
      return;
    }
    replaceChildren(list, ...matches.map(card));
  }

  searchInput.addEventListener('input', render);
  render();

  // ── Lecture ──
  // Holmes's 1886 lecture introducing the informants. Opens in a modal so the
  // reference list stays put.
  const lectureBtn = h('button', {
    class: 'lecture-toggle',
    attrs: { type: 'button' },
    text: "📖 Read Holmes's lecture",
    on: { click: () => openLectureModal() },
  });

  return h('div', { class: 'informants-panel' },
    h('div', { class: 'informants-intro' },
      h('p', { text: LECTURE_INTRO }),
      lectureBtn,
    ),
    h('div', { class: 'directory-search-row' },
      h('div', { class: 'directory-search-wrap' },
        h('span', { class: 'directory-search-icon', text: '🔍' }),
        searchInput,
      ),
    ),
    list,
  );
}
