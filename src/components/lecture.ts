// ── Lecture modal ──
// Opens Holmes's 1886 lecture to the Baker Street Irregulars in the shared
// modal. Self-contained: caller just wires a button to openLectureModal().

import { h } from '../util/dom';
import { openTitledModal } from './modal';
import { LECTURE_INTRO, LECTURE_PARAGRAPHS } from '../data/lecture';

export function openLectureModal(): void {
  const { body } = openTitledModal("Holmes's Lecture", { contentClass: 'rules-modal' });

  body.append(h('p', { class: 'rules-intro', text: LECTURE_INTRO }));
  for (const p of LECTURE_PARAGRAPHS) {
    body.append(h('p', { class: 'rules-para', text: p }));
  }
}
