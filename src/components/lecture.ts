// ── Lecture modal ──
// Opens Holmes's 1886 lecture to the Baker Street Irregulars in the shared
// modal. Self-contained: caller just wires a button to openLectureModal().

import { h } from '../util/dom';
import { openTitledModal } from './modal';
import { LECTURE_PARAGRAPHS } from '../data/lecture';

export function openLectureModal(): void {
  const { body } = openTitledModal("Holmes's Lecture", { contentClass: 'rules-modal' });

  // The framing note (LECTURE_INTRO) already sits above the informants list, so
  // the modal opens straight into the lecture itself.
  for (const p of LECTURE_PARAGRAPHS) {
    body.append(h('p', { class: 'rules-para', text: p }));
  }
}
