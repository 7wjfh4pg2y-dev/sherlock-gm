// ── Informants panel ──
// Renders the static informants reference as a standalone element, embeddable
// inline in a tab on both the GM and player screens. Includes a quick filter.

import { h, replaceChildren } from '../util/dom';
import { INFORMANTS, type Informant } from '../data/informants';
import { LECTURE_INTRO, LECTURE_PARAGRAPHS } from '../data/lecture';

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

  // ── Collapsible lecture ──
  // Holmes's 1886 lecture introducing the informants. Folded by default so it
  // doesn't push the reference list down; a toggle reveals the full prose.
  const lectureBody = h('div', { class: 'lecture-body' },
    ...LECTURE_PARAGRAPHS.map((p) => h('p', { class: 'lecture-para', text: p })),
  );
  const lectureToggle = h('button', {
    class: 'lecture-toggle',
    attrs: { type: 'button', 'aria-expanded': 'false' },
    text: "▸ Read Holmes's lecture",
  });
  let lectureOpen = false;
  lectureToggle.addEventListener('click', () => {
    lectureOpen = !lectureOpen;
    lectureBody.classList.toggle('open', lectureOpen);
    lectureToggle.setAttribute('aria-expanded', String(lectureOpen));
    lectureToggle.textContent = lectureOpen ? "▾ Hide Holmes's lecture" : "▸ Read Holmes's lecture";
  });

  return h('div', { class: 'informants-panel' },
    h('div', { class: 'informants-intro' },
      h('p', { text: LECTURE_INTRO }),
      lectureToggle,
      lectureBody,
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
