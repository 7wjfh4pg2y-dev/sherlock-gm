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

  // The framing blurb used to sit inline above the button, but on a phone it
  // ate most of the panel — with the notebook up there was no room left to
  // read the informants themselves. It now lives in a tooltip: revealed on
  // hover on pointer devices, and via its own ⓘ button on touch, so tapping
  // doesn't have to fight the lecture button's own tap.
  const tip = h('div', { class: 'lecture-tip', attrs: { role: 'tooltip' }, text: LECTURE_INTRO });
  const infoBtn = h('button', {
    class: 'lecture-info-btn',
    text: 'i',
    attrs: { type: 'button', 'aria-label': 'What is this lecture?', 'aria-expanded': 'false' },
  });
  const lectureRow = h('div', { class: 'lecture-row' }, lectureBtn, infoBtn, tip);

  // Dismissal listeners are bound only while the tip is open, so a panel that
  // is built once per screen mount leaves nothing behind on the document.
  let tipOpen = false;
  function onOutside(e: Event): void {
    if (!lectureRow.contains(e.target as Node)) setTip(false);
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') setTip(false);
  }
  function setTip(open: boolean): void {
    if (open === tipOpen) return;
    tipOpen = open;
    tip.classList.toggle('open', open);
    infoBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      document.addEventListener('pointerdown', onOutside, true);
      document.addEventListener('keydown', onKey);
    } else {
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onKey);
    }
  }
  infoBtn.addEventListener('click', (e) => { e.stopPropagation(); setTip(!tipOpen); });
  // Opening the lecture shouldn't leave a stray tooltip behind it.
  lectureBtn.addEventListener('click', () => setTip(false));

  return h('div', { class: 'informants-panel' },
    h('div', { class: 'informants-intro' },
      lectureRow,
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
